"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Loader2, Shield, UserX } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { AppMark } from "@/components/AppMark";
import { api, errorCode, errorMessage, hasToken } from "@/lib/api";
import { RELATION_FOR_RATER, formatDue, privacyNote, type ReviewAssignmentStatus, type ReviewRelation } from "@/lib/reviews";

interface Question {
  id: string;
  text: string;
  subText: string | null;
  type: "OPEN_ENDED" | "SCALE" | "MULTIPLE_CHOICE" | "SITUATIONAL" | "BEHAVIORAL";
  options: Record<string, string> | null;
  minScale: number | null;
  maxScale: number | null;
  order: number;
  isRequired: boolean;
}

interface Saved {
  questionId: string;
  scaleValue: number | null;
  choiceKey: string | null;
  textAnswer: string | null;
}

interface Detail {
  id: string;
  relation: ReviewRelation;
  status: ReviewAssignmentStatus;
  subject: { firstName: string; lastName: string; position: string; department: string | null };
  cycle: { id: string; name: string; description: string | null; dueAt: string | null; anonymityMinRaters: number };
  questions: Question[];
  answers: Saved[];
}

type Value = number | string;

function isAnswered(q: Question, v: Value | undefined) {
  if (v === undefined) return false;
  if (q.type === "SCALE") return typeof v === "number";
  return String(v).trim().length > 0;
}

/** Ölçeğin uç etiketleri (1–5 Likert için) */
function scaleLabels(min: number, max: number) {
  if (max - min === 4) return ["Hiç katılmıyorum", "Tamamen katılıyorum"];
  return ["En düşük", "En yüksek"];
}

