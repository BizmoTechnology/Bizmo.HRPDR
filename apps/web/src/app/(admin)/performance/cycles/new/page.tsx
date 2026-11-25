"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Rocket, Save, ShieldCheck, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/lib/api";
import { useQuestionSetList } from "@/hooks/use-api";
import {
  DEFAULT_WEIGHTS,
  RELATION_LABEL,
  describeDelivery,
  useActivateCycle,
  useCreateReviewCycle,
  useOrgChart,
  useSaveAssignments,
  useSuggestRaters,
  type RaterWeights,
  type ReviewFrequency,
  type ReviewRelation,
  type SubjectPlan,
} from "@/hooks/use-reviews";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { RaterBoard } from "@/components/performance/RaterBoard";
import { SubjectPicker } from "@/components/performance/SubjectPicker";
import { FREQUENCY_LABEL, personName } from "@/components/performance/shared";
import { usePermissions } from "@/lib/roles";
import { ShareWithEmployeeControl } from "@/components/sharing/ShareWithEmployee";
import type { ShareOverride } from "@/hooks/use-sharing";

const STEPS = ["Bilgiler", "Form ve ağırlıklar", "Değerlendiriciler", "Önizle ve başlat"] as const;
const RELATIONS: ReviewRelation[] = ["SELF", "MANAGER", "PEER", "SUBORDINATE"];

