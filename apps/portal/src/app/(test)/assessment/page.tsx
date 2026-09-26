"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRight, ChevronLeft, Loader2,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
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
    const saved = answers[currentQuestion.id];
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
      toast.error(errorMessage(err, "Cevabın kaydedilemedi. Lütfen tekrar dene."));
      return false;
    }
  };

  const handleNext = async () => {
    if (!isAnswerValid() || !currentQuestion || !sessionId) return;

    setIsSubmitting(true);
    const saved = await submitAnswer(currentQuestion, currentAnswer);
    setIsSubmitting(false);
    if (!saved) return;

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
        toast.error(errorMessage(err, "Değerlendirme tamamlanamadı. Lütfen tekrar dene."));
      }
      return;
    }

    setDirection(1);
    setCurrentIndex((i) => i + 1);
  };

  const handleBack = () => {
    if (currentIndex === 0 || !currentQuestion) return;
    setDirection(-1);
    setCurrentIndex((i) => i - 1);
  };

  const variants = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
  };

  if (loadError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{
          background:
            "linear-gradient(135deg, hsl(200 13% 5%) 0%, hsl(153 40% 10%) 60%, hsl(200 10% 8%) 100%)",
        }}
      >
        <GlassCard className="rounded-2xl max-w-sm text-center">
          <AlertCircle className="h-10 w-10 text-accent-red mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Sorular Yüklenemedi
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
          <button
            onClick={() => router.replace("/welcome")}
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            Geri dön
          </button>
        </GlassCard>
      </div>
    );
  }

  if (!sessionId || !currentQuestion) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, hsl(200 13% 5%) 0%, hsl(153 40% 10%) 60%, hsl(200 10% 8%) 100%)",
        }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start p-4 pt-8"
      style={{
        background:
          "linear-gradient(135deg, hsl(200 13% 5%) 0%, hsl(153 40% 10%) 60%, hsl(200 10% 8%) 100%)",
      }}
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-xs">PH</span>
            </div>
          </div>
          <span className="text-sm text-white/60 tabular-nums">
            {currentIndex + 1} / {total}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-white/10 rounded-full mb-6 overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Question Card */}
        <div className="relative min-h-[360px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentQuestion.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <GlassCard className="rounded-2xl mb-4">
                {/* Phase tag */}
                <div className="flex items-center gap-2 mb-4">
                  {currentQuestion.phase === "ICEBREAKER" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent-teal/10 text-accent-teal">
                      Buz Kırma
                    </span>
                  )}
                  {currentQuestion.phase === "CORE" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      Ana Değerlendirme
                    </span>
                  )}
                  {currentQuestion.phase === "CLOSING" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-accent-purple/10 text-accent-purple">
                      Kapanış
                    </span>
                  )}
                </div>

                {/* Question Text */}
                <h2 className="text-lg sm:text-xl font-semibold text-foreground leading-snug mb-2">
                  {currentQuestion.text}
                </h2>
                {currentQuestion.subText && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {currentQuestion.subText}
                  </p>
                )}

                {/* Answer Area */}
                <div className="mt-4">
                  {/* Open-ended / Situational / Behavioral */}
                  {["OPEN_ENDED", "SITUATIONAL", "BEHAVIORAL"].includes(
                    currentQuestion.type,
                  ) && (
                    <div>
                      <textarea
                        value={String(currentAnswer)}
                        onChange={(e) => setCurrentAnswer(e.target.value)}
                        placeholder="Cevabını buraya yaz..."
                        rows={4}
                        className="w-full rounded-xl bg-muted/50 border border-border/50 p-4 text-base
                          placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2
                          focus:ring-primary/30 resize-none transition-colors"
                      />
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[11px] text-muted-foreground/60">
                          Doğru ya da yanlış cevap yoktur
                        </span>
                        <span
                          className={cn(
                            "text-[11px] tabular-nums",
                            String(currentAnswer).length < 3
                              ? "text-muted-foreground/40"
                              : "text-primary",
                          )}
                        >
                          {String(currentAnswer).length} karakter
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Scale */}
                  {currentQuestion.type === "SCALE" && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground w-16 text-right tabular-nums">
                          {scaleBounds(currentQuestion).min}
                        </span>
                        <input
                          type="range"
                          min={scaleBounds(currentQuestion).min}
                          max={scaleBounds(currentQuestion).max}
                          value={Number(currentAnswer)}
                          onChange={(e) => setCurrentAnswer(Number(e.target.value))}
                          className="flex-1 h-2 rounded-full accent-primary cursor-pointer"
                        />
                        <span className="text-sm text-muted-foreground w-16 tabular-nums">
                          {currentQuestion.maxScale ?? 10}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-4xl font-bold text-primary tabular-nums">
                          {currentAnswer}
                        </span>
                        <span className="text-lg text-muted-foreground">
                          /{scaleBounds(currentQuestion).max}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Multiple Choice */}
                  {currentQuestion.type === "MULTIPLE_CHOICE" &&
                    !currentQuestion.options && (
                      <p className="text-sm text-muted-foreground">
                        Bu soru için seçenek tanımlanmamış. Lütfen İK ile iletişime geçin.
                      </p>
                    )}
                  {currentQuestion.type === "MULTIPLE_CHOICE" &&
                    currentQuestion.options && (
                      <div className="grid gap-2">
                        {Object.entries(currentQuestion.options).map(
                          ([key, val]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setCurrentAnswer(key)}
                              className={cn(
                                "w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all",
                                currentAnswer === key
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/50 bg-muted/30 text-foreground hover:border-primary/30 hover:bg-primary/5",
                              )}
                            >
                              <span className="font-bold mr-2">{key}.</span>
                              {val}
                            </button>
                          ),
                        )}
                      </div>
                    )}
                </div>
              </GlassCard>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={handleBack}
            disabled={currentIndex === 0 || isSubmitting || isCompleting}
            className="h-12 px-4 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground
              hover:bg-accent hover:text-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed
              flex items-center gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Geri
          </button>

          <motion.button
            onClick={handleNext}
            disabled={!isAnswerValid() || isSubmitting || isCompleting}
            className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm
              hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
            whileHover={isAnswerValid() ? { scale: 1.01 } : {}}
            whileTap={isAnswerValid() ? { scale: 0.98 } : {}}
          >
            {isSubmitting || isCompleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isCompleting ? "Tamamlanıyor..." : "Gönderiliyor..."}
              </>
            ) : currentIndex === total - 1 ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Tamamla
              </>
            ) : (
              <>
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
