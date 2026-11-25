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

export interface PortalTasks {
  assessments: PortalTask[];
  /** TODO(entegrasyon): 360° değerlendirici görevleri */
  reviews: unknown[];
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

export interface PortalResults {
  assessments: PortalAssessmentResult[];
  /** TODO(entegrasyon): yayınlanmış ve paylaşılan 360° sonuçları */
  reviews: unknown[];
  /** TODO(entegrasyon): onaylı ve paylaşılan kariyer planı */
  careerPlan: unknown | null;
}

export const getProfile = () =>
  api.get<{ data: PortalProfile }>("/api/portal/me").then((r) => r.data.data);

export const getTasks = () =>
  api.get<{ data: PortalTasks }>("/api/portal/me/tasks").then((r) => r.data.data);

export const getResults = () =>
  api.get<{ data: PortalResults }>("/api/portal/me/results").then((r) => r.data.data);
