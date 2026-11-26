import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  DIMENSIONS,
  computeOverallScore,
  dimensionWeightMap,
  readDimensionScores,
  type Dimension,
  type DimensionScores,
} from "./scoring.service.js";
import { parseSnapshot } from "./session-questions.service.js";
import { getSubjectResults } from "./review-results.service.js";

/**
 * Personel geçmişi: bir kişinin tüm HR/PDR oturumları, personel olayları (işe giriş,
 * ayrılış) ve boyut trendleri tek yanıtta. `GET /api/personnel/:id/history`.
 *
 * Rol kuralı (güvenlik denetimi, development.md §8): skorlar, AI analiz özetleri ve
 * rapor bağlantıları yalnız `ROLE_GROUPS.analyze` grubuna döner. Diğer roller oturumların
 * yalnız üst verisini (başlık, durum, tarih, İK onay durumu) görür.
 */

/** Zaman çizelgesindeki metin özetleri bu uzunlukta kesilir (tam metin rapor sayfasında) */
const SNIPPET_MAX = 280;
const LIST_SNIPPET_MAX = 3;

export interface HistorySwotSnippet {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface HistoryCareerSnippet {
  shortTerm: string | null;
  midTerm: string | null;
  longTerm: string | null;
}

export interface HistorySession {
  id: string;
  assessment: { id: string; title: string };
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  durationSec: number | null;
  /** İK onayı: PENDING | APPROVED | REJECTED; analiz henüz incelemeye düşmediyse null */
  review: { status: string; decidedAt: string | null } | null;
  analysisPipeline: string;
  /** Aşağıdakiler yalnız analyze grubuna dolu döner */
  overallScore: number | null;
  dimensionScores: DimensionScores | null;
  reportId: string | null;
  reportStatus: string | null;
  keyInsights: string | null;
  swot: HistorySwotSnippet | null;
  careerPaths: HistoryCareerSnippet | null;
}

export type HistoryEventType = "HIRED" | "RECORD_CREATED" | "TERMINATED";

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  date: string;
  /** TERMINATED: neden kodu ve not */
  reason?: string | null;
  note?: string | null;
}

/**
 * 360° dönem sonucu: kapanmış dönemlerde kişinin değerlendirilen kaydı (ReviewSubject).
 * Skorlar `getSubjectResults()` ile hesaplanır, yani anonimlik eşiği altındaki eş düzey /
 * ast grupları hiçbir değere katılmaz. Skorlar yalnız analyze grubuna dolu döner.
 */
export interface HistoryReviewResult {
  /** ReviewSubject.id */
  id: string;
  cycleId: string;
  cycleName: string;
  periodStart: string | null;
  periodEnd: string | null;
  closedAt: string | null;
  releasedAt: string | null;
  /** Personelle paylaşım için yayınlandı mı */
  released: boolean;
  /** Grup ağırlıklı birleşik puan (0–10) */
  overallScore: number | null;
  selfScore: number | null;
  othersScore: number | null;
  /** Boyut başına grup ağırlıklı puan */
  dimensionScores: DimensionScores | null;
  completedRaters: number | null;
  totalRaters: number | null;
}

export type HistoryTimelineEntry =
  | { kind: "event"; id: string; date: string; eventId: string }
  | { kind: "session"; id: string; date: string; sessionId: string }
  | { kind: "review"; id: string; date: string; reviewId: string };

export interface HistoryTrendPoint {
  sessionId: string;
  date: string;
  label: string;
  overall: number | null;
  scores: Record<Dimension, number | null>;
}

export interface PersonnelHistory {
  personnelId: string;
  status: string;
  canViewAnalysis: boolean;
  summary: {
    totalSessions: number;
    completedSessions: number;
    approvedSessions: number;
    firstCompletedAt: string | null;
    lastCompletedAt: string | null;
    latestOverall: number | null;
    previousOverall: number | null;
    averageOverall: number | null;
  };
  sessions: HistorySession[];
  events: HistoryEvent[];
  reviews: HistoryReviewResult[];
  timeline: HistoryTimelineEntry[];
  trend: { dimensions: Dimension[]; points: HistoryTrendPoint[] };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

function clip(text: unknown, max = SNIPPET_MAX): string | null {
  if (typeof text !== "string") return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function clipList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => clip(v, 160))
    .filter((v): v is string => !!v)
    .slice(0, LIST_SNIPPET_MAX);
}

