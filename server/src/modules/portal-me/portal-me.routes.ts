import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getOrgSettings, resolveShare } from "../../lib/sharing.js";
import {
  DIMENSIONS,
  computeOverallScore,
  readDimensionScores,
  type Dimension,
} from "../../services/scoring.service.js";
import { getSessionSnapshot } from "../../services/session-questions.service.js";
import { portalSessionWhere } from "../sessions/sessions.routes.js";
import {
  getPendingReviewTasks,
  getSharedCareerPlan,
  getSharedReviewResults,
} from "../../services/portal-performance.service.js";

/**
 * Personel portalı "Panelim" uç noktaları (prefix: /api/portal/me)
 *
 * Tümü `authenticatePortal` arkasındadır ve YALNIZ token sahibinin (request.user.sub)
 * kendi kayıtlarını döndürür; istemciden kişi/oturum kimliği alınmaz.
 *
 * Paylaşım kontrolü sunucuda yapılır: sonuç ancak etkin paylaşım değeri true,
 * oturum COMPLETED, İK incelemesi APPROVED ve rapor READY ise döner. Ham cevaplar,
 * psikolojik analiz, inceleme yorumları ve IP gibi alanlar hiçbir zaman dönmez.
 */

const MAX_TEXT = 4000;
const MAX_ITEMS = 12;

function text(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t.slice(0, max) : null;
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => text(v, 600))
    .filter((v): v is string => v !== null)
    .slice(0, MAX_ITEMS);
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export interface PortalDimensionScore {
  dimension: Dimension;
  score: number;
}

export interface PortalDevelopmentArea {
  area: string;
  recommendation: string | null;
}

export interface PortalCareerPaths {
  shortTerm: string | null;
  midTerm: string | null;
  longTerm: string | null;
}

/** Personele gösterilebilen HR/PDR sonucu (beyaz liste) */
export interface PortalAssessmentResult {
  sessionId: string;
  assessment: { id: string; title: string };
  completedAt: Date | null;
  reportGeneratedAt: Date | null;
  overallScore: number | null;
  dimensionScores: PortalDimensionScore[];
  executiveSummary: string | null;
  strengths: string[];
  developmentAreas: PortalDevelopmentArea[];
  careerPaths: PortalCareerPaths | null;
}

const resultSessionSelect = {
  id: true,
  completedAt: true,
  dimensionScores: true,
  swotAnalysis: true,
  careerPaths: true,
  hrPdrAnalysis: true,
  assessment: { select: { id: true, title: true, shareWithEmployee: true } },
  report: {
    select: { status: true, executiveSummary: true, fullReportJson: true, generatedAt: true },
  },
} satisfies Prisma.AssessmentSessionSelect;

type ResultSessionRow = Prisma.AssessmentSessionGetPayload<{ select: typeof resultSessionSelect }>;

/**
 * Rapor anındaki anlık görüntü (fullReportJson) esas alınır: personel, İK'nın onaylayıp
 * raporladığı içeriği görür. Eski raporlarda eksik alanlar oturumdan tamamlanır.
 */
export function toPortalResult(row: ResultSessionRow): PortalAssessmentResult {
  const snap = obj(row.report?.fullReportJson) ?? {};
  const hrPdr = obj(snap["hrPdrAnalysis"]) ?? obj(row.hrPdrAnalysis);
  const swot = obj(snap["swotAnalysis"]) ?? obj(row.swotAnalysis);
  const career = obj(snap["careerPaths"]) ?? obj(row.careerPaths);

  const scores = readDimensionScores(snap["dimensionScores"]) ?? readDimensionScores(row.dimensionScores);
  const storedOverall = snap["overallScore"];
  const overallScore =
    typeof storedOverall === "number" && Number.isFinite(storedOverall)
      ? storedOverall
      : computeOverallScore(scores);

  const strengths = textList(swot?.["strengths"]).length
    ? textList(swot?.["strengths"])
    : textList(hrPdr?.["strengths"]);

  let developmentAreas: PortalDevelopmentArea[] = [];
  if (Array.isArray(hrPdr?.["developmentAreas"])) {
    developmentAreas = (hrPdr["developmentAreas"] as unknown[])
      .map((d) => {
        const o = obj(d);
        const area = text(o?.["area"], 600);
        return area ? { area, recommendation: text(o?.["recommendation"], 1200) } : null;
      })
      .filter((d): d is PortalDevelopmentArea => d !== null)
      .slice(0, MAX_ITEMS);
  }
  if (developmentAreas.length === 0) {
    developmentAreas = textList(swot?.["weaknesses"]).map((area) => ({ area, recommendation: null }));
  }

  const careerPaths: PortalCareerPaths | null = career
    ? {
        shortTerm: text(career["shortTerm"]),
        midTerm: text(career["midTerm"]),
        longTerm: text(career["longTerm"]),
      }
    : null;

  return {
    sessionId: row.id,
    assessment: { id: row.assessment.id, title: row.assessment.title },
    completedAt: row.completedAt,
    reportGeneratedAt: row.report?.generatedAt ?? null,
    overallScore,
    dimensionScores: DIMENSIONS.filter((d) => typeof scores?.[d] === "number").map((d) => ({
      dimension: d,
      score: scores![d]!,
    })),
    executiveSummary: text(row.report?.executiveSummary),
    strengths,
    developmentAreas,
    careerPaths:
      careerPaths && (careerPaths.shortTerm || careerPaths.midTerm || careerPaths.longTerm)
        ? careerPaths
        : null,
  };
}