export default function ReviewFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [values, setValues] = useState<Record<string, Value>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [missing, setMissing] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const lastAnswerAt = useRef<number>(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get(`/api/reviews/portal/assignments/${id}`);
      const d: Detail = data.data;
      setDetail(d);
      const v: Record<string, Value> = {};
      for (const a of d.answers) {
        if (a.scaleValue !== null) v[a.questionId] = a.scaleValue;
        else if (a.choiceKey) v[a.questionId] = a.choiceKey;
        else if (a.textAnswer) v[a.questionId] = a.textAnswer;
      }
      setValues(v);
      if (d.status === "COMPLETED") setDone(true);
    } catch (err) {
      setError(errorMessage(err, "Değerlendirme yüklenemedi"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!hasToken()) {
      router.replace("/login");
      return;
    }
    void load();
  }, [router, load]);

  async function start() {
    setStarting(true);
    try {
      await api.post(`/api/reviews/portal/assignments/${id}/start`);
      lastAnswerAt.current = Date.now();
      setDetail((d) => (d ? { ...d, status: "IN_PROGRESS" } : d));
    } catch (err) {
      toast.error(errorMessage(err, "Değerlendirme başlatılamadı"));
    } finally {
      setStarting(false);
    }
  }

  async function save(q: Question, value: Value) {
    const now = Date.now();
    const durationSec = Math.min(3600, Math.round((now - lastAnswerAt.current) / 1000));
    lastAnswerAt.current = now;
    setSaving((s) => ({ ...s, [q.id]: true }));
    try {
      const payload =
        q.type === "SCALE"
          ? { scaleValue: value }
          : q.type === "MULTIPLE_CHOICE"
            ? { choiceKey: value }
            : { textAnswer: String(value) };
      await api.post(`/api/reviews/portal/assignments/${id}/answer`, { questionId: q.id, durationSec, ...payload });
      setMissing((m) => {
        if (!m.has(q.id)) return m;
        const n = new Set(m);
        n.delete(q.id);
        return n;
      });
    } catch (err) {
      toast.error(errorMessage(err, "Cevap kaydedilemedi"));
    } finally {
      setSaving((s) => ({ ...s, [q.id]: false }));
    }
  }

  async function complete() {
    if (!detail) return;
    const miss = detail.questions.filter((q) => q.isRequired && !isAnswered(q, values[q.id]));
    if (miss.length > 0) {
      setMissing(new Set(miss.map((q) => q.id)));
      toast.error(`${miss.length} zorunlu soru cevaplanmadı`);
      document.getElementById(`q-${miss[0]!.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setCompleting(true);
    try {
      await api.post(`/api/reviews/portal/assignments/${id}/complete`);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (errorCode(err) === "MISSING_ANSWERS") {
        const ids: string[] = (err as { response?: { data?: { details?: { questionIds?: string[] } } } })?.response?.data?.details?.questionIds ?? [];
        setMissing(new Set(ids));
      }
      toast.error(errorMessage(err, "Değerlendirme tamamlanamadı"));
    } finally {
      setCompleting(false);
    }
  }

  async function decline() {
    try {
      await api.post(`/api/reviews/portal/assignments/${id}/decline`);
      toast.success("Bu değerlendirme listenizden kaldırıldı");
      router.replace("/reviews");
    } catch (err) {
      toast.error(errorMessage(err, "İşlem tamamlanamadı"));
    }
  }

  const subjectName = detail
    ? detail.relation === "SELF"
      ? "Kendiniz"
      : `${detail.subject.firstName} ${detail.subject.lastName}`
    : "";
  const required = detail?.questions.filter((q) => q.isRequired) ?? [];
  const answeredRequired = required.filter((q) => isAnswered(q, values[q.id])).length;
  const pct = required.length > 0 ? Math.round((answeredRequired / required.length) * 100) : 0;

  return (
    <main className="bz-aurora flex min-h-dvh w-full justify-center px-4 py-8 sm:py-12">
      <motion.div
        className="w-full max-w-[640px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link href="/reviews" className="bz-btn bz-btn--ghost bz-btn--sm text-fg2">
            <ArrowLeft />
            Listeye dön
          </Link>
          <AppMark size="sm" />
        </div>

        {loading ? (
          <GlassCard className="rounded-3xl p-8">
            <div role="status" className="flex flex-col items-center gap-3 py-8 text-fg3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Yükleniyor…</p>
            </div>
          </GlassCard>
        ) : error || !detail ? (
          <GlassCard className="rounded-3xl p-6">
            <div role="alert" className="bz-empty px-2 py-6">
              <span className="bz-icon-box text-danger">
                <AlertCircle />
              </span>
              <p className="bz-empty__title">Değerlendirme açılamadı</p>
              <p className="bz-empty__text">{error ?? "Bu değerlendirme artık erişilebilir değil."}</p>
              <Link href="/reviews" className="bz-btn bz-btn--soft mt-2">
                Listeye dön
              </Link>
            </div>
          </GlassCard>
        ) : done ? (
          <GlassCard className="rounded-3xl p-6 text-center sm:p-8">
            <span className="bz-icon-box mx-auto text-success">
              <CheckCircle2 />
            </span>
            <h1 className="mt-3 font-display text-[22px] font-extrabold text-foreground">Teşekkürler!</h1>
            <p className="mx-auto mt-1.5 max-w-[40ch] text-[14px] leading-relaxed text-fg2">
              {subjectName === "Kendiniz" ? "Öz değerlendirmeniz" : `${subjectName} için değerlendirmeniz`} kaydedildi.
            </p>
            <Link href="/reviews" className="bz-btn bz-btn--primary bz-btn--lg mt-6">
              Diğer değerlendirmeler
              <ArrowRight />
            </Link>
          </GlassCard>
        ) : (
          <>
            <GlassCard className="rounded-3xl p-5 shadow-2 sm:p-7">
              <p className="bz-kicker">{detail.cycle.name}</p>
              <h1 className="mt-1 font-display text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
                {subjectName}
              </h1>
              <p className="mt-0.5 text-[13.5px] text-fg3">
                {RELATION_FOR_RATER[detail.relation]} · {detail.subject.position}
                {detail.subject.department ? ` · ${detail.subject.department}` : ""}
              </p>
              {formatDue(detail.cycle.dueAt) && (
                <p className="mt-1 text-[12.5px] text-fg3">Son gün: {formatDue(detail.cycle.dueAt)}</p>
              )}
              <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-fg2">
                <Shield className="mt-0.5 h-4 w-4 flex-none text-fg3" aria-hidden="true" />
                <span>{privacyNote(detail.relation, detail.cycle.anonymityMinRaters)}</span>
              </p>

              {detail.status === "NOT_STARTED" ? (
                <>
                  <p className="mt-4 text-[14px] leading-relaxed text-fg2">
                    {detail.questions.length} soru · yaklaşık {Math.max(3, Math.round(detail.questions.length * 0.5))} dakika.
                    Her ifade için gözlemlerinize en uygun puanı seçin; doğru ya da yanlış cevap yoktur.
                  </p>
                  <button
                    type="button"
                    onClick={() => void start()}
                    disabled={starting}
                    className={cn("bz-btn bz-btn--primary bz-btn--lg bz-btn--block mt-5", starting && "is-loading")}
                  >
                    {starting ? "Başlatılıyor…" : (
                      <>
                        Başla
                        <ArrowRight />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <div className="mt-4 flex items-center gap-2">
                  <div
                    className="bz-progress flex-1"
                    role="progressbar"
                    aria-label="Zorunlu soruların cevaplanma oranı"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ "--value": `${pct}%` } as React.CSSProperties} />
                  </div>
                  <span className="text-xs tabular-nums text-fg3">
                    {answeredRequired}/{required.length}
                  </span>
                </div>
              )}

              {detail.relation !== "SELF" && (
                <button
                  type="button"
                  className="bz-btn bz-btn--ghost bz-btn--sm mt-3 text-fg2"
                  onClick={() => setDeclineOpen((v) => !v)}
                  aria-expanded={declineOpen}
                >
                  <UserX />
                  Bu kişiyi değerlendiremem
                </button>
              )}
              {declineOpen && (
                <div className="bz-well mt-2 rounded-2xl p-3.5 text-[13px] text-fg2">
                  <p>
                    Bu kişiyle yeterince çalışmadıysanız değerlendirmeyi bırakabilirsiniz. Verdiğiniz cevaplar silinir; İK panelinde
                    “reddetti” olarak görünür.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button type="button" className="bz-btn bz-btn--sm" onClick={() => setDeclineOpen(false)}>
                      Vazgeç
                    </button>
                    <button type="button" className="bz-btn bz-btn--danger bz-btn--sm" onClick={() => void decline()}>
                      Değerlendirmeyi bırak
                    </button>
                  </div>
                </div>
              )}
            </GlassCard>

            {detail.status === "IN_PROGRESS" && (
              <ol className="mt-4 space-y-3">
                {detail.questions.map((q, idx) => {
                  const v = values[q.id];
                  const isMissing = missing.has(q.id);
                  return (
                    <li key={q.id} id={`q-${q.id}`}>
                      <GlassCard
                        className={cn(
                          "rounded-3xl p-5 sm:p-6",
                          isMissing && "ring-2 ring-[var(--bz-danger-tone)]",
                        )}
                      >
                        <p className="text-[12px] font-semibold text-fg3">
                          {idx + 1} / {detail.questions.length}
                          {!q.isRequired && " · isteğe bağlı"}
                          {saving[q.id] && " · kaydediliyor…"}
                        </p>
                        <p id={`qt-${q.id}`} className="mt-1 text-[16px] font-semibold leading-snug text-foreground">
                          {q.text}
                        </p>
                        {q.subText && <p className="mt-1 text-[13px] text-fg3">{q.subText}</p>}

                        {q.type === "SCALE" ? (
                          <ScaleInput q={q} value={typeof v === "number" ? v : undefined} onPick={(n) => {
                            setValues((s) => ({ ...s, [q.id]: n }));
                            void save(q, n);
                          }} />
                        ) : q.type === "MULTIPLE_CHOICE" && q.options ? (
                          <div className="mt-3 grid gap-2" role="radiogroup" aria-labelledby={`qt-${q.id}`}>
                            {Object.entries(q.options).map(([key, label]) => (
                              <label key={key} className="bz-choice-card">
                                <input
                                  type="radio"
                                  name={`q-${q.id}`}
                                  checked={v === key}
                                  onChange={() => {
                                    setValues((s) => ({ ...s, [q.id]: key }));
                                    void save(q, key);
                                  }}
                                />
                                <span className="text-[14px]">{label}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            className="bz-field mt-3 min-h-[96px] py-2.5"
                            aria-labelledby={`qt-${q.id}`}
                            value={typeof v === "string" ? v : ""}
                            maxLength={5000}
                            placeholder="Somut bir örnekle yazmanız en faydalısı olur."
                            onChange={(e) => setValues((s) => ({ ...s, [q.id]: e.target.value }))}
                            onBlur={(e) => {
                              const text = e.target.value.trim();
                              const saved = detail.answers.find((a) => a.questionId === q.id)?.textAnswer ?? "";
                              if (text || saved || q.isRequired) void save(q, text);
                            }}
                          />
                        )}
                        {isMissing && <p className="bz-error-text mt-2">Bu soru zorunlu; lütfen cevaplayın.</p>}
                      </GlassCard>
                    </li>
                  );
                })}
              </ol>
            )}

            {detail.status === "IN_PROGRESS" && (
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => void complete()}
                  disabled={completing}
                  className={cn("bz-btn bz-btn--primary bz-btn--lg bz-btn--block", completing && "is-loading")}
                >
                  {completing ? "Gönderiliyor…" : (
                    <>
                      Değerlendirmeyi tamamla
                      <CheckCircle2 />
                    </>
                  )}
                </button>
                <p className="bz-hint mt-2 text-center">Cevaplarınız her seçimde kaydedilir; daha sonra devam edebilirsiniz.</p>
              </div>
            )}
          </>
        )}
      </motion.div>
    </main>
  );
}

/** Ölçek seçimi: radyo grubu (ok tuşlarıyla gezilir), dokunmatikte ≥ 44px hedef */
function ScaleInput({ q, value, onPick }: { q: Question; value: number | undefined; onPick: (n: number) => void }) {
  const min = q.minScale ?? 1;
  const max = q.maxScale ?? 10;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const [lo, hi] = scaleLabels(min, max);
  return (
    <fieldset className="mt-3">
      <legend className="sr-only">{q.text}</legend>
      <div className="flex gap-1.5" style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((n) => (
          <label
            key={n}
            className={cn(
              "flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border text-[16px] font-bold tabular-nums transition-colors",
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              value === n
                ? "border-transparent bg-brand text-[var(--bz-accent-contrast)]"
                : "border-divider bg-surface-2 text-foreground hover:bg-hover",
            )}
          >
            <input
              type="radio"
              name={`scale-${q.id}`}
              value={n}
              checked={value === n}
              onChange={() => onPick(n)}
              className="sr-only"
              aria-label={`${n}${n === min ? ` (${lo})` : n === max ? ` (${hi})` : ""}`}
            />
            {n}
          </label>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-fg3">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </fieldset>
  );
}
