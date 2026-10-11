"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Loader2, BrainCircuit,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import axios from "axios";
import { AppMark } from "@/components/AppMark";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

interface Question {
  id: string;
  text: string;
  subText: string | null;
  type: "OPEN_ENDED" | "SCALE" | "MULTIPLE_CHOICE" | "SITUATIONAL" | "BEHAVIORAL";
  phase: "ICEBREAKER" | "CORE" | "CLOSING";
  options?: Record<string, string> | null;
  minScale?: number | null;
  maxScale?: number | null;
  followUpPrompt?: string | null;
}

interface SessionData {
  id: string;
  questionSetSnapshot?: { questions?: Question[] };
  questions?: Question[];
}

function getAuthHeaders(): Record<string, string> {
  const token = sessionStorage.getItem("ph_portal_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function generateDedupeKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function AssessmentPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [currentAnswer, setCurrentAnswer] = useState<string | number>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [direction, setDirection] = useState(1);
  const [loadError, setLoadError] = useState(false);
  const dedupeKeysRef = useRef<Record<string, string>>({});

  useEffect(() => {
    const stored = sessionStorage.getItem("ph_session");
    if (!stored) {
      router.replace("/welcome");
      return;
    }
    try {
      const parsed: SessionData = JSON.parse(stored);
      setSession(parsed);

      const q =
        parsed.questions ??
        parsed.questionSetSnapshot?.questions ??
        [];
      if (q.length === 0) {
        setLoadError(true);
      } else {
        setQuestions(q);
      }
    } catch {
      setLoadError(true);
    }
  }, [router]);

  const currentQuestion = questions[currentIndex];
  const total = questions.length;
  const progress = total > 0 ? ((currentIndex) / total) * 100 : 0;

  useEffect(() => {
    if (!currentQuestion) return;
    const saved = answers[currentQuestion.id];
    setCurrentAnswer(saved ?? (currentQuestion.type === "SCALE" ? 5 : ""));
  }, [currentIndex, currentQuestion, answers]);

  const isAnswerValid = useCallback(() => {
    if (!currentQuestion) return false;
    if (currentQuestion.type === "SCALE") return true;
    if (currentQuestion.type === "MULTIPLE_CHOICE") return String(currentAnswer).length > 0;
    return String(currentAnswer).trim().length >= 3;
  }, [currentAnswer, currentQuestion]);

  const getDedupeKey = (questionId: string) => {
    if (!dedupeKeysRef.current[questionId]) {
      dedupeKeysRef.current[questionId] = generateDedupeKey();
    }
    return dedupeKeysRef.current[questionId];
  };

  const submitAnswer = async (questionId: string, answer: string | number) => {
    if (!session) return;
    try {
      await axios.post(
        `${API_BASE}/api/sessions/portal/sessions/${session.id}/answer`,
        {
          questionId,
          answer: String(answer),
          clientDedupeKey: getDedupeKey(questionId),
        },
        { headers: getAuthHeaders() },
      );
      dedupeKeysRef.current[questionId] = generateDedupeKey();
    } catch {
      // Silently continue — answers are stored locally and retry on next navigation
    }
  };

  const handleNext = async () => {
    if (!isAnswerValid() || !currentQuestion || !session) return;

    const updatedAnswers = { ...answers, [currentQuestion.id]: currentAnswer };
    setAnswers(updatedAnswers);

    setIsSubmitting(true);
    await submitAnswer(currentQuestion.id, currentAnswer);
    setIsSubmitting(false);

    if (currentIndex === total - 1) {
      setIsCompleting(true);
      try {
        await axios.post(
          `${API_BASE}/api/sessions/portal/sessions/${session.id}/complete`,
          {},
          { headers: getAuthHeaders() },
        );
        router.push("/complete");
      } catch {
        setIsCompleting(false);
      }
      return;
    }

    setDirection(1);
    setCurrentIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (currentIndex === 0 || !currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: currentAnswer }));
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

  if (loadError || (session && questions.length === 0 && !currentQuestion)) {
    return (
      <main className="bz-aurora flex min-h-dvh w-full items-center justify-center px-4 py-10">
        <GlassCard className="w-full max-w-[400px] rounded-3xl p-0 shadow-2">
          <div className="bz-empty px-6 py-10">
            <span className="bz-icon-box text-danger">
              <AlertCircle />
            </span>
            <p className="bz-empty__title">Sorular yüklenemedi</p>
            <p className="bz-empty__text">
              Oturum verilerinde bir sorun oluştu. Lütfen tekrar giriş yapın.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/welcome")}
              className="bz-btn mt-2"
            >
              Geri dön
            </button>
          </div>
        </GlassCard>
      </main>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <main
        role="status"
        aria-label="Yükleniyor"
        className="bz-aurora flex min-h-dvh w-full items-center justify-center"
      >
        <Loader2 className="h-7 w-7 animate-spin text-fg3" />
      </main>
    );
  }

  const phase = PHASE_CHIP[currentQuestion.phase] ?? PHASE_CHIP.CORE;
  const isTextQuestion = ["OPEN_ENDED", "SITUATIONAL", "BEHAVIORAL"].includes(currentQuestion.type);
  const answerLength = String(currentAnswer).length;
  const scaleMin = currentQuestion.minScale ?? 1;
  const scaleMax = currentQuestion.maxScale ?? 10;
  const scaleFill = ((Number(currentAnswer) - scaleMin) / (scaleMax - scaleMin || 1)) * 100;
  const busy = isSubmitting || isCompleting;

  return (
    <main className="bz-aurora min-h-dvh w-full px-4 pb-10 pt-5 sm:pt-10">
      <div className="mx-auto w-full max-w-[560px]">
        {/* Üst bilgi */}
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <AppMark size="sm" />
            <span className="truncate font-display text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
              PotansiyelHaritası
            </span>
          </div>
          <span className="flex-none text-[13px] tabular-nums text-fg2">
            Soru <b className="font-semibold text-foreground">{currentIndex + 1}</b> / {total}
          </span>
        </header>

        {/* İlerleme */}
        <div
          className="bz-progress mb-6"
          role="progressbar"
          aria-label="Değerlendirme ilerlemesi"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <span style={{ "--value": `${progress}%` } as React.CSSProperties} />
        </div>

        {/* Soru kartı */}
        <div className="relative min-h-[360px]">
          <AnimatePresence mode="wait" custom={direction}>
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
                  <p className="mt-2 text-sm leading-relaxed text-fg2">
                    {currentQuestion.subText}
                  </p>
                )}

                {/* Cevap alanı */}
                <div className="mt-5">
                  {/* Açık uçlu / durumsal / davranışsal */}
                  {isTextQuestion && (
                    <div className="bz-form-row">
                      <label htmlFor="answer-text" className="bz-sr-only">
                        Cevabın
                      </label>
                      <textarea
                        id="answer-text"
                        value={String(currentAnswer)}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Cevabını buraya yaz…"
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

                  {/* Ölçek */}
                  {currentQuestion.type === "SCALE" && (
                    <div className="space-y-5 pt-1">
                      <p className="text-center" aria-live="polite">
                        <span className="font-display text-5xl font-extrabold tabular-nums text-foreground">
                          {currentAnswer}
                        </span>
                        <span className="ml-1 text-lg tabular-nums text-fg3">/{scaleMax}</span>
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="w-6 text-right text-sm tabular-nums text-fg3">
                          {scaleMin}
                        </span>
                        <input
                          type="range"
                          min={scaleMin}
                          max={scaleMax}
                          value={Number(currentAnswer)}
                          onChange={(e) => setCurrentAnswer(Number(e.target.value))}
                          aria-labelledby="question-title"
                          className="bz-range flex-1 cursor-pointer"
                          style={{ "--bz-range-fill": `${scaleFill}%` } as React.CSSProperties}
                        />
                        <span className="w-6 text-sm tabular-nums text-fg3">{scaleMax}</span>
                      </div>
                    </div>
                  )}

                  {/* Çoktan seçmeli: seçim kartları (seçili → yeşil kenar + yeşil yumuşak zemin) */}
                  {currentQuestion.type === "MULTIPLE_CHOICE" &&
                    currentQuestion.options && (
                      <div role="radiogroup" aria-labelledby="question-title" className="grid gap-2.5">
                        {Object.entries(currentQuestion.options).map(([key, val]) => (
                          <label key={key} className="bz-choice-card">
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

              {/* AI takip sorusu */}
              {currentQuestion.followUpPrompt && (
                <div className="bz-alert bz-alert--info mt-3">
                  <BrainCircuit />
                  <div>AI takip sorusu hazırlanıyor…</div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Gezinme: ikincil (Geri) + tek birincil (Sonraki / Tamamla) */}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
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
              isCompleting ? "Tamamlanıyor…" : "Gönderiliyor…"
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
