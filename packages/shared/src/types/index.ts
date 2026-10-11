// ─────────────────────────────────────────
// ENUM TYPES (Prisma enum'larının mirror'ı)
// ─────────────────────────────────────────

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "HR_MANAGER"
  | "ANALYST"
  | "VIEWER";

export type PersonnelStatus = "ACTIVE" | "INACTIVE" | "ON_LEAVE";

export type PersonnelShift =
  | "NONE"
  | "MORNING"
  | "AFTERNOON"
  | "NIGHT"
  | "ROTATING";

export type QuestionDimension =
  | "LOGICAL_ALGORITHMIC"
  | "LEADERSHIP"
  | "SOCIAL_INTELLIGENCE"
  | "GROWTH_POTENTIAL"
  | "DOMAIN_ALIGNMENT";

export type QuestionType =
  | "OPEN_ENDED"
  | "SITUATIONAL"
  | "BEHAVIORAL"
  | "SCALE"
  | "MULTIPLE_CHOICE";

export type QuestionPhase = "ICEBREAKER" | "CORE" | "CLOSING";

export type AssessmentStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "ARCHIVED";

export type SessionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PAUSED"
  | "COMPLETED"
  | "EXPIRED";

export type AnalysisPipelineStatus =
  | "NOT_QUEUED"
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type ReportStatus = "GENERATING" | "READY" | "FAILED";

export type AiProvider =
  | "CLAUDE"
  | "OPENAI"
  | "GEMINI"
  | "ABACUS";

export type AnalysisReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type SessionEventType =
  | "SESSION_CREATED"
  | "SESSION_STARTED"
  | "ANSWER_SAVED"
  | "FOLLOWUP_REQUESTED"
  | "SESSION_PAUSED"
  | "SESSION_RESUMED"
  | "SESSION_COMPLETED"
  | "ANALYSIS_QUEUED"
  | "ANALYSIS_COMPLETED"
  | "ANALYSIS_FAILED"
  | "REPORT_QUEUED"
  | "REPORT_READY";

// ─────────────────────────────────────────
// DOMAIN TYPES
// ─────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  organizationId: string;
  scopedDepartmentId: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  departmentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Personnel {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string;
  experienceYear: number;
  status: PersonnelStatus;
  departmentId: string | null;
  teamId: string | null;
  organizationId: string;
  shift: PersonnelShift;
  preferredLanguage: string;
  hireDate: string | null;
  birthDate: string | null;
  notes: string | null;
  avatarUrl: string | null;
  importSource: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  team?: Team;
}

export interface Question {
  id: string;
  text: string;
  subText: string | null;
  dimension: QuestionDimension;
  type: QuestionType;
  phase: QuestionPhase;
  weight: number;
  followUpPrompt: string | null;
  options: Record<string, string> | null;
  minScale: number | null;
  maxScale: number | null;
  isActive: boolean;
  isAiGenerated: boolean;
  aiModel: string | null;
  tags: string[];
  language: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionSet {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefault: boolean;
  version: number;
  createdById: string;
  organizationId: string;
  weightLogical: number;
  weightLeadership: number;
  weightSocial: number;
  weightGrowth: number;
  weightDomain: number;
  createdAt: string;
  updatedAt: string;
  items?: QuestionSetItem[];
}

export interface QuestionSetItem {
  id: string;
  questionSetId: string;
  questionId: string;
  order: number;
  isRequired: boolean;
  customWeight: number | null;
  question?: Question;
}

export interface Assessment {
  id: string;
  title: string;
  description: string | null;
  status: AssessmentStatus;
  questionSetId: string;
  createdById: string;
  organizationId: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentSession {
  id: string;
  assessmentId: string;
  personnelId: string;
  status: SessionStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationSec: number | null;
  dueAt: string | null;
  requiresHrReview: boolean;
  analysisPipeline: AnalysisPipelineStatus;
  dimensionScores: DimensionScores | null;
  swotAnalysis: SwotAnalysis | null;
  careerPaths: CareerPaths | null;
  keyInsights: string | null;
  analysisModel: string | null;
  createdAt: string;
  updatedAt: string;
  personnel?: Personnel;
  assessment?: Assessment;
}

export interface Answer {
  id: string;
  sessionId: string;
  questionId: string;
  textAnswer: string | null;
  scaleValue: number | null;
  choiceKey: string | null;
  durationSec: number | null;
  aiScore: number | null;
  followUpAsked: boolean;
  followUpAnswer: string | null;
  clientDedupeKey: string | null;
  answeredAt: string;
}

// ─────────────────────────────────────────
// AI OUTPUT TYPES
// ─────────────────────────────────────────

export interface DimensionScore {
  score: number;
  evidence: string;
  commentary: string;
}

export interface DimensionScores {
  LOGICAL_ALGORITHMIC: DimensionScore;
  LEADERSHIP: DimensionScore;
  SOCIAL_INTELLIGENCE: DimensionScore;
  GROWTH_POTENTIAL: DimensionScore;
  DOMAIN_ALIGNMENT: DimensionScore;
}

export interface SwotAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface CareerPaths {
  shortTerm: string;
  midTerm: string;
  longTerm: string;
}

export interface LeadershipPotential {
  type: string;
  score: number;
  rationale: string;
}

export interface AnalysisOutput {
  dimensionScores: DimensionScores;
  swot: SwotAnalysis;
  careerPath: CareerPaths;
  leadershipPotential: LeadershipPotential;
  keyInsights: string;
  personalMessage: string;
}

export interface Report {
  id: string;
  sessionId: string;
  personnelId: string;
  generatedById: string | null;
  status: ReportStatus;
  executiveSummary: string | null;
  pdfUrl: string | null;
  generatedAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string | null;
  personnelId: string | null;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ─────────────────────────────────────────
// API RESPONSE WRAPPER
// ─────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    hasNextPage?: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  traceId?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string;
}
