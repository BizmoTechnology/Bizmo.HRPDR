import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QuestionDimension, TerminatePersonnelInput, TerminationReason } from "@ph/shared";
import { api } from "@/lib/api";
import { qk, type PersonnelDetail, type PersonnelRow } from "@/hooks/use-api";

/**
 * Personel geçmişi, işten ayrılanlar ve arşiv (Aşama 2).
 * Sorgu anahtarları "personnel" ile başlar: personel mutasyonlarındaki
 * `invalidateQueries({ queryKey: ["personnel"] })` bunları da tazeler.
 */

function get<T>(url: string) {
  return api.get<{ data: T }>(url).then((r) => r.data.data);
}

function toQS(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

/* ─── Kayıt ─── */

export type PersonnelStatusValue = "ACTIVE" | "INACTIVE" | "ON_LEAVE" | "TERMINATED";

/** GET /api/personnel/:id — ayrılış ve arşiv alanlarıyla */
export interface PersonnelRecord extends Omit<PersonnelDetail, "status"> {
  status: PersonnelStatusValue;
  terminationDate: string | null;
  terminationReason: TerminationReason | null;
  terminationNote: string | null;
  deletedAt: string | null;
  /** Ayrılmış ya da arşivlenmiş: düzenleme eylemleri kapalı */
  readOnly: boolean;
}

/** `usePersonnel` ile aynı anahtar ve istek; yanıtın tamamını tipler */
export function usePersonnelRecord(id: string) {
  return useQuery({
    queryKey: qk.personnelDetail(id),
    queryFn: () => get<PersonnelRecord>(`/api/personnel/${id}`),
    enabled: !!id,
  });
}

/* ─── Liste görünümleri ─── */

export type PersonnelListView = "current" | "terminated" | "archived";

export interface PersonnelListRow extends PersonnelRow {
  terminationDate: string | null;
  terminationReason: TerminationReason | null;
  deletedAt: string | null;
}

export interface PersonnelListViewParams {
  view: PersonnelListView;
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  departmentId?: string;
}

export function usePersonnelListView(params: PersonnelListViewParams) {
  const { view, ...rest } = params;
  const query: Record<string, unknown> = { ...rest };
  if (view === "terminated") query.status = "TERMINATED";
  if (view === "archived") {
    query.view = "archived";
    delete query.status;
  }
  return useQuery({
    queryKey: ["personnel", "list-view", view, rest] as const,
    queryFn: async () => {
      const r = await api.get<{
        data: PersonnelListRow[];
        meta: { total: number; page: number; pageSize: number };
      }>("/api/personnel?" + toQS(query));
      return { items: r.data.data, ...r.data.meta };
    },
  });
}

/** GET /api/personnel/stats — `archived` yalnız SUPER_ADMIN/ADMIN için sayı, diğerlerine null */
export interface PersonnelStatusCounts {
  total: number;
  active: number;
  inactive: number;
  onLeave: number;
  terminated: number;
  archived: number | null;
}

export function usePersonnelStatusCounts() {
  return useQuery({
    queryKey: ["personnel", "status-counts"] as const,
    queryFn: () => get<PersonnelStatusCounts>("/api/personnel/stats"),
  });
}

/* ─── Geçmiş ─── */

export type DimensionScoreMap = Partial<Record<QuestionDimension, number>>;

export interface HistorySession {
  id: string;
  assessment: { id: string; title: string };
  status: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  dueAt: string | null;
  durationSec: number | null;
  review: { status: "PENDING" | "APPROVED" | "REJECTED"; decidedAt: string | null } | null;
  analysisPipeline: string;
  overallScore: number | null;
  dimensionScores: DimensionScoreMap | null;
  reportId: string | null;
  reportStatus: string | null;
  keyInsights: string | null;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  } | null;
  careerPaths: { shortTerm: string | null; midTerm: string | null; longTerm: string | null } | null;
}

export interface HistoryEvent {
  id: string;
  type: "HIRED" | "RECORD_CREATED" | "TERMINATED";
  date: string;
  reason?: TerminationReason | null;
  note?: string | null;
}

/**
 * 360° dönem sonucu (kapanmış dönemler). Skorlar yalnız analiz yetkisine dolu döner ve
 * anonimlik eşiği altındaki eş düzey / ast grupları hiçbir değere katılmaz.
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
  released: boolean;
  overallScore: number | null;
  selfScore: number | null;
  othersScore: number | null;
  dimensionScores: DimensionScoreMap | null;
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
  scores: Record<QuestionDimension, number | null>;
}

export interface PersonnelHistory {
  personnelId: string;
  status: PersonnelStatusValue;
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
  trend: { dimensions: QuestionDimension[]; points: HistoryTrendPoint[] };
}

export function usePersonnelHistory(id: string) {
  return useQuery({
    queryKey: ["personnel", id, "history"] as const,
    queryFn: () => get<PersonnelHistory>(`/api/personnel/${id}/history`),
    enabled: !!id,
  });
}

/* ─── İşten çıkar / yeniden etkinleştir ─── */

export function useTerminatePersonnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TerminatePersonnelInput }) =>
      api
        .post<{ data: PersonnelRecord & { expiredSessions: number } }>(
          `/api/personnel/${id}/terminate`,
          data,
        )
        .then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personnel"] }),
  });
}

export function useReactivatePersonnel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post<{ data: PersonnelRecord }>(`/api/personnel/${id}/reactivate`)
        .then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personnel"] }),
  });
}
