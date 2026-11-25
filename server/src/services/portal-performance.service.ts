/**
 * Personel portalı "Panelim" için 360° ve kariyer planı verisi (Aşama 1/3 ↔ Aşama 4).
 *
 * Kurallar:
 * - Yalnız oturumdaki personelin kendi kaydı (çağıran `request.user.sub` verir).
 * - 360° sonucu ancak İK yayınladıysa (RELEASED) ve etkin paylaşım açıksa döner:
 *   `resolveShare(cycle.shareWithEmployee, org.shareResultsDefault)`. Varsayılan: paylaşma.
 * - Kariyer planı ancak APPROVED ve etkin paylaşım açıksa döner.
 * - Alanlar beyaz listelidir: değerlendirici adı, özensiz değerlendirici işareti, ham cevap,
 *   AI önerisi ham metni, kaynak özeti ve İK notları dönmez. Anonimlik eşiği
 *   `getSubjectResults()` içinde uygulanır.
 */
import { prisma } from "../lib/prisma.js";
import { resolveShare } from "../lib/sharing.js";
import { getSubjectResults, type ReviewRelationKey } from "./review-results.service.js";
import { parseSnapshot } from "./session-questions.service.js";

export interface PortalReviewTask {
  assignmentId: string;
  status: "NOT_STARTED" | "IN_PROGRESS";
  relation: ReviewRelationKey;
  subject: { firstName: string; lastName: string; position: string };
  cycle: { id: string; name: string; dueAt: string | null };
  questionCount: number;
  answeredCount: number;
}

