"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { PortalHeader } from "@/components/PortalHeader";
import { api, errorCode, errorMessage, hasToken } from "@/lib/api";

interface Question {
  id: string;
  text: string;
  subText: string | null;
  type: "OPEN_ENDED" | "SCALE" | "MULTIPLE_CHOICE" | "SITUATIONAL" | "BEHAVIORAL";
  phase: "ICEBREAKER" | "CORE" | "CLOSING";
  options?: Record<string, string> | null;
  minScale?: number | null;
  maxScale?: number | null;
  isRequired?: boolean;
}

interface SavedAnswer {
  questionId: string;
  textAnswer: string | null;
  scaleValue: number | null;
  choiceKey: string | null;
}

interface ActiveSessionResponse {
  id: string;
  status: "NOT_STARTED" | "IN_PROGRESS";
  questions: Question[];
  answers: SavedAnswer[];
}

type AnswerValue = string | number;

function scaleBounds(q: Question) {
  return { min: q.minScale ?? 1, max: q.maxScale ?? 10 };
}

function defaultAnswer(q: Question): AnswerValue {
  if (q.type !== "SCALE") return "";
  const { min, max } = scaleBounds(q);
  return Math.round((min + max) / 2);
}

function savedToValue(q: Question, a: SavedAnswer): AnswerValue | undefined {
  if (q.type === "SCALE") return a.scaleValue ?? undefined;
  if (q.type === "MULTIPLE_CHOICE") return a.choiceKey ?? undefined;
  return a.textAnswer ?? undefined;
}

function answerPayload(q: Question, value: AnswerValue) {
  if (q.type === "SCALE") return { scaleValue: Number(value) };
  if (q.type === "MULTIPLE_CHOICE") return { choiceKey: String(value) };
  return { textAnswer: String(value).trim() };
}

function generateDedupeKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function AssessmentPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [currentAnswer, setCurrentAnswer] = useState<AnswerValue>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [direction, setDirection] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Soru başına sabit anahtar: aynı cevabın tekrar gönderimi idempotent olur
  const dedupeKeysRef = useRef<Record<string, string>>({});
  const questionShownAtRef = useRef<number>(Date.now());
  /** Geri gidildiğinde henüz kaydedilmemiş (İleri'ye basılmamış) cevaplar kaybolmasın */
  const draftsRef = useRef<Record<string, AnswerValue>>({});

  useEffect(() => {
    if (!hasToken()) {
      router.replace("/login");
      return;
    }

    (async () => {
      try {
        const { data } = await api.get<{ data: ActiveSessionResponse | null }>(
          "/api/sessions/portal/sessions/active",
        );
        const active = data.data;
        if (!active) {
          router.replace("/welcome");
          return;
        }
        if (active.status !== "IN_PROGRESS") {
          // Başlatılmamış oturum: rıza adımı karşılama sayfasında
          router.replace("/welcome");
          return;
        }
        if (active.questions.length === 0) {
          setLoadError("Bu değerlendirmede soru bulunmuyor.");
          return;
        }

        const restored: Record<string, AnswerValue> = {};
        for (const a of active.answers) {
          const q = active.questions.find((x) => x.id === a.questionId);
          const v = q ? savedToValue(q, a) : undefined;
          if (q && v !== undefined) restored[q.id] = v;
        }

        setSessionId(active.id);
        setQuestions(active.questions);
        setAnswers(restored);
        // Kaldığı yerden: ilk cevaplanmamış soru
        const firstOpen = active.questions.findIndex((q) => restored[q.id] === undefined);
        setCurrentIndex(firstOpen === -1 ? active.questions.length - 1 : firstOpen);
      } catch (err) {
        setLoadError(errorMessage(err, "Sorular yüklenemedi"));
      }
    })();
  }, [router]);

  const currentQuestion = questions[currentIndex];
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progress = total > 0 ? (answeredCount / total) * 100 : 0;

  useEffect(() => {
    if (!currentQuestion) return;
    const saved = draftsRef.current[currentQuestion.id] ?? answers[currentQuestion.id];
    setCurrentAnswer(saved ?? defaultAnswer(currentQuestion));
    questionShownAtRef.current = Date.now();
    // Yalnızca soru değiştiğinde çalışır; `answers` güncellemesi yazılan cevabı ezmesin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

  const isAnswerValid = useCallback(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === "SCALE") {
      const { min, max } = scaleBounds(currentQuestion);
      const v = Number(currentAnswer);
      return Number.isInteger(v) && v >= min && v <= max;
    }
    if (currentQuestion.type === "MULTIPLE_CHOICE") return String(currentAnswer).length > 0;
    return String(currentAnswer).trim().length >= 3;
  }, [currentAnswer, currentQuestion]);

  const getDedupeKey = (questionId: string) => {
    if (!dedupeKeysRef.current[questionId]) {
      dedupeKeysRef.current[questionId] = generateDedupeKey();
    }
    return dedupeKeysRef.current[questionId];
  };

  /** Cevabı kaydeder; başarısızsa kullanıcıyı bilgilendirir ve ilerlemeyi durdurur. */
  const submitAnswer = async (question: Question, value: AnswerValue): Promise<boolean> => {
    if (!sessionId) return false;
    try {
      await api.post(`/api/sessions/portal/sessions/${sessionId}/answer`, {
        questionId: question.id,
        ...answerPayload(question, value),
        durationSec: Math.round((Date.now() - questionShownAtRef.current) / 1000),
        clientDedupeKey: getDedupeKey(question.id),
      });
      return true;
    } catch (err) {
      toast.error(errorMessage(err, "Cevabınız kaydedilemedi. Lütfen tekrar deneyin."));
      return false;
    }
  };

  const handleNext = async () => {
    if (!isAnswerValid() || !currentQuestion || !sessionId) return;

    setIsSubmitting(true);
    const saved = await submitAnswer(currentQuestion, currentAnswer);
    setIsSubmitting(false);
    if (!saved) return;

    delete draftsRef.current[currentQuestion.id];
    const updatedAnswers = { ...answers, [currentQuestion.id]: currentAnswer };
    setAnswers(updatedAnswers);

    if (currentIndex === total - 1) {
      setIsCompleting(true);
      try {
        await api.post(`/api/sessions/portal/sessions/${sessionId}/complete`);
        router.replace("/complete");
      } catch (err) {
        setIsCompleting(false);
        if (errorCode(err) === "MISSING_ANSWERS") {
          const firstMissing = questions.findIndex((q) => updatedAnswers[q.id] === undefined);
          if (firstMissing !== -1) {
            setDirection(-1);
            setCurrentIndex(firstMissing);
          }
        }
        toast.error(errorMessage(err, "Değerlendirme tamamlanamadı. Lütfen tekrar deneyin."));
      }
      return;
    }

    setDirection(1);
    setCurrentIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (currentIndex === 0 || !currentQuestion) return;
    // Taslak ayrı tutulur: `answers`a yazılsaydı kaydedilmemiş cevap "cevaplandı" sayılırdı
    draftsRef.current[currentQuestion.id] = currentAnswer;
    setDirection(-1);
    setCurrentIndex((i) => i - 1);
  };

  // Soru geçişi: kısa yatay kayma (DESIGN.md §5 — en çok 24px)
  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 16 : -16 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -16 : 16 }),
  };

  // Aşama etiketi: buz kırma bilgi tonu, diğerleri nötr çip (yeşil yalnız birincil eylemde)
  const PHASE_CHIP: Record<Question["phase"], { label: string; className: string }> = {
    ICEBREAKER: { label: "Buz kırma", className: "bz-chip bz-chip--info" },
    CORE: { label: "Ana değerlendirme", className: "bz-chip" },
    CLOSING: { label: "Kapanış", className: "bz-chip" },
  };

  if (loadError) {
    return (
      <main className="bz-aurora flex min-h-dvh w-full items-center justify-center px-4 py-10">
        <GlassCard className="w-full max-w-[400px] rounded-3xl p-0 shadow-2">
          <div role="alert" className="bz-empty px-6 py-10">
            <span className="bz-icon-box text-danger">
              <AlertCircle />
            </span>
            <p className="bz-empty__title">Sorular yüklenemedi</p>
            <p className="bz-empty__text">{loadError}</p>
            <button type="button" onClick={() => router.replace("/welcome")} className="bz-btn mt-2">
              <ChevronLeft />
              Karşılama ekranına dön
            </button>
          </div>
        </GlassCard>
      </main>
    );
  }

  if (!sessionId || !currentQuestion) {
    // Yükleniyor: soru ekranının şeklinde iskelet (DESIGN.md §17)
    return (
      <main className="bz-aurora min-h-dvh w-full px-4 pb-10 pt-4 sm:pt-10">
        <div
          role="status"
          aria-label="Sorular yükleniyor"
          className="mx-auto w-full max-w-[560px]"
        >
          <span className="bz-sr-only">Yükleniyor…</span>
          <PortalHeader>
            <span className="bz-skeleton h-4 w-24" />
          </PortalHeader>
          <div className="bz-skeleton mb-6 h-1.5 rounded-full" />
          <div className="bz-card rounded-3xl p-5 shadow-2 sm:p-7">
            <div className="bz-skeleton h-6 w-28 rounded-full" />
            <div className="bz-skeleton mt-4 h-6 w-11/12" />
            <div className="bz-skeleton mt-2 h-6 w-3/4" />
            <div className="bz-skeleton mt-6 h-[140px] rounded-xl" />
          </div>
          <div className="mt-4 flex gap-3">
            <div className="bz-skeleton h-11 w-24 rounded-xl" />
            <div className="bz-skeleton h-11 flex-1 rounded-xl" />
          </div>
        </div>
      </main>
    );
  }

  const phase = PHASE_CHIP[currentQuestion.phase] ?? PHASE_CHIP.CORE;
  const isTextQuestion = ["OPEN_ENDED", "SITUATIONAL", "BEHAVIORAL"].includes(currentQuestion.type);
  const answerLength = String(currentAnswer).length;
  const { min: scaleMin, max: scaleMax } = scaleBounds(currentQuestion);
  const scaleValues = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
  // Telefonda en çok 5 sütun (her karo ≥ 44px); geniş ekranda 10'a kadar tek satır
  const scaleCols = Math.min(scaleValues.length, 5);
  const scaleColsWide = scaleValues.length <= 10 ? scaleValues.length : Math.ceil(scaleValues.length / 2);
  const busy = isSubmitting || isCompleting;

  return (
    // Telefonda dikey esnek düzen: soru alanı boşluğu doldurur, eylem şeridi her zaman ekranın altında
    <main className="bz-aurora flex min-h-dvh w-full flex-col px-4 pt-4 sm:block sm:pb-10 sm:pt-10">
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col sm:block">
        <PortalHeader>
          <span className="flex-none text-[13px] tabular-nums text-fg2">
            Soru <b className="font-semibold text-foreground">{currentIndex + 1}</b> / {total}
          </span>
        </PortalHeader>

        {/* İlerleme: cevaplanan soru oranı */}
        <div
          className="bz-progress mb-6"
          role="progressbar"
          aria-label="Değerlendirme ilerlemesi"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-valuetext={`${answeredCount} / ${total} soru cevaplandı`}
        >
          <span style={{ "--value": `${progress}%` } as React.CSSProperties} />
        </div>

        {/* Soru kartı */}
        {/* popLayout: çıkan kart akıştan hemen çıkar; geçişte yükseklik çökmez, düğmeler zıplamaz */}
        <div className="relative flex-1">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={currentQuestion.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <GlassCard className="rounded-3xl p-5 shadow-2 sm:p-7">
                {/* Aşama */}
                <span className={phase.className}>{phase.label}</span>

                {/* Soru */}
                <h1
                  id="question-title"
                  className="mt-4 font-display text-[19px] font-bold leading-snug tracking-[-0.01em] text-foreground sm:text-[21px]"
                >
                  {currentQuestion.text}
                </h1>
                {currentQuestion.subText && (
                  <p className="mt-2 text-sm leading-relaxed text-fg2">{currentQuestion.subText}</p>
                )}

                {/* Cevap alanı */}
                <div className="mt-5">
                  {/* Açık uçlu / durumsal / davranışsal */}
                  {isTextQuestion && (
                    <div className="bz-form-row">
                      <label htmlFor="answer-text" className="bz-sr-only">
                        Cevabınız
                      </label>
                      <textarea
                        id="answer-text"
                        value={String(currentAnswer)}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Cevabınızı buraya yazın…"
                        rows={5}
                        aria-describedby="answer-hint"
                        className="bz-field min-h-[140px] text-base sm:text-[15px]"
                      />
                      <div id="answer-hint" className="flex justify-between gap-3">
                        <span className="bz-hint">Doğru ya da yanlış cevap yoktur.</span>
                        <span className="bz-hint flex-none tabular-nums">
                          {answerLength} karakter{answerLength < 3 ? " · en az 3" : ""}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Ölçek: kaydırıcı yerine büyük sayı karoları — eldivenle de seçilir, her karo ≥ 44px
                      (DESIGN.md §12, §30). Yerel radyo grubu: ok tuşlarıyla gezinilir. */}
                  {currentQuestion.type === "SCALE" && (
                    <div className="grid gap-3">
                      <div
                        role="radiogroup"
                        aria-labelledby="question-title"
                        className="grid grid-cols-[repeat(var(--cols),minmax(0,1fr))] gap-2 sm:grid-cols-[repeat(var(--cols-wide),minmax(0,1fr))] sm:gap-1.5"
                        style={
                          { "--cols": scaleCols, "--cols-wide": scaleColsWide } as React.CSSProperties
                        }
                      >
                        {scaleValues.map((v) => (
                          <label
                            key={v}
                            className={cn(
                              "flex h-14 cursor-pointer select-none items-center justify-center rounded-xl border border-glass-border bg-surface",
                              // Üzerine gelme yalnız fareli cihazda: dokunmatikte :hover son dokunulan karoda takılı kalır
                              "font-display text-xl font-extrabold tabular-nums text-fg2 transition-colors [@media(hover:hover)]:hover:border-primary",
                              // Seçili: seçim kartıyla aynı (yeşil kenar + yeşil yumuşak zemin) + 2px kenar (yalnız renge dayanmaz)
                              "has-[:checked]:border-primary has-[:checked]:bg-brand-soft has-[:checked]:text-foreground has-[:checked]:shadow-[inset_0_0_0_1px_var(--bz-accent)]",
                              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                            )}
                          >
                            <input
                              type="radio"
                              name={`answer-${currentQuestion.id}`}
                              value={v}
                              checked={Number(currentAnswer) === v}
                              onChange={() => setCurrentAnswer(v)}
                              className="bz-sr-only"
                            />
                            {v}
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-between gap-3 text-xs text-fg3">
                        <span>{scaleMin} · en düşük</span>
                        <span aria-live="polite" className="text-fg2">
                          Seçiminiz:{" "}
                          <b className="font-semibold tabular-nums text-foreground">
                            {currentAnswer} / {scaleMax}
                          </b>
                        </span>
                        <span>{scaleMax} · en yüksek</span>
                      </div>
                    </div>
                  )}

                  {/* Çoktan seçmeli: seçenek tanımlanmamışsa kullanıcı bilgilendirilir */}
                  {currentQuestion.type === "MULTIPLE_CHOICE" && !currentQuestion.options && (
                    <div role="alert" className="bz-alert bz-alert--warning">
                      <AlertCircle />
                      <div>Bu soru için seçenek tanımlanmamış. Lütfen İK ile iletişime geçin.</div>
                    </div>
                  )}

                  {/* Çoktan seçmeli: seçim kartları (seçili → yeşil kenar + yeşil yumuşak zemin) */}
                  {currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options && (
                    <div role="radiogroup" aria-labelledby="question-title" className="grid gap-2.5">
                      {Object.entries(currentQuestion.options).map(([key, val]) => (
                        <label key={key} className="bz-choice-card min-h-14 items-center">
                          <input
                            type="radio"
                            name={`answer-${currentQuestion.id}`}
                            value={key}
                            checked={currentAnswer === key}
                            onChange={() => setCurrentAnswer(key)}
                          />
                          <span className="text-[15px] leading-snug text-foreground">
                            <span className="mr-1.5 font-semibold text-fg3">{key}.</span>
                            {val}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Gezinme: ikincil (Geri) + tek birincil (Sonraki / Tamamla).
            Telefonda ekranın altına yapışık cam şerit: uzun soruda ve klavye açıkken de erişilir. */}
        <div className="bz-glass-strong sticky bottom-0 z-10 -mx-4 mt-4 flex items-center gap-3 rounded-none border-x-0 border-b-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-none sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0 || busy}
            className="bz-btn bz-btn--lg"
          >
            <ChevronLeft />
            Geri
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!isAnswerValid() || busy}
            aria-busy={busy || undefined}
            className={cn("bz-btn bz-btn--primary bz-btn--lg flex-1", busy && "is-loading")}
          >
            {busy ? (
              isCompleting ? "Tamamlanıyor…" : "Kaydediliyor…"
            ) : currentIndex === total - 1 ? (
              <>
                <CheckCircle2 />
                Tamamla
              </>
            ) : (
              <>
                Sonraki
                <ChevronRight />
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
