"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  CopyPlus,
  FilePlus2,
  History,
  Info,
  Loader2,
  Plus,
  Route,
  Save,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import { useAiStatus } from "@/hooks/use-api";
import {
  useApplyCareerSuggestion,
  useApproveCareerPlan,
  useArchiveCareerPlan,
  useCareerPlans,
  useCareerSources,
  useCreateCareerPlan,
  useSuggestCareerPlan,
  useUpdateCareerPlan,
  type CareerPlan,
  type CareerSources,
  type CareerStep,
  type CareerStepStatus,
  type CareerSuggestion,
} from "@/hooks/use-career-plans";
import { ShareWithEmployeeControl } from "@/components/sharing/ShareWithEmployee";
import { AiNotConnectedNotice } from "@/components/ai/AiNotConnectedNotice";
import { CareerStepsEditor } from "./career/CareerStepsEditor";
import { formatIsoDay } from "./career/CareerDateField";
import {
  HORIZON_OPTIONS,
  PLAN_STATUS,
  PlanStatusBadge,
  READINESS,
  STEP_STATUS_LABEL,
  STEP_TYPE_LABEL,
  StepMarker,
  StepStatusToggle,
  formatDateTime,
  newStepId,
  stepState,
} from "./career/career-shared";

/**
 * Personel kariyer planı sekmesi (performans paketi, Aşama 3).
 * AI önerir, İK karar verir: öneri yalnızca İK onaylı ve AI rızalı değerlendirmelerden
 * üretilir; İK taslağa alır, düzenler, sıralar ve onaylar. VIEWER yalnız onaylı planları
 * görür; AI içeriği ona sunucudan hiç gönderilmez.
 */
export function CareerTab({ personnelId }: { personnelId: string }) {
  const { canManage, canAnalyze } = usePermissions();
  const { data: plans, isLoading, isError, error } = useCareerPlans(personnelId);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const draft = plans?.find((p) => p.status === "DRAFT") ?? null;
  const approved = plans?.find((p) => p.status === "APPROVED") ?? null;
  const viewing = viewingId ? plans?.find((p) => p.id === viewingId) ?? null : null;

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="bz-skeleton h-40 w-full rounded-2xl" />
        <div className="bz-skeleton h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div role="alert" className="bz-alert bz-alert--danger">
        <Info aria-hidden="true" />
        <div>
          <p className="bz-alert__title">Kariyer planı yüklenemedi</p>
          <p>{apiErrorMessage(error, "Lütfen sayfayı yenileyin.")}</p>
        </div>
      </div>
    );
  }

  const hasAny = (plans?.length ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="min-w-0 space-y-4 xl:col-span-2">
        {canAnalyze && (
          <AiSuggestPanel personnelId={personnelId} draft={draft} canManage={canManage} />
        )}

        {viewing && viewing.status === "ARCHIVED" && (
          <section className="bz-card" aria-labelledby="career-viewing-title">
            <div className="bz-card__header flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="bz-kicker">Geçmiş sürüm</p>
                <h3 id="career-viewing-title" className="bz-card__title">
                  Sürüm {viewing.version}: {viewing.targetRole ?? "Hedef rol yok"}
                </h3>
              </div>
              <button
                type="button"
                className="bz-icon-btn"
                onClick={() => setViewingId(null)}
                aria-label="Geçmiş sürümü kapat"
                title="Kapat"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="bz-card__body space-y-4">
              <PlanFacts plan={viewing} />
              <RoadmapView steps={viewing.steps} />
            </div>
          </section>
        )}

        {draft && (
          <DraftEditor
            key={`${draft.id}:${draft.updatedAt}`}
            personnelId={personnelId}
            plan={draft}
            canManage={canManage}
            canAnalyze={canAnalyze}
          />
        )}

        {approved && (
          <ApprovedPlan
            personnelId={personnelId}
            plan={approved}
            canManage={canManage}
            hasDraft={!!draft}
          />
        )}

        {!draft && !approved && (
          <EmptyPlans personnelId={personnelId} canManage={canManage} hasHistory={hasAny} />
        )}
      </div>

      <HistoryPanel plans={plans ?? []} viewingId={viewingId} onView={setViewingId} />
    </div>
  );
}

