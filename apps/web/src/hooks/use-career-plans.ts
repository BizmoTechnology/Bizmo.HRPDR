import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Kariyer planı (performans paketi, Aşama 3) sorguları.
 * Sunucu: /api/personnel/:personnelId/career-plans
 */

export const CAREER_STEP_TYPES = ["TRAINING", "MENTORING", "PROJECT", "ROLE", "OTHER"] as const;
export type CareerStepType = (typeof CAREER_STEP_TYPES)[number];
export type CareerStepStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type CareerPlanStatus = "DRAFT" | "APPROVED" | "ARCHIVED";
export type Readiness = "READY" | "DEVELOPING" | "NOT_READY";

export interface CareerStep {
  id: string;
  title: string;
  type: CareerStepType;
  /** YYYY-AA-GG */
  targetDate: string | null;
  status: CareerStepStatus;
  note: string | null;
}

export interface CareerSuggestion {
  summary: string | null;
  targetRole: string;
  horizonMonths: number;
  readiness: Readiness | null;
  rationale: string[];
  steps: Array<{ title: string; type: CareerStepType; monthOffset: number; description: string | null }>;
  risks: string[];
}

export type ExclusionReason = "REVIEW_PENDING" | "NO_AI_CONSENT" | "NO_DATA";

export interface CareerSources {
  generatedAt: string;
  sessions: Array<{ sessionId: string; title: string; completedAt: string | null }>;
  excluded: Array<{ sessionId: string; title: string; reason: ExclusionReason }>;
  reviews360: Array<{ cycleName: string; releasedAt: string | null }>;
  personnelFields: string[];
}

export interface CareerPlan {
  id: string;
  personnelId: string;
  status: CareerPlanStatus;
  targetRole: string | null;
  horizonMonths: number;
  steps: CareerStep[];
  /** VIEWER için her zaman null (sunucu göndermez) */
  aiSuggestion: CareerSuggestion | null;
  aiModel: string | null;
  aiSuggestedAt: string | null;
  sourceSummary: CareerSources | null;
  shareWithEmployee: boolean | null;
  version: number;
  basedOnVersion: number | null;
  approvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { name: string; role: string } | null;
  approvedBy?: { name: string; role: string } | null;
}

export const careerKeys = {
  plans: (personnelId: string) => ["career-plans", personnelId] as const,
  sources: (personnelId: string) => ["career-plans", personnelId, "sources"] as const,
};

const base = (personnelId: string) =>
  `/api/personnel/${encodeURIComponent(personnelId)}/career-plans`;

export function useCareerPlans(personnelId: string) {
  return useQuery({
    queryKey: careerKeys.plans(personnelId),
    queryFn: () =>
      api.get<{ data: CareerPlan[] }>(base(personnelId)).then((r) => r.data.data),
    enabled: !!personnelId,
  });
}

/** Öneride kullanılacak / kullanılmayacak değerlendirmeler (LLM çağrısı yok). Yalnız analyze rolleri. */
export function useCareerSources(personnelId: string, enabled: boolean) {
  return useQuery({
    queryKey: careerKeys.sources(personnelId),
    queryFn: () =>
      api.get<{ data: CareerSources }>(`${base(personnelId)}/sources`).then((r) => r.data.data),
    enabled: enabled && !!personnelId,
    staleTime: 60_000,
  });
}

function usePlanMutation<TVars>(
  personnelId: string,
  request: (vars: TVars) => Promise<CareerPlan>,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: (plan) => {
      // Listeyi hemen güncelle (sürükle-bırak sonrası titremesin), sonra sunucudan tazele
      qc.setQueryData<CareerPlan[]>(careerKeys.plans(personnelId), (prev) =>
        prev ? prev.map((p) => (p.id === plan.id ? { ...p, ...plan } : p)) : prev,
      );
      void qc.invalidateQueries({ queryKey: careerKeys.plans(personnelId) });
    },
  });
}

export function useSuggestCareerPlan(personnelId: string) {
  return usePlanMutation(personnelId, (body: { targetRole?: string | null; horizonMonths?: number }) =>
    api.post<{ data: CareerPlan }>(`${base(personnelId)}/suggest`, body).then((r) => r.data.data),
  );
}

export function useCreateCareerPlan(personnelId: string) {
  return usePlanMutation(
    personnelId,
    (body: { targetRole?: string | null; horizonMonths?: number; fromPlanId?: string }) =>
      api.post<{ data: CareerPlan }>(base(personnelId), body).then((r) => r.data.data),
  );
}

export function useUpdateCareerPlan(personnelId: string) {
  return usePlanMutation(
    personnelId,
    ({
      planId,
      ...body
    }: {
      planId: string;
      targetRole?: string | null;
      horizonMonths?: number;
      steps?: CareerStep[];
      /** Personelle paylaşım: null = kurum varsayılanı */
      shareWithEmployee?: boolean | null;
    }) =>
      api
        .patch<{ data: CareerPlan }>(`${base(personnelId)}/${planId}`, body)
        .then((r) => r.data.data),
  );
}

export function useApplyCareerSuggestion(personnelId: string) {
  return usePlanMutation(personnelId, ({ planId, mode }: { planId: string; mode: "replace" | "append" }) =>
    api
      .post<{ data: CareerPlan }>(`${base(personnelId)}/${planId}/apply-suggestion`, { mode })
      .then((r) => r.data.data),
  );
}

export function useApproveCareerPlan(personnelId: string) {
  return usePlanMutation(personnelId, (planId: string) =>
    api.post<{ data: CareerPlan }>(`${base(personnelId)}/${planId}/approve`, {}).then((r) => r.data.data),
  );
}

export function useArchiveCareerPlan(personnelId: string) {
  return usePlanMutation(personnelId, (planId: string) =>
    api.post<{ data: CareerPlan }>(`${base(personnelId)}/${planId}/archive`, {}).then((r) => r.data.data),
  );
}