/** Değerlendiricinin bekleyen 360° görevleri (dönem devam ediyor) */
export async function getPendingReviewTasks(raterId: string): Promise<PortalReviewTask[]> {
  const rows = await prisma.reviewAssignment.findMany({
    where: {
      raterPersonnelId: raterId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      subject: { cycle: { status: "ACTIVE" }, personnel: { deletedAt: null } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      relation: true,
      questionSetSnapshot: true,
      _count: { select: { answers: true } },
      subject: {
        select: {
          personnel: { select: { firstName: true, lastName: true, position: true } },
          cycle: { select: { id: true, name: true, dueAt: true, questionSetSnapshot: true } },
        },
      },
    },
  });
  // Yarım kalanlar önce
  rows.sort((a, b) => Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS"));
  return rows.map((a) => {
    const snap = parseSnapshot(a.questionSetSnapshot) ?? parseSnapshot(a.subject.cycle.questionSetSnapshot);
    const total = snap?.questions.length ?? 0;
    return {
      assignmentId: a.id,
      status: a.status as "NOT_STARTED" | "IN_PROGRESS",
      relation: a.relation,
      subject: a.subject.personnel,
      cycle: {
        id: a.subject.cycle.id,
        name: a.subject.cycle.name,
        dueAt: a.subject.cycle.dueAt?.toISOString() ?? null,
      },
      questionCount: total,
      answeredCount: total > 0 ? Math.min(a._count.answers, total) : a._count.answers,
    };
  });
}

interface PortalReviewItem {
  text: string;
  dimension: string;
  self: number | null;
  others: number | null;
}

export interface PortalReviewResult {
  subjectId: string;
  cycle: { id: string; name: string; periodStart: string | null; periodEnd: string | null };
  releasedAt: string | null;
  anonymityMinRaters: number;
  overall: { self: number | null; others: number | null; weighted: number | null };
  groups: Array<{
    relation: ReviewRelationKey;
    label: string;
    completed: number;
    visible: boolean;
    hiddenReason: "INSUFFICIENT_RATERS" | "NO_RATERS" | null;
    overall: number | null;
  }>;
  dimensions: Array<{
    dimension: string;
    self: number | null;
    others: number | null;
    weighted: number | null;
    gap: number | null;
  }>;
  strengths: PortalReviewItem[];
  developmentAreas: PortalReviewItem[];
  blindSpots: PortalReviewItem[];
  hiddenStrengths: PortalReviewItem[];
  /** Karıştırılmış yorumlar; yazar bilgisi dönmez, yalnız grup */
  comments: Array<{ relation: ReviewRelationKey; questionText: string; text: string }>;
}

const toItem = (i: { text: string; dimension: string; self: number | null; others: number | null }) => ({
  text: i.text,
  dimension: i.dimension,
  self: i.self,
  others: i.others,
});

/** Yayınlanmış ve paylaşılan 360° sonuçları (en yeni üstte) */
export async function getSharedReviewResults(
  personnelId: string,
  organizationId: string,
  shareDefault: boolean,
): Promise<PortalReviewResult[]> {
  const subjects = await prisma.reviewSubject.findMany({
    where: { personnelId, status: "RELEASED", cycle: { organizationId, status: "CLOSED" } },
    orderBy: { releasedAt: "desc" },
    select: { id: true, cycle: { select: { shareWithEmployee: true } } },
  });

  const out: PortalReviewResult[] = [];
  for (const s of subjects) {
    if (!resolveShare(s.cycle.shareWithEmployee, shareDefault)) continue;
    const r = await getSubjectResults(s.id, {
      viewer: { kind: "employee", organizationId, personnelId },
    });
    out.push({
      subjectId: r.subject.id,
      cycle: {
        id: r.cycle.id,
        name: r.cycle.name,
        periodStart: r.cycle.periodStart,
        periodEnd: r.cycle.periodEnd,
      },
      releasedAt: r.subject.releasedAt,
      anonymityMinRaters: r.anonymityMinRaters,
      overall: r.overall,
      groups: r.groups.map((g) => ({
        relation: g.relation,
        label: g.label,
        completed: g.completed,
        visible: g.visible,
        hiddenReason: g.hiddenReason,
        overall: g.overall,
      })),
      dimensions: r.dimensions.map((d) => ({
        dimension: d.dimension,
        self: d.self,
        others: d.others,
        weighted: d.weighted,
        gap: d.gap,
      })),
      strengths: r.strengths.map(toItem),
      developmentAreas: r.developmentAreas.map(toItem),
      blindSpots: r.blindSpots.map(toItem),
      hiddenStrengths: r.hiddenStrengths.map(toItem),
      comments: r.comments.map((c) => ({ relation: c.relation, questionText: c.questionText, text: c.text })),
    });
  }
  return out;
}

export interface PortalCareerStep {
  id: string;
  title: string;
  type: string;
  targetDate: string | null;
  status: string;
}

export interface PortalCareerPlan {
  id: string;
  version: number;
  targetRole: string | null;
  horizonMonths: number;
  approvedAt: string | null;
  steps: PortalCareerStep[];
}

function readPortalSteps(value: unknown): PortalCareerStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
    .map((s) => ({
      id: String(s["id"] ?? ""),
      title: typeof s["title"] === "string" ? s["title"] : "",
      type: typeof s["type"] === "string" ? s["type"] : "OTHER",
      targetDate: typeof s["targetDate"] === "string" ? s["targetDate"] : null,
      status: typeof s["status"] === "string" ? s["status"] : "TODO",
      // `note` İK'nın iç notudur; personelle paylaşılmaz
    }))
    .filter((s) => s.title.trim().length > 0);
}

/** En güncel onaylı ve paylaşılan kariyer planı; yoksa null */
export async function getSharedCareerPlan(
  personnelId: string,
  organizationId: string,
  shareDefault: boolean,
): Promise<PortalCareerPlan | null> {
  const plan = await prisma.careerPlan.findFirst({
    where: { personnelId, organizationId, status: "APPROVED" },
    orderBy: [{ approvedAt: "desc" }, { version: "desc" }],
    select: {
      id: true,
      version: true,
      targetRole: true,
      horizonMonths: true,
      approvedAt: true,
      steps: true,
      shareWithEmployee: true,
    },
  });
  if (!plan || !resolveShare(plan.shareWithEmployee, shareDefault)) return null;
  return {
    id: plan.id,
    version: plan.version,
    targetRole: plan.targetRole,
    horizonMonths: plan.horizonMonths,
    approvedAt: plan.approvedAt?.toISOString() ?? null,
    steps: readPortalSteps(plan.steps),
  };
}
