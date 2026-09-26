import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreatePersonnelInput, UpdatePersonnelInput } from "@ph/shared";

/* ─── helpers ─── */

function get<T>(url: string) {
  return api.get<{ data: T }>(url).then((r) => r.data.data);
}

/** Sunucu `{ data: T[], meta }` döndüğünde sayfalandırılmış sonuç */
async function getPaginated<T>(url: string): Promise<{
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const r = await api.get<{
    data: T[];
    meta: { total: number; page: number; pageSize: number };
  }>(url);
  return {
    items: r.data.data,
    total: r.data.meta.total,
    page: r.data.meta.page,
    pageSize: r.data.meta.pageSize,
  };
}

/* ─── query keys ─── */

export const qk = {
  dashboard: ["dashboard-stats"] as const,
  personnel: (params?: Record<string, unknown>) =>
    ["personnel", params ?? {}] as const,
  personnelDetail: (id: string) => ["personnel", id] as const,
  personnelStats: ["personnel-stats"] as const,
  departments: ["departments"] as const,
  teams: (departmentId?: string | null) =>
    ["teams", departmentId ?? "all"] as const,
  aiChatConversations: ["ai-chat-conversations"] as const,
  aiChatDetail: (id: string) => ["ai-chat", id] as const,
};

/* ─── Dashboard ─── */

export function useDashboardStats() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => get<DashboardStats>("/api/analytics/dashboard"),
  });
}

/* ─── Personnel ─── */

export interface PersonnelListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  departmentId?: string;
}

export function usePersonnelList(params: PersonnelListParams = {}) {
  return useQuery({
    queryKey: qk.personnel(params as unknown as Record<string, unknown>),
    queryFn: () =>
      getPaginated<PersonnelRow>(
        "/api/personnel?" + toQS(params as unknown as Record<string, unknown>),
      ),
  });
}

export function usePersonnel(id: string) {
  return useQuery({
    queryKey: qk.personnelDetail(id),
    queryFn: () => get<PersonnelDetail>(`/api/personnel/${id}`),
    enabled: !!id,
  });
}

export function usePersonnelStats() {
  return useQuery({
    queryKey: qk.personnelStats,
    queryFn: () => get<PersonnelStatsData>("/api/personnel/stats"),
  });
}

export function useCreatePersonnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePersonnelInput) =>
      api.post("/api/personnel", data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personnel"] }),
  });
}

export function useUpdatePersonnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdatePersonnelInput;
    }) => api.put(`/api/personnel/${id}`, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personnel"] }),
  });
}

export function useDeletePersonnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/personnel/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personnel"] }),
  });
}

/* ─── Departments & Teams ─── */

export function useSetPortalPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.post(`/api/personnel/${id}/portal-password`, { password }).then((r) => r.data.data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: qk.personnelDetail(id) }),
  });
}

export function useDepartmentList() {
  return useQuery({
    queryKey: qk.departments,
    queryFn: () => get<Department[]>("/api/departments"),
  });
}

export function useTeamsByDepartment(departmentId?: string | null) {
  return useQuery({
    queryKey: qk.teams(departmentId),
    queryFn: () =>
      get<Team[]>(
        departmentId
          ? `/api/teams?departmentId=${departmentId}`
          : "/api/teams"
      ),
    enabled: !!departmentId,
  });
}

/* ─── Assessments ─── */

export function useAssessmentList(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["assessments", params],
    queryFn: () => getPaginated<AssessmentRow>("/api/assessments?" + toQS(params)),
  });
}
export function useAssessment(id: string) {
  return useQuery({ queryKey: ["assessments", id], queryFn: () => get<AssessmentDetail>(`/api/assessments/${id}`), enabled: !!id });
}
export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: Record<string, unknown>) => api.post("/api/assessments", data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }) });
}
export function useUpdateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/api/assessments/${id}`, data).then((r) => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      void qc.invalidateQueries({ queryKey: ["assessments", id] });
    },
  });
}
export function useDeleteAssessment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/assessments/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["assessments"] }) });
}
export function useActivateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/api/assessments/${id}/activate`).then((r) => r.data.data),
    onSuccess: (_, id) => {
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      void qc.invalidateQueries({ queryKey: ["assessments", id] });
    },
  });
}
export function useAssignAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { personnelIds: string[]; dueAt?: string };
    }) => api.post(`/api/assessments/${id}/assign`, data).then((r) => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["assessments"] });
      void qc.invalidateQueries({ queryKey: ["assessments", id] });
      void qc.invalidateQueries({ queryKey: ["assessments", id, "sessions"] });
    },
  });
}
export function useAssessmentSessions(id: string, params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["assessments", id, "sessions", params],
    queryFn: () =>
      getPaginated<SessionRow>(
        `/api/assessments/${id}/sessions?` + toQS(params),
      ),
    enabled: !!id,
  });
}