function readSwot(value: Prisma.JsonValue | null): HistorySwotSnippet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out = {
    strengths: clipList(v.strengths),
    weaknesses: clipList(v.weaknesses),
    opportunities: clipList(v.opportunities),
    threats: clipList(v.threats),
  };
  const total =
    out.strengths.length + out.weaknesses.length + out.opportunities.length + out.threats.length;
  return total > 0 ? out : null;
}

function readCareer(value: Prisma.JsonValue | null): HistoryCareerSnippet | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out = {
    shortTerm: clip(v.shortTerm, 200),
    midTerm: clip(v.midTerm, 200),
    longTerm: clip(v.longTerm, 200),
  };
  return out.shortTerm || out.midTerm || out.longTerm ? out : null;
}

/** Oturumun zaman çizelgesindeki tarihi: tamamlanma > başlama > atanma */
function sessionDate(s: { completedAt: Date | null; startedAt: Date | null; createdAt: Date }) {
  return s.completedAt ?? s.startedAt ?? s.createdAt;
}

/**
 * Kişinin geçmişini derler. Personel kaydı kurum içinde değilse null döner (çağıran 404 verir).
 * Arşivlenmiş (soft-deleted) kayıt yalnız `includeArchived` ile okunur.
 */
export async function getPersonnelHistory(params: {
  organizationId: string;
  personnelId: string;
  canViewAnalysis: boolean;
  includeArchived?: boolean;
}): Promise<PersonnelHistory | null> {
  const { organizationId, personnelId, canViewAnalysis, includeArchived } = params;

  const personnel = await prisma.personnel.findFirst({
    where: {
      id: personnelId,
      organizationId,
      ...(includeArchived ? {} : { deletedAt: null }),
    },
    select: {
      id: true,
      status: true,
      hireDate: true,
      createdAt: true,
      terminationDate: true,
      terminationReason: true,
      terminationNote: true,
    },
  });
  if (!personnel) return null;

  const rows = await prisma.assessmentSession.findMany({
    // Tenant: oturumun değerlendirmesi de aynı kurumda olmalı
    where: { personnelId, assessment: { organizationId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
      dueAt: true,
      durationSec: true,
      analysisPipeline: true,
      dimensionScores: canViewAnalysis,
      keyInsights: canViewAnalysis,
      swotAnalysis: canViewAnalysis,
      careerPaths: canViewAnalysis,
      questionSetSnapshot: canViewAnalysis,
      assessment: {
        select: {
          id: true,
          title: true,
          questionSet: {
            select: {
              weightLogical: true,
              weightLeadership: true,
              weightSocial: true,
              weightGrowth: true,
              weightDomain: true,
            },
          },
        },
      },
      analysisReview: { select: { status: true, decidedAt: true } },
      report: { select: { id: true, status: true } },
    },
  });

  const sessions: HistorySession[] = rows.map((s) => {
    let overallScore: number | null = null;
    let dimensionScores: DimensionScores | null = null;
    if (canViewAnalysis) {
      dimensionScores = readDimensionScores(s.dimensionScores);
      // Rapor modülüyle aynı hesap: oturumun soru seti kopyasındaki ağırlıklar, yoksa güncel set
      const weights =
        parseSnapshot(s.questionSetSnapshot ?? null)?.weights ??
        dimensionWeightMap(s.assessment.questionSet);
      overallScore = computeOverallScore(dimensionScores, weights);
    }
    return {
      id: s.id,
      assessment: { id: s.assessment.id, title: s.assessment.title },
      status: s.status,
      createdAt: s.createdAt.toISOString(),
      startedAt: iso(s.startedAt),
      completedAt: iso(s.completedAt),
      dueAt: iso(s.dueAt),
      durationSec: s.durationSec,
      review: s.analysisReview
        ? { status: s.analysisReview.status, decidedAt: iso(s.analysisReview.decidedAt) }
        : null,
      analysisPipeline: s.analysisPipeline,
      overallScore,
      dimensionScores,
      reportId: canViewAnalysis ? (s.report?.id ?? null) : null,
      reportStatus: canViewAnalysis ? (s.report?.status ?? null) : null,
      keyInsights: canViewAnalysis ? clip(s.keyInsights) : null,
      swot: canViewAnalysis ? readSwot(s.swotAnalysis ?? null) : null,
      careerPaths: canViewAnalysis ? readCareer(s.careerPaths ?? null) : null,
    };
  });

  const events: HistoryEvent[] = [];
  if (personnel.hireDate) {
    events.push({ id: `hired-${personnel.id}`, type: "HIRED", date: personnel.hireDate.toISOString() });
  } else {
    events.push({
      id: `created-${personnel.id}`,
      type: "RECORD_CREATED",
      date: personnel.createdAt.toISOString(),
    });
  }
  if (personnel.status === "TERMINATED" && personnel.terminationDate) {
    events.push({
      id: `terminated-${personnel.id}`,
      type: "TERMINATED",
      date: personnel.terminationDate.toISOString(),
      reason: personnel.terminationReason,
      note: personnel.terminationNote,
    });
  }

  // 360° dönem sonuçları: yalnız kapanmış (sonucu dondurulmuş) dönemler. Devam eden dönemin
  // anlık sonucu dönem panosundan görülür; geçmişe kesinleşmiş sonuç girer.
  const subjects = await prisma.reviewSubject.findMany({
    where: { personnelId, cycle: { organizationId, status: "CLOSED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      releasedAt: true,
      cycle: { select: { id: true, name: true, periodStart: true, periodEnd: true, closedAt: true } },
    },
  });
  const reviews: HistoryReviewResult[] = [];
  for (const sub of subjects) {
    const base: HistoryReviewResult = {
      id: sub.id,
      cycleId: sub.cycle.id,
      cycleName: sub.cycle.name,
      periodStart: iso(sub.cycle.periodStart),
      periodEnd: iso(sub.cycle.periodEnd),
      closedAt: iso(sub.cycle.closedAt),
      releasedAt: iso(sub.releasedAt),
      released: sub.status === "RELEASED",
      overallScore: null,
      selfScore: null,
      othersScore: null,
      dimensionScores: null,
      completedRaters: null,
      totalRaters: null,
    };
    if (canViewAnalysis) {
      // Rol kontrolü çağıranda yapıldı (canViewAnalysis = ROLE_GROUPS.analyze)
      const r = await getSubjectResults(sub.id, {
        viewer: { kind: "admin", organizationId, role: "ANALYST" },
      });
      const dims: DimensionScores = {};
      for (const d of r.dimensions) if (d.weighted !== null) dims[d.dimension] = d.weighted;
      base.overallScore = r.overall.weighted;
      base.selfScore = r.overall.self;
      base.othersScore = r.overall.others;
      base.dimensionScores = Object.keys(dims).length > 0 ? dims : null;
      base.completedRaters = r.completedRaters;
      base.totalRaters = r.totalRaters;
    }
    reviews.push(base);
  }

  const timeline: HistoryTimelineEntry[] = [
    ...events.map((e) => ({ kind: "event" as const, id: e.id, date: e.date, eventId: e.id })),
    ...rows.map((s) => ({
      kind: "session" as const,
      id: `session-${s.id}`,
      date: sessionDate(s).toISOString(),
      sessionId: s.id,
    })),
    ...reviews.map((r) => ({
      kind: "review" as const,
      id: `review-${r.id}`,
      date: r.releasedAt ?? r.closedAt ?? r.periodEnd ?? new Date(0).toISOString(),
      reviewId: r.id,
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // en yeni üstte

  // Trend: skoru olan tamamlanmış oturumlar, eskiden yeniye
  const points: HistoryTrendPoint[] = canViewAnalysis
    ? sessions
        .filter((s) => s.status === "COMPLETED" && s.dimensionScores)
        .map((s) => ({
          sessionId: s.id,
          date: s.completedAt ?? s.createdAt,
          label: s.assessment.title,
          overall: s.overallScore,
          scores: Object.fromEntries(
            DIMENSIONS.map((d) => [d, s.dimensionScores?.[d] ?? null]),
          ) as Record<Dimension, number | null>,
        }))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    : [];

  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const completedDates = completed
    .map((s) => s.completedAt)
    .filter((d): d is string => !!d)
    .sort();
  const overalls = points.map((p) => p.overall).filter((v): v is number => v !== null);
  const averageOverall =
    overalls.length > 0
      ? Math.round((overalls.reduce((a, b) => a + b, 0) / overalls.length) * 10) / 10
      : null;

  return {
    personnelId: personnel.id,
    status: personnel.status,
    canViewAnalysis,
    summary: {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      approvedSessions: sessions.filter((s) => s.review?.status === "APPROVED").length,
      firstCompletedAt: completedDates[0] ?? null,
      lastCompletedAt: completedDates[completedDates.length - 1] ?? null,
      latestOverall: overalls.length > 0 ? overalls[overalls.length - 1]! : null,
      previousOverall: overalls.length > 1 ? overalls[overalls.length - 2]! : null,
      averageOverall,
    },
    // Liste en yeni üstte
    sessions: [...sessions].reverse(),
    events,
    reviews,
    timeline,
    trend: { dimensions: [...DIMENSIONS], points },
  };
}
