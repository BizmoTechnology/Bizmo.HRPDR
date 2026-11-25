import { api } from "./api";

/** GET /api/portal/me — sunucu: server/src/modules/portal-me/portal-me.routes.ts */
export interface PortalProfile {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  position: string;
  department: string | null;
  team: string | null;
  organization: string;
}

export interface PortalTask {
  sessionId: string;
  status: "NOT_STARTED" | "IN_PROGRESS";
  startedAt: string | null;
  dueAt: string | null;
  assessment: { id: string; title: string; description: string | null };
  questionCount: number;
  answeredCount: number;
}

/** 360° değerlendirici görevi (sunucu: services/portal-performance.service.ts) */
export interface PortalReviewTask {
  assignmentId: string;
  status: "NOT_STARTED" | "IN_PROGRESS";
  relation: "SELF" | "MANAGER" | "PEER" | "SUBORDINATE";
  subject: { firstName: string; lastName: string; position: string };
  cycle: { id: string; name: string; dueAt: string | null };
  questionCount: number;
  answeredCount: number;
}

export interface PortalTasks {
  assessments: PortalTask[];
  /** Bekleyen 360° değerlendirici görevleri */
  reviews: PortalReviewTask[];
}

export interface PortalAssessmentResult {
  sessionId: string;
  assessment: { id: string; title: string };
  completedAt: string | null;
  reportGeneratedAt: string | null;
  overallScore: number | null;
  dimensionScores: { dimension: string; score: number }[];
  executiveSummary: string | null;
  strengths: string[];
  developmentAreas: { area: string; recommendation: string | null }[];
  careerPaths: { shortTerm: string | null; midTerm: string | null; longTerm: string | null } | null;
}

export interface PortalReviewItem {
  text: string;
  dimension: string;
  self: number | null;
  others: number | null;
}

/** Yayınlanmış ve paylaşılan 360° sonucu; eşik altındaki gruplar `visible: false` ve puansız */
export interface PortalReviewResult {
  subjectId: string;
  cycle: { id: string; name: string; periodStart: string | null; periodEnd: string | null };
  releasedAt: string | null;
  anonymityMinRaters: number;
  overall: { self: number | null; others: number | null; weighted: number | null };
  groups: Array<{
    relation: PortalReviewTask["relation"];
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
  comments: Array<{ relation: PortalReviewTask["relation"]; questionText: string; text: string }>;
}

export interface PortalCareerPlan {
  id: string;
  version: number;
  targetRole: string | null;
  horizonMonths: number;
  approvedAt: string | null;
  steps: Array<{ id: string; title: string; type: string; targetDate: string | null; status: string }>;
}

export interface PortalResults {
  assessments: PortalAssessmentResult[];
  /** Yayınlanmış ve paylaşılan 360° sonuçları */
  reviews: PortalReviewResult[];
  /** Onaylı ve paylaşılan kariyer yol haritası */
  careerPlan: PortalCareerPlan | null;
}

export const getProfile = () =>
  api.get<{ data: PortalProfile }>("/api/portal/me").then((r) => r.data.data);

export const getTasks = () =>
  api.get<{ data: PortalTasks }>("/api/portal/me/tasks").then((r) => r.data.data);

export const getResults = () =>
  api.get<{ data: PortalResults }>("/api/portal/me/results").then((r) => r.data.data);