/* ─── Question Sets ─── */

export function useQuestionSetList(params: Record<string, unknown> = {}) {
  return useQuery({ queryKey: ["question-sets", params], queryFn: () => get<QuestionSetRow[]>("/api/question-sets?" + toQS(params)) });
}
export function useQuestionSet(id: string) {
  return useQuery({ queryKey: ["question-sets", id], queryFn: () => get<QuestionSetDetail>(`/api/question-sets/${id}`), enabled: !!id });
}
export function useCreateQuestionSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post("/api/question-sets", data).then((r) => r.data.data),
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ["question-sets"] }),
  });
}

/** POST /api/question-sets/ai-suggest — soru havuzundan AI seçimi */
export interface QuestionSetAiSuggestResult {
  name: string;
  description?: string;
  weightLogical: number;
  weightLeadership: number;
  weightSocial: number;
  weightGrowth: number;
  weightDomain: number;
  questionIds: string[];
}

export function useSuggestQuestionSetAi() {
  return useMutation({
    mutationFn: (body: { brief: string; maxQuestions?: number }) =>
      api
        .post<{ data: QuestionSetAiSuggestResult }>(
          "/api/question-sets/ai-suggest",
          body,
        )
        .then((r) => r.data.data),
  });
}
export function useUpdateQuestionSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Record<string, unknown>;
    }) => api.put(`/api/question-sets/${id}`, data).then((r) => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["question-sets"] });
      void qc.invalidateQueries({ queryKey: ["question-sets", id] });
    },
  });
}
export function useDeleteQuestionSet() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/question-sets/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["question-sets"] }) });
}

/* ─── Questions ─── */

