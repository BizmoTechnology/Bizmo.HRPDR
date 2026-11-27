import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ─── Tipler (sunucu: server/src/modules/review-cycles, services/review-results.service.ts) ─── */

export type ReviewRelation = "SELF" | "MANAGER" | "PEER" | "SUBORDINATE";
export type ReviewCycleStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ReviewFrequency = "ANNUAL" | "SEMI_ANNUAL" | "QUARTERLY" | "ADHOC";
export type ReviewAssignmentStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED";
export type RaterWeights = Record<ReviewRelation, number>;

export const RELATION_LABEL: Record<ReviewRelation, string> = {
  SELF: "Öz değerlendirme",
  MANAGER: "Yönetici",
  PEER: "Eş düzey",
  SUBORDINATE: "Ast",
};

export const DEFAULT_WEIGHTS: RaterWeights = { SELF: 10, MANAGER: 40, PEER: 30, SUBORDINATE: 20 };

export interface PersonRef {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  position: string;
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
}

export interface ReviewCycleRow {
  id: string;
  name: string;
  description: string | null;
  frequency: ReviewFrequency;
  status: ReviewCycleStatus;
  periodStart: string | null;
  periodEnd: string | null;
  dueAt: string | null;
  raterWeights: RaterWeights;
  anonymityMinRaters: number;
  includeSelf: boolean;
  shareWithEmployee: boolean | null;
  questionSetId: string;
  questionSet: { id: string; name: string };
  activatedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  subjectCount: number;
  assignmentStats: { total: number; completed: number };
}

export interface ReviewAssignmentRow {
  id: string;
  relation: ReviewRelation;
  status: ReviewAssignmentStatus;
  startedAt: string | null;
  completedAt: string | null;
  reminderSentAt: string | null;
  reminderCount: number;
  rater: PersonRef;
}

export interface ReviewSubjectRow {
  id: string;
  status: "OPEN" | "CLOSED" | "RELEASED";
  releasedAt: string | null;
  personnel: PersonRef;
  assignments: ReviewAssignmentRow[];
}

export interface ReviewCycleDetail extends Omit<ReviewCycleRow, "subjectCount" | "assignmentStats"> {
  createdBy: { id: string; name: string };
  questionCount: number | null;
  subjects: ReviewSubjectRow[];
}

export interface DeliveryReport {
  mailConfigured: boolean;
  mailSent: number;
  mailFailed: number;
  notified: number;
  raters: number;
}

export interface CycleDashboard {
  cycle: { id: string; name: string; status: ReviewCycleStatus; dueAt: string | null };
  isOverdue: boolean;
  mailConfigured: boolean;
  totals: {
    subjects: number;
    assignments: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    declined: number;
  };
  byDepartment: Array<{
    departmentId: string | null;
    name: string;
    subjects: number;
    total: number;
    completed: number;
  }>;
  pending: Array<{
    assignmentId: string;
    relation: ReviewRelation;
    status: ReviewAssignmentStatus;
    reminderSentAt: string | null;
    reminderCount: number;
    startedAt: string | null;
    rater: PersonRef;
    subject: { id: string; personnel: PersonRef };
  }>;
}

export interface GroupResult {
  relation: ReviewRelation;
  label: string;
  weight: number;
  assigned: number;
  completed: number;
  visible: boolean;
  hiddenReason: "INSUFFICIENT_RATERS" | "NO_RATERS" | null;
  raterNames: string[] | null;
  scores: Partial<Record<string, number>> | null;
  overall: number | null;
}

export interface ItemResult {
  questionId: string;
  text: string;
  dimension: string;
  self: number | null;
  others: number | null;
  gap: number | null;
  byGroup: Partial<Record<ReviewRelation, number>>;
  /** Ters puanlanan madde: puan çevrilmiştir (yüksek = olumlu); metin olumsuz ifadedir */
  reverse?: boolean;
}