/* ─── Hata kodu ─── */

function errorCode(err: unknown): string | undefined {
  return (err as AxiosError<{ code?: string }>)?.response?.data?.code;
}

/* ─── AI öneri paneli ─── */

const EXCLUSION_LABEL: Record<string, string> = {
  REVIEW_PENDING: "İK onayı bekliyor",
  NO_AI_CONSENT: "AI rızası yok",
  NO_DATA: "Kullanılabilir analiz yok",
};

function AiSuggestPanel({
  personnelId,
  draft,
  canManage,
}: {
  personnelId: string;
  draft: CareerPlan | null;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const { data: aiStatus } = useAiStatus();
  const { data: sources, isLoading: sourcesLoading } = useCareerSources(personnelId, true);
  const suggest = useSuggestCareerPlan(personnelId);
  const [notConnected, setNotConnected] = useState(false);
  const [targetRole, setTargetRole] = useState(draft?.targetRole ?? "");
  const [horizon, setHorizon] = useState(draft?.horizonMonths ?? 12);

  // Durum bilinmiyorsa düğme açık kalır; sunucu yine "bağlı değil" döner
  const aiConnected = aiStatus?.connected !== false && !notConnected;
  const eligibleCount = (sources?.sessions.length ?? 0) + (sources?.reviews360.length ?? 0);
  const noEligible = !!sources && eligibleCount === 0;

  const run = () => {
    suggest.mutate(
      { targetRole: targetRole.trim() || null, horizonMonths: horizon },
      {
        onSuccess: () => toast.success("AI önerisi hazır. İnceleyip taslağa alabilirsiniz."),
        onError: (err) => {
          if (errorCode(err) === "AI_NOT_CONNECTED") {
            setNotConnected(true);
            void qc.invalidateQueries({ queryKey: ["ai-status"] });
            return;
          }
          toast.error(apiErrorMessage(err, "AI önerisi oluşturulamadı"));
        },
      },
    );
  };

  return (
    <section className="bz-card" aria-labelledby="career-ai-title">
      <div className="bz-card__header">
        <div className="min-w-0">
          <p className="bz-kicker">AI önerir, İK karar verir</p>
          <h2 id="career-ai-title" className="bz-card__title flex items-center gap-2">
            <Sparkles className="size-4 text-[var(--bz-info-ink)]" aria-hidden="true" />
            AI kariyer önerisi
          </h2>
        </div>
      </div>
      <div className="bz-card__body space-y-4">
        <SourcesSummary sources={sources} loading={sourcesLoading} />

        {!aiConnected ? (
          <AiNotConnectedNotice feature="AI kariyer önerisi" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
            <div className="min-w-0">
              <label htmlFor="career-ai-role" className="bz-label">
                Hedef rol <span className="font-normal text-fg3">(isteğe bağlı)</span>
              </label>
              <input
                id="career-ai-role"
                className="bz-field"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="Boş bırakılırsa AI önerir"
                maxLength={200}
              />
            </div>
            <div>
              <label htmlFor="career-ai-horizon" className="bz-label">
                Ufuk
              </label>
              <select
                id="career-ai-horizon"
                className="bz-field"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                {HORIZON_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} ay
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="bz-btn bz-btn--data"
              onClick={run}
              disabled={suggest.isPending || noEligible}
              aria-describedby={noEligible ? "career-ai-noeligible" : undefined}
            >
              {suggest.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {suggest.isPending ? "Öneri hazırlanıyor" : draft?.aiSuggestion ? "Yeniden öner" : "AI ile öneri oluştur"}
            </button>
            {noEligible && (
              <p id="career-ai-noeligible" className="bz-hint sm:col-span-3">
                Öneri için İK onaylı ve personelin AI rızası olan en az bir değerlendirme gerekir.
              </p>
            )}
          </div>
        )}

        {suggest.isPending && (
          <p role="status" className="flex items-center gap-2 text-[13px] text-fg2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            AI önerisi hazırlanıyor; bu işlem bir dakika kadar sürebilir.
          </p>
        )}

        {draft?.aiSuggestion && (
          <SuggestionPreview personnelId={personnelId} plan={draft} suggestion={draft.aiSuggestion} canManage={canManage} />
        )}
      </div>
    </section>
  );
}

function SourcesSummary({ sources, loading }: { sources?: CareerSources; loading: boolean }) {
  const [open, setOpen] = useState(false);
  if (loading) return <div className="bz-skeleton h-5 w-2/3" />;
  if (!sources) return null;
  const used = sources.sessions.length;
  const excluded = sources.excluded.length;

  return (
    <div className="bz-callout" data-tone="info">
      <p className="bz-callout__title">
        <ShieldCheck aria-hidden="true" />
        Öneride kullanılacak veri
      </p>
      <p>
        <strong>{used}</strong> İK onaylı ve AI rızalı değerlendirme
        {sources.reviews360.length > 0 && (
          <>
            , <strong>{sources.reviews360.length}</strong> yayınlanmış 360° sonucu
          </>
        )}
        , pozisyon ve deneyim. Ad ve iletişim bilgisi gönderilmez.
        {excluded > 0 && (
          <>
            {" "}
            <strong>{excluded}</strong> değerlendirme kullanılmayacak.
          </>
        )}
      </p>
      {(used > 0 || excluded > 0) && (
        <>
          <button
            type="button"
            className="bz-btn bz-btn--link mt-1 h-auto p-0 text-[13px]"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
            {open ? "Ayrıntıyı gizle" : "Ayrıntıyı göster"}
          </button>
          {open && (
            <ul className="mt-2 space-y-1 text-[13px]">
              {sources.sessions.map((s) => (
                <li key={s.sessionId} className="flex flex-wrap items-center gap-2">
                  <span className="bz-chip bz-chip--success bz-chip--sm">Kullanılacak</span>
                  <span className="min-w-0 break-words">{s.title}</span>
                  {s.completedAt && <span className="text-fg3">{formatIsoDay(s.completedAt)}</span>}
                </li>
              ))}
              {sources.excluded.map((s) => (
                <li key={s.sessionId} className="flex flex-wrap items-center gap-2">
                  <span className="bz-chip bz-chip--sm">{EXCLUSION_LABEL[s.reason] ?? "Kullanılmayacak"}</span>
                  <span className="min-w-0 break-words text-fg2">{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function SuggestionPreview({
  personnelId,
  plan,
  suggestion,
  canManage,
}: {
  personnelId: string;
  plan: CareerPlan;
  suggestion: CareerSuggestion;
  canManage: boolean;
}) {
  const apply = useApplyCareerSuggestion(personnelId);
  const hasSteps = plan.steps.length > 0;
  const readiness = suggestion.readiness ? READINESS[suggestion.readiness] : null;

  const doApply = (mode: "replace" | "append") =>
    apply.mutate(
      { planId: plan.id, mode },
      {
        onSuccess: () =>
          toast.success(mode === "append" ? "Öneri adımları taslağa eklendi" : "Öneri taslağa alındı"),
        onError: (err) => toast.error(apiErrorMessage(err, "Öneri taslağa alınamadı")),
      },
    );

  return (
    <div className="rounded-2xl border border-dashed border-border-strong p-4" aria-labelledby="career-suggestion-title">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="bz-kicker">Öneri önizlemesi · onaylanmadı</p>
          <h3 id="career-suggestion-title" className="mt-1 text-[16px] font-bold text-foreground">
            {suggestion.targetRole}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-fg3">
            {suggestion.horizonMonths} ay · {suggestion.steps.length} adım
            {plan.aiSuggestedAt && <> · {formatDateTime(plan.aiSuggestedAt)}</>}
            {plan.aiModel && <> · {plan.aiModel}</>}
          </p>
        </div>
        {readiness && <span className={cn("bz-chip", readiness.tone)}>{readiness.label}</span>}
      </div>

      {suggestion.summary && <p className="mt-3 text-[14px] leading-relaxed text-foreground">{suggestion.summary}</p>}

      {suggestion.rationale.length > 0 && (
        <div className="mt-3">
          <p className="text-[12px] font-semibold text-fg2">Gerekçe</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-foreground">
            {suggestion.rationale.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="bz-vsteps mt-4">
        {suggestion.steps.map((s, i) => (
          <li key={i} className="bz-vstep">
            <span className="bz-vstep__marker" aria-hidden="true">
              {i + 1}
            </span>
            <span className="bz-vstep__title">{s.title}</span>
            <span className="bz-vstep__desc">
              {STEP_TYPE_LABEL[s.type]} · {s.monthOffset}. ay
              {s.description && <> · {s.description}</>}
            </span>
          </li>
        ))}
      </ol>

      {suggestion.risks.length > 0 && (
        <div className="bz-callout mt-3" data-tone="warning">
          <p className="bz-callout__title">Dikkat edilecekler</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {suggestion.risks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="bz-btn"
            onClick={() => doApply("replace")}
            disabled={apply.isPending}
          >
            {apply.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FilePlus2 aria-hidden="true" />}
            {hasSteps ? "Taslağa al (adımları değiştir)" : "Taslağa al"}
          </button>
          {hasSteps && (
            <button
              type="button"
              className="bz-btn bz-btn--subtle"
              onClick={() => doApply("append")}
              disabled={apply.isPending}
            >
              <CopyPlus aria-hidden="true" />
              Mevcut adımlara ekle
            </button>
          )}
          <p className="bz-hint w-full">
            Taslağa alınan adımlar düzenlenebilir; plan onaylanana kadar hiçbir yere yansımaz.
          </p>
        </div>
      ) : (
        <p className="bz-hint mt-3">Öneriyi taslağa almak için personel yönetimi yetkisi gerekir.</p>
      )}
    </div>
  );
}

/* ─── Taslak düzenleyici ─── */

function DraftEditor({
  personnelId,
  plan,
  canManage,
  canAnalyze,
}: {
  personnelId: string;
  plan: CareerPlan;
  canManage: boolean;
  canAnalyze: boolean;
}) {
  const update = useUpdateCareerPlan(personnelId);
  const approve = useApproveCareerPlan(personnelId);
  const [targetRole, setTargetRole] = useState(plan.targetRole ?? "");
  const [horizon, setHorizon] = useState(plan.horizonMonths);
  const [steps, setSteps] = useState<CareerStep[]>(plan.steps);

  const dirty = useMemo(
    () =>
      (plan.targetRole ?? "") !== targetRole ||
      plan.horizonMonths !== horizon ||
      JSON.stringify(plan.steps) !== JSON.stringify(steps),
    [plan, targetRole, horizon, steps],
  );
  const busy = update.isPending || approve.isPending;
  const emptyTitle = steps.some((s) => !s.title.trim());
  const canApprove = canAnalyze && !!targetRole.trim() && steps.length > 0 && !emptyTitle;

  const save = () =>
    update.mutateAsync({
      planId: plan.id,
      targetRole: targetRole.trim() || null,
      horizonMonths: horizon,
      steps: steps.map((s) => ({ ...s, title: s.title.trim(), note: s.note?.trim() || null })),
    });

  const onSave = () =>
    save().then(
      () => toast.success("Taslak kaydedildi"),
      (err) => toast.error(apiErrorMessage(err, "Taslak kaydedilemedi")),
    );

  const onApprove = async () => {
    try {
      if (dirty && canManage) await save();
      await approve.mutateAsync(plan.id);
      toast.success("Kariyer planı onaylandı");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Plan onaylanamadı"));
    }
  };

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      { id: newStepId(), title: "", type: "TRAINING", targetDate: null, status: "TODO", note: null },
    ]);

  return (
    <section className="bz-card" aria-labelledby="career-draft-title">
      <div className="bz-card__header flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="bz-kicker">Sürüm {plan.version}{plan.basedOnVersion ? ` · Sürüm ${plan.basedOnVersion} kopyası` : ""}</p>
          <h2 id="career-draft-title" className="bz-card__title flex items-center gap-2">
            <Route className="size-4 text-fg3" aria-hidden="true" />
            Kariyer planı taslağı
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="bz-chip bz-chip--warning bz-chip--sm" role="status">
              Kaydedilmedi
            </span>
          )}
          <PlanStatusBadge status={plan.status} />
        </div>
      </div>

      <div className="bz-card__body space-y-4">
        {canManage ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="min-w-0">
              <label htmlFor="career-draft-role" className="bz-label">
                Hedef rol
              </label>
              <input
                id="career-draft-role"
                className="bz-field"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                placeholder="ör. Takım lideri"
                maxLength={200}
                disabled={busy}
              />
            </div>
            <div>
              <label htmlFor="career-draft-horizon" className="bz-label">
                Ufuk
              </label>
              <select
                id="career-draft-horizon"
                className="bz-field"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                disabled={busy}
              >
                {[...new Set([...HORIZON_OPTIONS, horizon])].sort((a, b) => a - b).map((m) => (
                  <option key={m} value={m}>
                    {m} ay
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <PlanFacts plan={plan} />
        )}

        {steps.length === 0 ? (
          <div className="bz-empty py-8">
            <Route className="h-7 w-7 text-fg3" aria-hidden="true" />
            <p className="bz-empty__title">Henüz adım yok</p>
            <p className="bz-empty__text">
              {canManage
                ? "AI önerisini taslağa alın ya da adımları kendiniz ekleyin."
                : "Taslağa henüz adım eklenmedi."}
            </p>
          </div>
        ) : canManage ? (
          <CareerStepsEditor steps={steps} onChange={setSteps} disabled={busy} />
        ) : (
          <RoadmapView steps={steps} />
        )}

        {canManage && (
          <button type="button" className="bz-btn bz-btn--subtle" onClick={addStep} disabled={busy || steps.length >= 50}>
            <Plus aria-hidden="true" />
            Adım ekle
          </button>
        )}

        {canManage && <CareerShareControl personnelId={personnelId} plan={plan} />}
      </div>

      <div className="bz-card__footer flex flex-wrap items-center justify-between gap-2">
        {canManage ? <ArchiveButton personnelId={personnelId} plan={plan} label="Taslağı arşivle" /> : <span />}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button type="button" className="bz-btn" onClick={onSave} disabled={!dirty || busy}>
              {update.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Kaydet
            </button>
          )}
          {canAnalyze && (
            <button
              type="button"
              className="bz-btn bz-btn--primary"
              onClick={onApprove}
              disabled={!canApprove || busy || (dirty && !canManage)}
              aria-describedby="career-approve-hint"
            >
              {approve.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
              Planı onayla
            </button>
          )}
        </div>
        {canAnalyze && (
          <p id="career-approve-hint" className="bz-hint w-full text-right">
            {!targetRole.trim()
              ? "Onay için hedef rol girin."
              : steps.length === 0
                ? "Onay için en az bir adım ekleyin."
                : emptyTitle
                  ? "Başlığı boş adım var."
                  : dirty
                    ? "Onaylarken değişiklikler de kaydedilir."
                    : "Onaylanan plan önceki onaylı sürümün yerini alır."}
          </p>
        )}
      </div>
    </section>
  );
}

/* ─── Onaylı plan ─── */

function ApprovedPlan({
  personnelId,
  plan,
  canManage,
  hasDraft,
}: {
  personnelId: string;
  plan: CareerPlan;
  canManage: boolean;
  hasDraft: boolean;
}) {
  const update = useUpdateCareerPlan(personnelId);
  const create = useCreateCareerPlan(personnelId);
  const [pendingStep, setPendingStep] = useState<string | null>(null);
  const done = plan.steps.filter((s) => s.status === "DONE").length;
  const pct = plan.steps.length ? Math.round((done / plan.steps.length) * 100) : 0;

  const setStatus = (id: string, status: CareerStepStatus) => {
    setPendingStep(id);
    update.mutate(
      { planId: plan.id, steps: plan.steps.map((s) => (s.id === id ? { ...s, status } : s)) },
      {
        onSuccess: () => toast.success(`Adım durumu: ${STEP_STATUS_LABEL[status]}`),
        onError: (err) => toast.error(apiErrorMessage(err, "Adım durumu güncellenemedi")),
        onSettled: () => setPendingStep(null),
      },
    );
  };

  const newVersion = () =>
    create.mutate(
      { fromPlanId: plan.id },
      {
        onSuccess: (p) => toast.success(`Sürüm ${p.version} taslağı açıldı`),
        onError: (err) => toast.error(apiErrorMessage(err, "Yeni sürüm açılamadı")),
      },
    );

  return (
    <section className="bz-card" aria-labelledby="career-approved-title">
      <div className="bz-card__header flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="bz-kicker">Yürürlükteki plan · Sürüm {plan.version}</p>
          <h2 id="career-approved-title" className="bz-card__title">
            {plan.targetRole ?? "Kariyer planı"}
          </h2>
        </div>
        <PlanStatusBadge status={plan.status} />
      </div>
      <div className="bz-card__body space-y-4">
        <PlanFacts plan={plan} />
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
            <span className="font-medium text-fg2">İlerleme</span>
            <span className="tabular-nums text-foreground">
              <strong>{done}</strong> / {plan.steps.length} adım · %{pct}
            </span>
          </div>
          <div
            className="bz-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Plan ilerlemesi"
          >
            <span style={{ ["--value" as string]: `${pct}%` }} />
          </div>
        </div>
        <RoadmapView
          steps={plan.steps}
          onStatusChange={canManage ? setStatus : undefined}
          pendingStepId={pendingStep}
        />
        {canManage && <CareerShareControl personnelId={personnelId} plan={plan} />}
      </div>
      {canManage && (
        <div className="bz-card__footer flex flex-wrap items-center justify-between gap-2">
          <ArchiveButton personnelId={personnelId} plan={plan} label="Planı arşivle" />
          <button
            type="button"
            className="bz-btn"
            onClick={newVersion}
            disabled={hasDraft || create.isPending}
            title={hasDraft ? "Açık bir taslak var; önce onu tamamlayın" : undefined}
          >
            {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CopyPlus aria-hidden="true" />}
            Yeni sürüm aç
          </button>
          {hasDraft && <p className="bz-hint w-full text-right">Açık bir taslak var; içerik değişikliği orada yapılır.</p>}
        </div>
      )}
    </section>
  );
}

/** Kariyer planını personelin portalında paylaşma tercihi (yalnız onaylı plan portalda görünür) */
function CareerShareControl({ personnelId, plan }: { personnelId: string; plan: CareerPlan }) {
  const update = useUpdateCareerPlan(personnelId);
  return (
    <div className="border-t border-divider pt-4">
      <ShareWithEmployeeControl
        value={plan.shareWithEmployee}
        disabled={update.isPending}
        label="Kariyer yol haritasını personelle paylaş"
            requirement="Plan onaylandığında personel portalında görünür."
        onChange={(next) =>
          update.mutate(
            { planId: plan.id, shareWithEmployee: next },
            {
              onSuccess: () => toast.success("Paylaşım tercihi kaydedildi"),
              onError: (err) => toast.error(apiErrorMessage(err, "Paylaşım tercihi kaydedilemedi")),
            },
          )
        }
      />
      <p className="bz-hint mt-1">
        Personel portalında yalnız onaylanmış plan görünür; İK iç notları paylaşılmaz.
      </p>
    </div>
  );
}

function PlanFacts({ plan }: { plan: CareerPlan }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
      <Fact label="Hedef rol" value={plan.targetRole ?? "—"} />
      <Fact label="Ufuk" value={`${plan.horizonMonths} ay`} />
      <Fact
        label={plan.status === "DRAFT" ? "Oluşturan" : "Onaylayan"}
        value={(plan.status === "DRAFT" ? plan.createdBy?.name : plan.approvedBy?.name) ?? "—"}
      />
      <Fact
        label={plan.status === "DRAFT" ? "Oluşturma" : "Onay tarihi"}
        value={formatDateTime(plan.status === "DRAFT" ? plan.createdAt : plan.approvedAt) ?? "—"}
      />
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-[14px] font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** Salt okunur yol haritası (.bz-vsteps). onStatusChange verilirse adım durumları değiştirilebilir. */
function RoadmapView({
  steps,
  onStatusChange,
  pendingStepId,
}: {
  steps: CareerStep[];
  onStatusChange?: (id: string, status: CareerStepStatus) => void;
  pendingStepId?: string | null;
}) {
  if (steps.length === 0) return <p className="bz-hint">Bu sürümde adım yok.</p>;
  return (
    <ol className="bz-vsteps">
      {steps.map((s, i) => (
        <li
          key={s.id}
          className="bz-vstep"
          data-state={stepState(s.status)}
          aria-current={s.status === "IN_PROGRESS" ? "step" : undefined}
        >
          <StepMarker status={s.status} index={i} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="bz-vstep__title break-words">{s.title}</span>
              <span className="bz-chip bz-chip--sm">{STEP_TYPE_LABEL[s.type]}</span>
              {s.targetDate && <span className="text-[12px] text-fg3">{formatIsoDay(s.targetDate)}</span>}
            </div>
            {s.note && <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-fg2">{s.note}</p>}
            <div className="mt-2">
              {onStatusChange ? (
                <div className="flex items-center gap-2">
                  <StepStatusToggle
                    value={s.status}
                    onChange={(st) => onStatusChange(s.id, st)}
                    label={`${i + 1}. adım durumu`}
                    disabled={!!pendingStepId}
                  />
                  {pendingStepId === s.id && <Loader2 className="size-4 animate-spin text-fg3" aria-label="Kaydediliyor" />}
                </div>
              ) : (
                <span className="text-[12px] font-medium text-fg2">{STEP_STATUS_LABEL[s.status]}</span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ─── Arşivleme (satır içi onay) ─── */

function ArchiveButton({ personnelId, plan, label }: { personnelId: string; plan: CareerPlan; label: string }) {
  const archive = useArchiveCareerPlan(personnelId);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="bz-btn bz-btn--ghost bz-btn--sm" onClick={() => setConfirming(true)}>
        <Archive aria-hidden="true" />
        {label}
      </button>
    );
  }
  return (
    <div role="group" aria-label="Arşivleme onayı" className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-fg2">Arşivlensin mi? Geçmişte kalır, düzenlenemez.</span>
      <button
        type="button"
        className="bz-btn bz-btn--danger bz-btn--sm"
        autoFocus
        disabled={archive.isPending}
        onClick={() =>
          archive.mutate(plan.id, {
            onSuccess: () => toast.success(`Sürüm ${plan.version} arşivlendi`),
            onError: (err) => toast.error(apiErrorMessage(err, "Plan arşivlenemedi")),
            onSettled: () => setConfirming(false),
          })
        }
      >
        {archive.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Arşivle
      </button>
      <button type="button" className="bz-btn bz-btn--ghost bz-btn--sm" onClick={() => setConfirming(false)}>
        Vazgeç
      </button>
    </div>
  );
}

/* ─── Boş durum ─── */

function EmptyPlans({
  personnelId,
  canManage,
  hasHistory,
}: {
  personnelId: string;
  canManage: boolean;
  hasHistory: boolean;
}) {
  const create = useCreateCareerPlan(personnelId);
  return (
    <section className="bz-card">
      <div className="bz-empty py-12">
        <span className="bz-icon-box">
          <Route aria-hidden="true" />
        </span>
        <p className="bz-empty__title">{hasHistory ? "Yürürlükte plan yok" : "Henüz kariyer planı yok"}</p>
        <p className="bz-empty__text">
          {canManage
            ? "AI önerisiyle ya da boş bir taslakla başlayın. Plan, İK onayından sonra yürürlüğe girer."
            : "Onaylanmış bir kariyer planı bulunmuyor."}
        </p>
        {canManage && (
          <button
            type="button"
            className="bz-btn mt-2"
            disabled={create.isPending}
            onClick={() =>
              create.mutate(
                {},
                {
                  onSuccess: () => toast.success("Boş taslak oluşturuldu"),
                  onError: (err) => toast.error(apiErrorMessage(err, "Taslak oluşturulamadı")),
                },
              )
            }
          >
            {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FilePlus2 aria-hidden="true" />}
            Boş taslak oluştur
          </button>
        )}
      </div>
    </section>
  );
}

/* ─── Sürüm geçmişi ─── */

const HISTORY_TONE: Record<CareerPlan["status"], string | undefined> = {
  APPROVED: "success",
  DRAFT: "info",
  ARCHIVED: undefined,
};

function HistoryPanel({
  plans,
  viewingId,
  onView,
}: {
  plans: CareerPlan[];
  viewingId: string | null;
  onView: (id: string | null) => void;
}) {
  return (
    <aside className="bz-card h-fit xl:sticky xl:top-4" aria-labelledby="career-history-title">
      <div className="bz-card__header">
        <h2 id="career-history-title" className="bz-card__title flex items-center gap-2">
          <History className="size-4 text-fg3" aria-hidden="true" />
          Sürüm geçmişi
        </h2>
      </div>
      <div className="bz-card__body">
        {plans.length === 0 ? (
          <p className="bz-hint">Henüz sürüm yok.</p>
        ) : (
          <ol className="bz-timeline">
            {plans.map((p) => {
              const when =
                p.status === "APPROVED"
                  ? p.approvedAt
                  : p.status === "ARCHIVED"
                    ? p.archivedAt ?? p.updatedAt
                    : p.updatedAt;
              const who = p.status === "DRAFT" ? p.createdBy : p.approvedBy;
              return (
                <li key={p.id} className="bz-timeline-item" data-tone={HISTORY_TONE[p.status]}>
                  <span className="bz-timeline-item__dot" aria-hidden="true">
                    {p.status === "APPROVED" && <CheckCircle2 />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">
                      Sürüm {p.version} · {PLAN_STATUS[p.status].label}
                    </p>
                    <p className="break-words text-[12.5px] text-fg2">{p.targetRole ?? "Hedef rol yok"}</p>
                    <p className="text-[12px] text-fg3">
                      {formatDateTime(when)}
                      {who && <> · {who.name}</>}
                      {p.basedOnVersion && <> · Sürüm {p.basedOnVersion} kopyası</>}
                    </p>
                    {p.status === "ARCHIVED" && (
                      <button
                        type="button"
                        className="bz-btn bz-btn--link mt-0.5 h-auto p-0 text-[12.5px]"
                        aria-pressed={viewingId === p.id}
                        onClick={() => onView(viewingId === p.id ? null : p.id)}
                      >
                        {viewingId === p.id ? "Gizle" : "Görüntüle"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </aside>
  );
}

export default CareerTab;