export function useQuestionList(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["questions", params],
    queryFn: () =>
      getPaginated<QuestionRow>("/api/questions?" + toQS(params)),
  });
}
export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: Record<string, unknown>) => api.post("/api/questions", data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["questions"] }) });
}
export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/api/questions/${id}`, data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["questions"] }) });
}
export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/questions/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["questions"] }) });
}

/* ─── AI Question Generation ─── */

export function useGenerateAiQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      dimension: string;
      questionTypes?: string[];
      count?: number;
      context?: string;
    }) =>
      api
        .post<{ data: QuestionRow[] }>("/api/questions/ai-generate", body)
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

/* ─── Sessions ─── */

export function useSession(id: string) {
  return useQuery({ queryKey: ["sessions", id], queryFn: () => get<SessionDetail>(`/api/sessions/${id}`), enabled: !!id });
}
export function useSessionEvents(id: string) {
  return useQuery({ queryKey: ["sessions", id, "events"], queryFn: () => get<SessionEvent[]>(`/api/sessions/${id}/events`), enabled: !!id });
}
export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: "PENDING" | "APPROVED" | "REJECTED"; comment?: string } }) =>
      api.post(`/api/sessions/${id}/review`, data).then((r) => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
  });
}

/* ─── Analytics ─── */

export function useDimensionStats() {
  return useQuery({ queryKey: ["analytics", "dimensions"], queryFn: () => get<DimensionStat[]>("/api/analytics/dimensions") });
}
export function useTrends() {
  return useQuery({ queryKey: ["analytics", "trends"], queryFn: () => get<TrendPoint[]>("/api/analytics/trends") });
}

export function useDepartmentDimensionBreakdown() {
  return useQuery({
    queryKey: ["analytics", "department-dimensions"],
    queryFn: () =>
      get<DepartmentDimensionBreakdownResponse>(
        "/api/analytics/department-dimensions",
      ),
  });
}

export function useMonthlyDimensionTrends() {
  return useQuery({
    queryKey: ["analytics", "monthly-dimensions"],
    queryFn: () =>
      get<MonthlyDimensionTrendsResponse>(
        "/api/analytics/monthly-dimensions",
      ),
  });
}

/* ─── Reports ─── */

export function useReportList(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ["reports", params],
    queryFn: () =>
      getPaginated<ReportRow>("/api/reports?" + toQS(params)),
  });
}
export function useReport(id: string) {
  return useQuery({ queryKey: ["reports", id], queryFn: () => get<ReportDetail>(`/api/reports/${id}`), enabled: !!id });
}
export function useSessionReport(sessionId: string | null) {
  return useQuery({
    queryKey: ["reports", "by-session", sessionId],
    queryFn: () =>
      get<{ id: string; status: string; generatedAt: string | null } | null>(
        `/api/reports/by-session/${sessionId}`,
      ),
    enabled: !!sessionId,
  });
}
export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<{ data: ReportDetail }>(`/api/reports/generate/${sessionId}`).then((r) => r.data.data),
    onSuccess: (report) => {
      void qc.invalidateQueries({ queryKey: ["reports"] });
      void qc.invalidateQueries({ queryKey: ["sessions", report.session?.id] });
      void qc.invalidateQueries({ queryKey: ["personnel"] });
    },
  });
}
export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/reports/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reports"] }),
  });
}

/* ─── AI Config ─── */

export function useAiConfigList() {
  return useQuery({ queryKey: ["ai-config"], queryFn: () => get<AiConfigRow[]>("/api/ai-config") });
}
export function useCreateAiConfig() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: Record<string, unknown>) => api.post("/api/ai-config", data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-config"] }) });
}
export function useUpdateAiConfig() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.put(`/api/ai-config/${id}`, data).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-config"] }) });
}
export function useTestAiConfig() {
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ data: { ok: boolean; latencyMs: number; sample: string } }>(`/api/ai-config/${id}/test`)
        .then((r) => r.data.data),
  });
}
export function useDeleteAiConfig() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/ai-config/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-config"] }) });
}
export function useSetDefaultAiConfig() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post(`/api/ai-config/${id}/set-default`).then(r => r.data.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-config"] }) });
}
export function useAiUsageStats(params: Record<string, unknown> = {}) {
  return useQuery({ queryKey: ["ai-usage", params], queryFn: () => get<AiUsageData>("/api/ai-config/usage?" + toQS(params)) });
}

export interface AbacusModelOption {
  id: string;
  label: string;
  description: string;
}

/** Abacus.AI RouteLLM — sunucu üzerinden listRouteLLMModels */
export function useListAbacusModels() {
  return useMutation({
    mutationFn: (body: { apiKey?: string; configId?: string }) =>
      api
        .post<{ data: AbacusModelOption[] }>(
          "/api/ai-config/list-abacus-models",
          body,
        )
        .then((r) => r.data.data),
  });
}

/* ─── Session AI Analysis ─── */

export function useRunSessionAiAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, analysisType }: { id: string; analysisType: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS" }) =>
      api.post(`/api/sessions/${id}/ai-analysis`, { analysisType }).then((r) => r.data.data),
    onSuccess: (_, { id }) => {
      void qc.invalidateQueries({ queryKey: ["sessions", id] });
    },
  });
}

/* ─── AI Prompt Templates ─── */

export function useAiPromptTemplates() {
  return useQuery({
    queryKey: ["ai-prompt-templates"],
    queryFn: () => get<AiPromptTemplateRow[]>("/api/ai-config/prompts"),
  });
}
export function useAiPromptDefaults() {
  return useQuery({
    queryKey: ["ai-prompt-defaults"],
    queryFn: () => get<Record<string, string>>("/api/ai-config/prompts/defaults"),
  });
}
export function useCreateAiPromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post("/api/ai-config/prompts", data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-prompt-templates"] }),
  });
}
export function useUpdateAiPromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.put(`/api/ai-config/prompts/${id}`, data).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-prompt-templates"] }),
  });
}
export function useDeleteAiPromptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/ai-config/prompts/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-prompt-templates"] }),
  });
}

/* ─── Notifications ─── */

type PaginatedNotifications = Awaited<
  ReturnType<typeof getPaginated<NotificationRow>>
>;

export function useNotificationList<
  TData = PaginatedNotifications,
>(
  params: Record<string, unknown> = {},
  options?: Omit<
    UseQueryOptions<PaginatedNotifications, Error, TData>,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () =>
      getPaginated<NotificationRow>("/api/notifications?" + toQS(params)),
    ...options,
  });
}
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post(`/api/notifications/${id}/read`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
}
export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post("/api/notifications/read-all").then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
}
export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/api/notifications/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
}

/* ─── helpers ─── */

function toQS(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

/* ─── Types ─── */

export interface DashboardStats {
  totalPersonnel: number;
  activePersonnel: number;
  totalAssessments: number;
  activeAssessments: number;
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  pendingSessions: number;
  completionRate: number;
  avgScore: number | null;
  recentSessions: RecentSession[];
  topPerformers: TopPerformer[];
  byDepartment: DepartmentStat[];
}

export interface RecentSession {
  id: string;
  personnel: { firstName: string; lastName: string };
  department: { name: string } | null;
  avgScore: number | null;
  completedAt: string;
}

export interface TopPerformer {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  avgScore: number;
}

export interface DepartmentStat {
  id: string;
  name: string;
  personnelCount: number;
  completedTests: number;
  avgScore: number | null;
}

export interface PersonnelRow {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  experienceYear: number;
  department: { id: string; name: string } | null;
}

export interface PersonnelDetail {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  position: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  experienceYear: number;
  shift: string;
  preferredLanguage: string;
  hireDate: string | null;
  birthDate: string | null;
  notes: string | null;
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  sessions: SessionBrief[];
  avgScore: number | null;
  hasPortalPassword: boolean;
}

export interface SessionBrief {
  id: string;
  assessment: { id: string; title: string };
  status: string;
  avgScore: number | null;
  completedAt: string | null;
  createdAt: string;
  reportId: string | null;
}

/** GET /api/personnel/stats yanıtı */
export interface PersonnelStatsData {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  byDepartment: {
    departmentId: string | null;
    departmentName: string | null;
    count: number;
  }[];
}

export interface Department {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  departmentId: string;
}

/* ─── Assessment Types ─── */

export interface AssessmentRow {
  id: string;
  title: string;
  status: string;
  questionSet?: { id?: string; name: string };
  sessionStats?: { total: number; completed: number; inProgress: number };
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface AssessmentDetail extends AssessmentRow {
  description: string | null;
  questionSetId: string;
  createdBy?: { name: string };
}

export interface SessionRow {
  id: string;
  personnel: { firstName: string; lastName: string; employeeId: string };
  status: string;
  avgScore: number | null;
  startedAt: string | null;
  completedAt: string | null;
  analysisPipeline: string;
  dimensionScores: Record<string, number> | null;
}

/* ─── Question Set Types ─── */

export interface QuestionSetRow {
  id: string;
  name: string;
  description: string | null;
  isActive?: boolean;
  isDefault: boolean;
  version: number;
  itemCount?: number;
  weightLogical?: number;
  weightLeadership?: number;
  weightSocial?: number;
  weightGrowth?: number;
  weightDomain?: number;
  _count?: { items: number };
  dimensionWeights: Record<string, number> | null;
}

export interface QuestionSetDetail extends QuestionSetRow {
  items: QuestionSetItemRow[];
}

export interface QuestionSetItemRow {
  id: string;
  order: number;
  isRequired: boolean;
  customWeight: number | null;
  question: QuestionRow;
}

/* ─── Question Types ─── */

export interface QuestionRow {
  id: string;
  text: string;
  dimension: string;
  type: string;
  phase: string;
  choicesJson: unknown | null;
  weight: number;
}

/* ─── Session Detail Types ─── */

export interface SessionDetail {
  id: string;
  status: string;
  personnel: { firstName: string; lastName: string; employeeId: string; email?: string; position?: string; department?: { id: string; name: string } | null };
  assessment: { title: string };
  dimensionScores: Record<string, number> | null;
  swotAnalysis: { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } | null;
  careerPaths: { shortTerm: string; midTerm: string; longTerm: string } | null;
  keyInsights: string | null;
  analysisPipeline: string;
  answers: AnswerRow[];
  startedAt: string | null;
  completedAt: string | null;
  hrPdrAnalysis: Record<string, unknown> | null;
  psychologicalAnalysis: Record<string, unknown> | null;
  analysisError?: string | null;
  requiresHrReview?: boolean;
  analysisReview?: {
    status: "PENDING" | "APPROVED" | "REJECTED";
    comment: string | null;
    decidedAt: string | null;
  } | null;
}

export interface AnswerRow {
  id: string;
  questionId: string;
  textAnswer: string | null;
  scaleValue: number | null;
  choiceKey: string | null;
  durationSec: number | null;
  aiScore: number | null;
  question?: { text: string; dimension: string };
}

export interface SessionEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

/* ─── Analytics Types ─── */

export interface DimensionStat {
  dimension: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface TrendPoint {
  month: string;
  completionCount: number;
  avgScore: number;
}

export interface DepartmentDimensionBreakdownResponse {
  departments: {
    departmentId: string;
    departmentName: string;
    sessionCount: number;
    averages: Record<string, { avg: number; count: number }>;
  }[];
}

export interface MonthlyDimensionTrendsResponse {
  points: {
    month: string;
    completionCount: number;
    dimensions: Record<string, number>;
  }[];
}

/* ─── Report Types ─── */

export interface ReportRow {
  id: string;
  status: string;
  personnel: { firstName: string; lastName: string; employeeId?: string; department?: { id: string; name: string } | null };
  session?: {
    id: string;
    status?: string;
    completedAt?: string;
    assessment?: { id: string; title: string };
  };
  generatedAt: string | null;
  createdAt: string;
  overallScore?: number | null;
  executiveSummary?: string | null;
}

export interface ReportAnswerRow {
  id: string;
  textAnswer: string | null;
  scaleValue: number | null;
  choiceKey: string | null;
  followUpAnswer: string | null;
  answeredAt: string;
  durationSec: number | null;
  question: {
    text: string;
    subText: string | null;
    dimension: string;
    type: string;
    phase: string;
    options: unknown;
  } | null;
}

export interface ReportDetail extends Omit<ReportRow, "session" | "personnel"> {
  executiveSummary: string | null;
  fullReportJson: {
    overallScore?: number | null;
    dimensionScores?: Record<string, number> | null;
    dimensionWeights?: Record<string, number> | null;
    [key: string]: unknown;
  } | null;
  pdfUrl: string | null;
  generatedBy?: { id: string; name: string } | null;
  personnel: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    email?: string;
    position?: string;
    department?: { id: string; name: string } | null;
  };
  session: {
    id: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    durationSec: number | null;
    dimensionScores: Record<string, number> | null;
    swotAnalysis: { strengths?: string[]; weaknesses?: string[]; opportunities?: string[]; threats?: string[] } | null;
    careerPaths: { shortTerm?: string; midTerm?: string; longTerm?: string } | null;
    keyInsights: string | null;
    analysisPipeline: string;
    hrPdrAnalysis?: Record<string, unknown> | null;
    psychologicalAnalysis?: Record<string, unknown> | null;
    answers?: ReportAnswerRow[];
    assessment: { id: string; title: string; description?: string | null };
    analysisReview?: {
      status: string;
      comment: string | null;
      decidedAt: string | null;
      reviewer?: { name: string } | null;
    } | null;
  } | null;
}

export function useSessionAiAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      sessionId: string;
      reportId?: string;
      analysisType: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS";
    }) =>
      api
        .post<{ data: Record<string, unknown> }>(
          `/api/sessions/${args.sessionId}/ai-analysis`,
          { analysisType: args.analysisType },
        )
        .then((r) => r.data.data),
    onSuccess: (_, args) => {
      if (args.reportId) {
        qc.invalidateQueries({ queryKey: ["reports", args.reportId] });
      }
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["sessions", args.sessionId] });
    },
  });
}

/* ─── AI Config Types ─── */

export interface AiConfigRow {
  id: string;
  provider: string;
  modelName: string;
  purpose: string;
  isDefault: boolean;
  isActive?: boolean;
  maskedApiKey: string;
  createdAt: string;
}

export interface AiUsageData {
  totalCalls: number;
  totalCostUsd: number;
  byProvider: {
    provider: string;
    calls: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
  }[];
  recentLogs: {
    id: string;
    provider: string;
    modelName: string;
    purpose: string;
    status: string;
    inputTokens: number | null;
    outputTokens: number | null;
    costUsd: number | null;
    latencyMs: number | null;
    createdAt: string;
  }[];
}

/* ─── AI Prompt Template Types ─── */

export interface AiPromptTemplateRow {
  id: string;
  type: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS";
  name: string;
  systemPrompt: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ─── Notification Types ─── */

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

/* ─── AI HR Sohbet ─── */

export interface AiChatConversationListItem {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface AiChatMessageRow {
  id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AiChatConversationDetail {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages: AiChatMessageRow[];
}

export function useAiChatConversations() {
  return useQuery({
    queryKey: qk.aiChatConversations,
    queryFn: () =>
      get<AiChatConversationListItem[]>("/api/ai-chat/conversations"),
  });
}

export function useAiChatConversation(id: string | null) {
  return useQuery({
    queryKey: qk.aiChatDetail(id ?? "__none__"),
    queryFn: () =>
      get<AiChatConversationDetail>(`/api/ai-chat/conversations/${id}`),
    enabled: !!id,
  });
}

export function useCreateAiChatConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title?: string } = {}) =>
      api
        .post<{ data: { id: string; title: string | null } }>(
          "/api/ai-chat/conversations",
          body,
        )
        .then((r) => r.data.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.aiChatConversations });
    },
  });
}

export function useDeleteAiChatConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/ai-chat/conversations/${id}`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.aiChatConversations });
    },
  });
}

export function useSendAiChatMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      content,
    }: {
      conversationId: string;
      content: string;
    }) => {
      const r = await api.post<{
        data: { assistantMessage: AiChatMessageRow };
      }>(`/api/ai-chat/conversations/${conversationId}/messages`, {
        content,
      });
      return r.data.data;
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: qk.aiChatDetail(vars.conversationId),
      });
      void qc.invalidateQueries({ queryKey: qk.aiChatConversations });
    },
  });
}