/**
 * Kişinin paylaşılan HR/PDR sonuçları. Paylaşım filtresi hem sorguda hem de
 * `resolveShare` ile tekrar uygulanır (tek kaynak kural: lib/sharing.ts).
 */
export async function getSharedAssessmentResults(
  personnelId: string,
  organizationId: string,
  shareResultsDefault: boolean,
): Promise<PortalAssessmentResult[]> {
  const rows = await prisma.assessmentSession.findMany({
    where: {
      personnelId,
      personnel: { organizationId, deletedAt: null },
      status: "COMPLETED",
      analysisReview: { is: { status: "APPROVED" } },
      report: { is: { status: "READY" } },
      assessment: {
        organizationId,
        // Varsayılan açıksa: açıkça "paylaşma" denmemiş olanlar (true veya null)
        OR: shareResultsDefault
          ? [{ shareWithEmployee: true }, { shareWithEmployee: null }]
          : [{ shareWithEmployee: true }],
      },
    },
    orderBy: { completedAt: "desc" },
    select: resultSessionSelect,
  });

  return rows
    .filter((r) => resolveShare(r.assessment.shareWithEmployee, shareResultsDefault))
    .map(toPortalResult);
}

const portalMeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticatePortal);

  // ── GET / — Profil özeti ─────────────────────
  fastify.get("/", async (request, reply) => {
    const personnel = await prisma.personnel.findFirst({
      where: { id: request.user.sub, organizationId: request.user.orgId!, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeId: true,
        position: true,
        department: { select: { name: true } },
        team: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });
    if (!personnel) {
      return reply.status(404).send({
        code: "NOT_FOUND",
        message: "Personel kaydı bulunamadı",
        traceId: request.traceId,
      });
    }
    return reply.send({
      data: {
        id: personnel.id,
        firstName: personnel.firstName,
        lastName: personnel.lastName,
        employeeId: personnel.employeeId,
        position: personnel.position,
        department: personnel.department?.name ?? null,
        team: personnel.team?.name ?? null,
        organization: personnel.organization.name,
      },
    });
  });

  // ── GET /tasks — Bekleyen HR/PDR testleri ────
  // Portal test akışıyla aynı kural (portalSessionWhere): aktif değerlendirme,
  // süresi geçmemiş NOT_STARTED ya da yarım kalan IN_PROGRESS oturumlar.
  fastify.get("/tasks", async (request, reply) => {
    const sessions = await prisma.assessmentSession.findMany({
      where: portalSessionWhere(request.user.sub, new Date()),
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        startedAt: true,
        dueAt: true,
        questionSetSnapshot: true,
        assessment: {
          select: { id: true, title: true, description: true, endsAt: true, questionSetId: true },
        },
        _count: { select: { answers: true } },
      },
    });

    // Portal akışı yarım kalanı önce açar; listede de aynı sıra izlenir
    sessions.sort((a, b) => Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS"));

    const data = await Promise.all(
      sessions.map(async (s) => {
        const snapshot = await getSessionSnapshot(s);
        return {
          sessionId: s.id,
          status: s.status,
          startedAt: s.startedAt,
          dueAt: s.dueAt ?? s.assessment.endsAt,
          assessment: {
            id: s.assessment.id,
            title: s.assessment.title,
            description: s.assessment.description,
          },
          questionCount: snapshot.questions.length,
          answeredCount: Math.min(s._count.answers, snapshot.questions.length),
        };
      }),
    );

    // 360° değerlendirici görevleri (bu kişinin değerlendirmesi beklenenler)
    const reviews = await getPendingReviewTasks(request.user.sub);
    return reply.send({ data: { assessments: data, reviews } });
  });

  // ── GET /results — Paylaşılan sonuçlar ───────
  fastify.get("/results", async (request, reply) => {
    const personnelId = request.user.sub;
    const orgId = request.user.orgId!;
    const settings = await getOrgSettings(orgId);

    const assessments = await getSharedAssessmentResults(personnelId, orgId, settings.shareResultsDefault);

    return reply.send({
      data: {
        assessments,
        // Yayınlanmış ve etkin paylaşımı açık 360° sonuçları (anonimlik eşiği uygulanmış)
        reviews: await getSharedReviewResults(personnelId, orgId, settings.shareResultsDefault),
        // Onaylı ve etkin paylaşımı açık en güncel kariyer planı
        careerPlan: await getSharedCareerPlan(personnelId, orgId, settings.shareResultsDefault),
      },
    });
  });
};

export default portalMeRoutes;