export interface SubjectResults {
  subject: {
    id: string;
    personnelId: string;
    name: string;
    position: string;
    department: string | null;
    status: "OPEN" | "CLOSED" | "RELEASED";
    releasedAt: string | null;
  };
  cycle: {
    id: string;
    name: string;
    status: ReviewCycleStatus;
    periodStart: string | null;
    periodEnd: string | null;
    dueAt: string | null;
  };
  anonymityMinRaters: number;
  weights: RaterWeights;
  groups: GroupResult[];
  dimensions: Array<{
    dimension: string;
    self: number | null;
    others: number | null;
    weighted: number | null;
    gap: number | null;
    byGroup: Partial<Record<ReviewRelation, number>>;
  }>;
  overall: { self: number | null; others: number | null; weighted: number | null };
  items: ItemResult[];
  strengths: ItemResult[];
  developmentAreas: ItemResult[];
  blindSpots: ItemResult[];
  hiddenStrengths: ItemResult[];
  comments: Array<{
    id: string;
    relation: ReviewRelation;
    questionText: string;
    text: string;
    authorName: string | null;
  }>;
  raterFlags: Array<{
    assignmentId: string;
    raterName: string;
    relation: ReviewRelation;
    reasons: Array<"TOO_FAST" | "STRAIGHT_LINE">;
    durationSec: number | null;
    answeredScaleCount: number;
  }> | null;
  completedRaters: number;
  totalRaters: number;
  computedAt: string;
}

export interface OrgChartPerson {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  position: string;
  status: string;
  avatarUrl: string | null;
  managerId: string | null;
  department: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
}

export interface RaterPlanEntry {
  personnelId: string;
  relation: ReviewRelation;
}

export interface SubjectPlan {
  personnelId: string;
  raters: RaterPlanEntry[];
}

export interface CycleInput {
  name: string;
  description?: string | null;
  frequency: ReviewFrequency;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueAt?: string | null;
  questionSetId: string;
  raterWeights: RaterWeights;
  anonymityMinRaters: number;
  includeSelf: boolean;
  /** Personelle paylaşım: null = kurum varsayılanı */
  shareWithEmployee?: boolean | null;
}

/* ─── Sorgu anahtarları ─── */

export const reviewKeys = {
  cycles: (status?: string) => ["review-cycles", status ?? "all"] as const,
  cycle: (id: string) => ["review-cycles", "detail", id] as const,
  dashboard: (id: string) => ["review-cycles", "dashboard", id] as const,
  results: (cycleId: string, subjectId: string) => ["review-cycles", "results", cycleId, subjectId] as const,
  orgChart: ["org-chart"] as const,
};

function get<T>(url: string) {
  return api.get<{ data: T }>(url).then((r) => r.data.data);
}

/* ─── Dönemler ─── */

export function useReviewCycles(status?: ReviewCycleStatus) {
  return useQuery({
    queryKey: reviewKeys.cycles(status),
    queryFn: () => get<ReviewCycleRow[]>(`/api/review-cycles${status ? `?status=${status}` : ""}`),
  });
}

export function useReviewCycle(id: string) {
  return useQuery({
    queryKey: reviewKeys.cycle(id),
    queryFn: () => get<ReviewCycleDetail>(`/api/review-cycles/${id}`),
    enabled: !!id,
  });
}

export function useCycleDashboard(id: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.dashboard(id),
    queryFn: () => get<CycleDashboard>(`/api/review-cycles/${id}/dashboard`),
    enabled: !!id && enabled,
  });
}

export function useSubjectResults(cycleId: string, subjectId: string) {
  return useQuery({
    queryKey: reviewKeys.results(cycleId, subjectId),
    queryFn: () => get<SubjectResults>(`/api/review-cycles/${cycleId}/subjects/${subjectId}/results`),
    enabled: !!cycleId && !!subjectId,
  });
}

function useInvalidateCycles() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["review-cycles"] });
}