/** datetime-local ("2026-12-01T09:00") → ISO; boşsa null */
function toIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function NewReviewCyclePage() {
  const router = useRouter();
  const { canManage } = usePermissions();
  const [step, setStep] = useState(0);

  // 1 · Bilgiler
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<ReviewFrequency>("ANNUAL");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [touched, setTouched] = useState(false);

  // 2 · Form ve ağırlıklar
  const [questionSetId, setQuestionSetId] = useState("");
  const [weights, setWeights] = useState<RaterWeights>(DEFAULT_WEIGHTS);
  const [minRaters, setMinRaters] = useState(3);
  const [includeSelf, setIncludeSelf] = useState(true);
  const [shareWithEmployee, setShareWithEmployee] = useState<ShareOverride>(null);

  // 3 · Değerlendiriciler
  const [plan, setPlan] = useState<SubjectPlan[]>([]);

  const { data: sets } = useQuestionSetList();
  const { data: chart } = useOrgChart();
  const suggest = useSuggestRaters();
  const create = useCreateReviewCycle();
  const saveAssignments = useSaveAssignments();
  const activate = useActivateCycle();
  const [saving, setSaving] = useState<"draft" | "start" | null>(null);

  const people = useMemo(() => (chart ?? []).filter((p) => p.status === "ACTIVE"), [chart]);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const activeSets = (sets ?? []).filter((s) => s.isActive !== false);
  const selectedSet = activeSets.find((s) => s.id === questionSetId);

  const weightTotal = RELATIONS.reduce((a, r) => a + (weights[r] || 0), 0);
  const othersTotal = weights.MANAGER + weights.PEER + weights.SUBORDINATE;

  const errors = {
    name: !name.trim() ? "Dönem adını yazın." : null,
    period:
      periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd)
        ? "Dönem başlangıcı bitişten sonra olamaz."
        : null,
    questionSet: !questionSetId ? "Bir soru seti seçin." : null,
    weights: othersTotal <= 0 ? "Yönetici, eş düzey ve ast ağırlıklarından en az biri sıfırdan büyük olmalı." : null,
    minRaters: minRaters < 3 || minRaters > 20 ? "Anonimlik eşiği 3 ile 20 arasında olmalı." : null,
    plan: plan.length === 0 ? "En az bir değerlendirilen ekleyin." : null,
  };
  const stepValid = [
    !errors.name && !errors.period,
    !errors.questionSet && !errors.weights && !errors.minRaters,
    !errors.plan,
    true,
  ];

  const totalRaters = plan.reduce((a, s) => a + s.raters.length, 0);
  const belowThreshold = plan.flatMap((s) =>
    (["PEER", "SUBORDINATE"] as const)
      .map((rel) => ({ s, rel, n: s.raters.filter((r) => r.relation === rel).length }))
      .filter((x) => x.n > 0 && x.n < minRaters),
  );
  const noRaters = plan.filter((s) => s.raters.filter((r) => r.relation !== "SELF").length === 0);

  async function addSubjects(ids: string[]) {
    if (ids.length === 0) return;
    try {
      const suggestions = await suggest.mutateAsync({ personnelIds: ids, includeSelf });
      setPlan((prev) => [...prev, ...suggestions.filter((s) => !prev.some((p) => p.personnelId === s.personnelId))]);
      toast.success(`${ids.length} kişi eklendi; değerlendiriciler org şemasından önerildi`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Öneri alınamadı"));
    }
  }

  async function reSuggestAll() {
    if (plan.length === 0) return;
    try {
      const suggestions = await suggest.mutateAsync({ personnelIds: plan.map((s) => s.personnelId), includeSelf });
      setPlan(suggestions);
      toast.success("Değerlendiriciler org şemasına göre yeniden önerildi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Öneri alınamadı"));
    }
  }

  function next() {
    setTouched(true);
    if (!stepValid[step]) {
      toast.error("Devam etmeden önce işaretli alanları düzeltin");
      return;
    }
    setTouched(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  async function submit(start: boolean) {
    if (!stepValid.slice(0, 3).every(Boolean)) {
      toast.error("Eksik adımlar var");
      return;
    }
    setSaving(start ? "start" : "draft");
    let cycleId: string | null = null;
    try {
      const cycle = await create.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        frequency,
        periodStart: toIso(periodStart),
        periodEnd: toIso(periodEnd),
        dueAt: toIso(dueAt),
        questionSetId,
        raterWeights: weights,
        anonymityMinRaters: minRaters,
        includeSelf,
        shareWithEmployee,
      });
      cycleId = cycle.id;
      await saveAssignments.mutateAsync({ id: cycle.id, subjects: plan });
      if (start) {
        const res = await activate.mutateAsync(cycle.id);
        toast.success("Dönem başlatıldı", { description: describeDelivery(res.delivery), duration: 8000 });
      } else {
        toast.success("Dönem taslak olarak kaydedildi");
      }
      router.push(`/performance/cycles/${cycle.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, start ? "Dönem başlatılamadı" : "Dönem kaydedilemedi"));
      // Dönem oluştuysa taslak olarak kaldı: kullanıcı ayrıntı sayfasından devam eder
      if (cycleId) router.push(`/performance/cycles/${cycleId}`);
    } finally {
      setSaving(null);
    }
  }

  if (!canManage) {
    return (
      <div className="bz-card">
        <div className="bz-empty">
          <p className="bz-empty__title">Bu sayfa için yetkiniz yok</p>
          <p className="bz-empty__text">360° dönemi oluşturmak için İK yöneticisi ya da yönetici rolü gerekir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <Link href="/performance/cycles" className="bz-btn bz-btn--ghost bz-btn--sm -ml-2 mb-1 w-fit">
            <ArrowLeft />
            360° dönemleri
          </Link>
          <h1 className="bz-page-header__title">Yeni 360° dönemi</h1>
          <p className="bz-page-header__sub">Dört adımda kurun; başlatmadan önce önizleyin.</p>
        </div>
      </motion.div>

      <ol className="bz-stepper mb-5" aria-label="Kurulum adımları">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className="bz-step"
            data-state={i < step ? "done" : i === step ? "current" : undefined}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="bz-step__bar" />
            <span className="bz-step__label">
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{i === step ? label : ""}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* 1 · Bilgiler */}
      {step === 0 && (
        <section className="bz-card max-w-3xl space-y-4 p-5" aria-labelledby="step-info">
          <h2 id="step-info" className="text-[16px] font-bold text-foreground">
            Dönem bilgileri
          </h2>
          <div className="bz-form-row">
            <label className="bz-label" htmlFor="cycle-name">
              Dönem adı <span className="bz-req">*</span>
            </label>
            <input
              id="cycle-name"
              className="bz-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. 2026 Yıl sonu 360°"
              maxLength={200}
              aria-invalid={touched && !!errors.name}
              aria-describedby={touched && errors.name ? "cycle-name-err" : undefined}
            />
            {touched && errors.name && (
              <span id="cycle-name-err" className="bz-error-text">
                {errors.name}
              </span>
            )}
          </div>
          <div className="bz-form-row">
            <label className="bz-label" htmlFor="cycle-desc">
              Açıklama <span className="font-normal text-fg3">(isteğe bağlı)</span>
            </label>
            <textarea
              id="cycle-desc"
              className="bz-field min-h-[80px] py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>
          <fieldset className="bz-form-row">
            <legend className="bz-label mb-1.5">Sıklık</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(FREQUENCY_LABEL) as ReviewFrequency[]).map((f) => (
                <label key={f} className="bz-choice-card">
                  <input type="radio" name="frequency" checked={frequency === f} onChange={() => setFrequency(f)} />
                  <span className="text-[13px] font-semibold">{FREQUENCY_LABEL[f]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="bz-form-grid">
            <div className="bz-form-row">
              <label className="bz-label" htmlFor="period-start">
                Dönem başlangıcı
              </label>
              <DateTimePicker id="period-start" value={periodStart} onChange={setPeriodStart} placeholder="Başlangıç seçin" />
            </div>
            <div className="bz-form-row">
              <label className="bz-label" htmlFor="period-end">
                Dönem bitişi
              </label>
              <DateTimePicker
                id="period-end"
                value={periodEnd}
                onChange={setPeriodEnd}
                placeholder="Bitiş seçin"
                error={!!errors.period}
              />
              {errors.period && <span className="bz-error-text">{errors.period}</span>}
            </div>
            <div className="bz-form-row">
              <label className="bz-label" htmlFor="due-at">
                Değerlendirme son günü
              </label>
              <DateTimePicker id="due-at" value={dueAt} onChange={setDueAt} placeholder="Son gün seçin" />
              <span className="bz-hint">Bu tarihten sonra bekleyenler “geciken” olarak işaretlenir.</span>
            </div>
          </div>
        </section>
      )}

      {/* 2 · Form ve ağırlıklar */}
      {step === 1 && (
        <section className="bz-card max-w-3xl space-y-5 p-5" aria-labelledby="step-form">
          <h2 id="step-form" className="text-[16px] font-bold text-foreground">
            Form ve ağırlıklar
          </h2>
          <div className="bz-form-row">
            <label className="bz-label" htmlFor="question-set">
              Soru seti <span className="bz-req">*</span>
            </label>
            <select
              id="question-set"
              className="bz-field"
              value={questionSetId}
              onChange={(e) => setQuestionSetId(e.target.value)}
              aria-invalid={touched && !!errors.questionSet}
            >
              <option value="">Seçin…</option>
              {activeSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s._count?.items ?? s.itemCount ?? 0} soru)
                </option>
              ))}
            </select>
            <span className="bz-hint">
              Puan yalnız ölçek (SCALE) sorularından hesaplanır; açık uçlu sorular yorum olarak raporlanır. Form, dönem
              başlatılınca dondurulur.
            </span>
            {touched && errors.questionSet && <span className="bz-error-text">{errors.questionSet}</span>}
          </div>

          <fieldset>
            <legend className="bz-label">Değerlendirici grubu ağırlıkları</legend>
            <p className="bz-hint mb-3">
              Birleşik puanda her grubun payı. Eşik altında kalıp gizlenen grup hesaptan çıkar; kalan ağırlıklar
              yeniden orantılanır.
            </p>
            <div className="space-y-3">
              {RELATIONS.map((r) => {
                const share = weightTotal > 0 ? Math.round(((weights[r] || 0) / weightTotal) * 100) : 0;
                return (
                  <div key={r} className="grid grid-cols-[110px_minmax(0,1fr)_72px_44px] items-center gap-3">
                    <label htmlFor={`w-${r}`} className="text-[13px] font-semibold text-foreground">
                      {RELATION_LABEL[r]}
                    </label>
                    <input
                      type="range"
                      className="bz-range"
                      min={0}
                      max={100}
                      step={5}
                      value={weights[r]}
                      style={{ "--bz-range-fill": `${weights[r]}%` } as React.CSSProperties}
                      onChange={(e) => setWeights((w) => ({ ...w, [r]: Number(e.target.value) }))}
                      aria-label={`${RELATION_LABEL[r]} ağırlığı`}
                    />
                    <input
                      id={`w-${r}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      className="bz-field bz-field--sm text-right tabular-nums"
                      value={weights[r]}
                      onChange={(e) =>
                        setWeights((w) => ({ ...w, [r]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))
                      }
                    />
                    <span className="text-right text-xs tabular-nums text-fg3">%{share}</span>
                  </div>
                );
              })}
            </div>
            {errors.weights && <p className="bz-error-text mt-2">{errors.weights}</p>}
          </fieldset>

          <div className="bz-form-grid">
            <div className="bz-form-row">
              <label className="bz-label" htmlFor="min-raters">
                Anonimlik eşiği
              </label>
              <input
                id="min-raters"
                type="number"
                inputMode="numeric"
                min={3}
                max={20}
                className="bz-field"
                value={minRaters}
                onChange={(e) => setMinRaters(Number(e.target.value) || 0)}
                aria-invalid={!!errors.minRaters}
              />
              <span className="bz-hint">
                Eş düzey ve ast puanları, grupta en az bu kadar kişi tamamladıysa yalnız grup ortalaması olarak
                gösterilir. En az 3.
              </span>
              {errors.minRaters && <span className="bz-error-text">{errors.minRaters}</span>}
            </div>
            <div className="bz-form-row">
              <span className="bz-label">Öz değerlendirme</span>
              <label className="flex items-center gap-3 text-[13px] text-fg2">
                <span className="bz-switch">
                  <input type="checkbox" checked={includeSelf} onChange={(e) => setIncludeSelf(e.target.checked)} />
                </span>
                Değerlendirilen kendini de değerlendirsin
              </label>
              <span className="bz-hint">Öz puan ile diğerleri arasındaki fark kör noktaları gösterir.</span>
            </div>
          </div>
          <ShareWithEmployeeControl
            value={shareWithEmployee}
            onChange={setShareWithEmployee}
            label="Sonuçları personelle paylaş"
            requirement="Personel, dönem kapanıp İK sonucu yayınladıktan sonra portalında görür."
          />
          <p className="bz-hint -mt-3">
            Paylaşım yalnız İK sonucu yayınladıktan sonra geçerli olur; kapanmış dönemde de değiştirilebilir.
          </p>
          <div className="bz-callout flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="text-[13px]">
              Yönetici puanı yöneticinin adıyla, eş düzey ve ast puanları yalnız grup ortalaması olarak raporlanır.
              Kimin ne verdiği hiçbir ekranda görünmez.
            </p>
          </div>
        </section>
      )}

      {/* 3 · Değerlendiriciler */}
      {step === 2 && (
        <section className="space-y-3" aria-labelledby="step-raters">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="step-raters" className="mr-auto text-[16px] font-bold text-foreground">
              Değerlendiriciler
              <span className="ml-2 text-[13px] font-normal text-fg3">
                {plan.length} kişi · {totalRaters} değerlendirme
              </span>
            </h2>
            <button
              type="button"
              className="bz-btn bz-btn--ghost"
              onClick={() => void reSuggestAll()}
              disabled={plan.length === 0 || suggest.isPending}
            >
              {suggest.isPending ? <Loader2 className="animate-spin" /> : <Wand2 />}
              Yeniden öner
            </button>
            <SubjectPicker
              people={people}
              existing={new Set(plan.map((s) => s.personnelId))}
              onAdd={(ids) => void addSubjects(ids)}
              disabled={suggest.isPending}
            />
          </div>
          {touched && errors.plan && <p className="bz-error-text">{errors.plan}</p>}
          <RaterBoard
            people={people}
            plan={plan}
            onChange={setPlan}
            anonymityMinRaters={minRaters}
            onRemoveSubject={(id) => setPlan((p) => p.filter((s) => s.personnelId !== id))}
          />
        </section>
      )}

      {/* 4 · Önizle ve başlat */}
      {step === 3 && (
        <section className="max-w-3xl space-y-4" aria-labelledby="step-preview">
          <div className="bz-card p-5">
            <h2 id="step-preview" className="mb-3 text-[16px] font-bold text-foreground">
              Önizleme
            </h2>
            <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-fg3">Dönem</dt>
                <dd className="font-semibold text-foreground">{name}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-fg3">Sıklık</dt>
                <dd className="text-foreground">{FREQUENCY_LABEL[frequency]}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-fg3">Soru seti</dt>
                <dd className="text-foreground">{selectedSet?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-fg3">Ağırlıklar</dt>
                <dd className="text-foreground">
                  {RELATIONS.map((r) => `${RELATION_LABEL[r]} ${weights[r]}`).join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-fg3">Personelle paylaşım</dt>
                <dd className="text-foreground">
                  {shareWithEmployee === null ? "Kurum varsayılanı" : shareWithEmployee ? "Paylaş" : "Paylaşma"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-fg3">Anonimlik eşiği</dt>
                <dd className="text-foreground">En az {minRaters} kişi</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-fg3">Kapsam</dt>
                <dd className="text-foreground">
                  <b>{plan.length}</b> değerlendirilen · <b>{totalRaters}</b> değerlendirme ·{" "}
                  <b>{new Set(plan.flatMap((s) => s.raters.map((r) => r.personnelId))).size}</b> değerlendirici
                </dd>
              </div>
            </dl>
          </div>

          {(belowThreshold.length > 0 || noRaters.length > 0) && (
            <div className="bz-alert bz-alert--warning" role="status">
              <AlertTriangle aria-hidden="true" />
              <div>
                <p className="bz-alert__title">Başlatmadan önce gözden geçirin</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[13px]">
                  {belowThreshold.map(({ s, rel, n }) => (
                    <li key={`${s.personnelId}-${rel}`}>
                      {personName(byId.get(s.personnelId) ?? { firstName: "?", lastName: "" })}:{" "}
                      {RELATION_LABEL[rel].toLocaleLowerCase("tr")} grubunda {n} kişi var; eşik {minRaters}. Hepsi
                      tamamlamazsa bu grubun sonucu gizlenir.
                    </li>
                  ))}
                  {noRaters.map((s) => (
                    <li key={`none-${s.personnelId}`}>
                      {personName(byId.get(s.personnelId) ?? { firstName: "?", lastName: "" })}: yalnız öz değerlendirme
                      var.
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <p className="text-[13px] text-fg2">
            Başlatınca değerlendiricilere uygulama içi bildirim oluşturulur; SMTP bağlıysa e-posta da gönderilir. Form ve
            ağırlıklar başlatıldıktan sonra değiştirilemez; değerlendirici ekleyip çıkarabilirsiniz.
          </p>
        </section>
      )}

      {/* Gezinme */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-divider pt-4">
        {step > 0 && (
          <button type="button" className="bz-btn" onClick={() => setStep((s) => s - 1)} disabled={!!saving}>
            <ArrowLeft />
            Geri
          </button>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <button type="button" className="bz-btn" onClick={() => void submit(false)} disabled={!!saving}>
                {saving === "draft" ? <Loader2 className="animate-spin" /> : <Save />}
                Taslak olarak kaydet
              </button>
              <button
                type="button"
                className="bz-btn bz-btn--primary"
                onClick={() => void submit(true)}
                disabled={!!saving}
              >
                {saving === "start" ? <Loader2 className="animate-spin" /> : <Rocket />}
                Dönemi başlat
              </button>
            </>
          ) : (
            <button type="button" className="bz-btn bz-btn--primary" onClick={next}>
              İleri
              <ArrowRight />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