export function useCreateReviewCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (data: CycleInput) =>
      api.post<{ data: ReviewCycleRow }>("/api/review-cycles", data).then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

export function useUpdateReviewCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CycleInput> }) =>
      api.put(`/api/review-cycles/${id}`, data).then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

export function useDeleteReviewCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/review-cycles/${id}`).then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

export function useSaveAssignments() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: ({ id, subjects }: { id: string; subjects: SubjectPlan[] }) =>
      api
        .put<{ data: { added: number; delivery: DeliveryReport | null } }>(
          `/api/review-cycles/${id}/assignments`,
          { subjects },
        )
        .then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

export function useSuggestRaters() {
  return useMutation({
    mutationFn: (data: { personnelIds: string[]; includeSelf: boolean }) =>
      api
        .post<{ data: SubjectPlan[] }>("/api/review-cycles/suggest-raters", data)
        .then((r) => r.data.data),
  });
}

export function useActivateCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ data: { delivery: DeliveryReport } }>(`/api/review-cycles/${id}/activate`)
        .then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

export function useCloseCycle() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/review-cycles/${id}/close`).then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

export function useRemindRaters() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: ({ id, assignmentIds }: { id: string; assignmentIds?: string[] }) =>
      api
        .post<{ data: { targeted: number; skippedRecent: number; delivery: DeliveryReport } }>(
          `/api/review-cycles/${id}/remind`,
          assignmentIds ? { assignmentIds } : {},
        )
        .then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

export function useReleaseSubject() {
  const invalidate = useInvalidateCycles();
  return useMutation({
    mutationFn: ({ cycleId, subjectId, released }: { cycleId: string; subjectId: string; released: boolean }) =>
      (released
        ? api.post(`/api/review-cycles/${cycleId}/subjects/${subjectId}/release`)
        : api.delete(`/api/review-cycles/${cycleId}/subjects/${subjectId}/release`)
      ).then((r) => r.data.data),
    onSuccess: invalidate,
  });
}

/* ─── Org şeması ─── */

export function useOrgChart() {
  return useQuery({
    queryKey: reviewKeys.orgChart,
    queryFn: () => get<OrgChartPerson[]>("/api/org-chart"),
  });
}

export function useSetManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ personnelId, managerId }: { personnelId: string; managerId: string | null }) =>
      api.put(`/api/org-chart/${personnelId}/manager`, { managerId }).then((r) => r.data.data),
    // İyimser güncelleme: ağaç bırakıldığı anda yeni yerinde görünür, hata olursa geri alınır
    onMutate: async ({ personnelId, managerId }) => {
      await qc.cancelQueries({ queryKey: reviewKeys.orgChart });
      const prev = qc.getQueryData<OrgChartPerson[]>(reviewKeys.orgChart);
      if (prev) {
        qc.setQueryData<OrgChartPerson[]>(
          reviewKeys.orgChart,
          prev.map((p) => (p.id === personnelId ? { ...p, managerId } : p)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(reviewKeys.orgChart, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: reviewKeys.orgChart });
      void qc.invalidateQueries({ queryKey: ["personnel"] });
    },
  });
}

/** Teslim raporunu kullanıcıya dürüstçe anlatan metin (SMTP yoksa "gönderilmedi" der) */
export function describeDelivery(d: DeliveryReport | null | undefined): string {
  if (!d || d.raters === 0) return "Bildirim gönderilecek değerlendirici yok.";
  const inApp = `${d.notified} değerlendiriciye uygulama içi bildirim oluşturuldu.`;
  if (!d.mailConfigured) return `${inApp} E-posta gönderilmedi: SMTP bağlı değil.`;
  if (d.mailFailed > 0) return `${inApp} ${d.mailSent} e-posta gönderildi, ${d.mailFailed} e-posta gönderilemedi.`;
  return `${inApp} ${d.mailSent} e-posta gönderildi.`;
}
