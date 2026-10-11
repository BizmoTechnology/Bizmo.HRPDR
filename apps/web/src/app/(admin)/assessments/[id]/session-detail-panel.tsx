"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  BrainCircuit,
  MessageSquare,
  FileText,
  Heart,
  TrendingUp,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  FileDown,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import { dimensionColor } from "@/lib/dimension-colors";
import { AiNotConnectedNotice } from "@/components/ai/AiNotConnectedNotice";
import {
  useSession,
  useRunSessionAiAnalysis,
  useSubmitReview,
  useGenerateReport,
  useSessionReport,
  useAiStatus,
  type SessionDetail,
  type AnswerRow,
} from "@/hooks/use-api";

const DIMENSION_LABELS: Record<string, string> = {
  LOGICAL_ALGORITHMIC: "Mantıksal / Algoritmik",
  LEADERSHIP: "Liderlik",
  SOCIAL_INTELLIGENCE: "Sosyal Zeka",
  GROWTH_POTENTIAL: "Gelişim Potansiyeli",
  DOMAIN_ALIGNMENT: "Alan Uyumu",
};

/** Oturum durumu → Bizmo süreç durumu rozeti (DESIGN.md §13 `.bz-status`) */
const SESSION_STATUS: Record<string, { label: string; status: string }> = {
  NOT_STARTED: { label: "Başlamadı", status: "pending" },
  IN_PROGRESS: { label: "Devam ediyor", status: "progress" },
  PAUSED: { label: "Duraklatıldı", status: "pending" },
  COMPLETED: { label: "Tamamlandı", status: "done" },
  EXPIRED: { label: "Süresi doldu", status: "cancelled" },
};

const ANALYSIS_TABS = [
  { id: "answers" as const, label: "Cevaplar", icon: MessageSquare },
  { id: "hrpdr" as const, label: "HR PDR analizi", icon: FileText },
  { id: "psychological" as const, label: "Psikolojik analiz", icon: Heart },
];

type AnalysisTab = (typeof ANALYSIS_TABS)[number]["id"];

/** 0–10 puan → durum tonu (iyi ≥ 7 · dikkat ≥ 4 · zayıf) */
function scoreTone(score: number) {
  return score >= 7 ? "success" : score >= 4 ? "warning" : "danger";
}

/** Durum tonlu yumuşak karo (zemin + mürekkep metin) */
const TONE_TILE = {
  success: "bg-success-soft text-success-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
} as const;

/** Durum tonlu ilerleme çubuğu (DESIGN.md §18 `.bz-progress`; varsayılan yeşil) */
const TONE_PROGRESS = {
  success: "",
  warning: "bz-progress--warning",
  danger: "bz-progress--danger",
} as const;

/** Düzey (LOW · MODERATE · HIGH) → çip tonu ve etiketi */
function levelChip(level: string | undefined) {
  if (level === "LOW") return { className: "bz-chip--success", label: "Düşük" };
  if (level === "MODERATE") return { className: "bz-chip--warning", label: "Orta" };
  return { className: "bz-chip--danger", label: "Yüksek" };
}

const pct = (score: number) =>
  ({ "--value": `${Math.max(0, Math.min(100, (score / 10) * 100))}%` }) as CSSProperties;

/** Çekmece içindeki opak alt kart */
function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bz-card bz-card--flat p-4", className)}>
      <h4 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-foreground">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

/** AI analizi İK onayından sonra oluşturulur; onaydan önce analiz alanında gösterilir */
function AwaitingReviewNotice() {
  return (
    <div role="status" className="bz-alert bz-alert--info mt-2 max-w-sm text-left">
      <ShieldCheck aria-hidden="true" />
      <div className="min-w-0">
        <p className="bz-alert__title">Önce İK onayı</p>
        <p>
          AI analizi, cevaplar İK tarafından onaylandıktan sonra oluşturulur. Cevapları
          inceleyip yukarıdan onaylayın.
        </p>
      </div>
    </div>
  );
}

function AnalysisEmpty({
  icon,
  title,
  text,
  onRun,
  isRunning,
  hasAnswers,
  aiConnected,
  aiApproved,
  analysisBusy = false,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  onRun: () => void;
  isRunning: boolean;
  hasAnswers: boolean;
  aiConnected: boolean;
  aiApproved: boolean;
  /** Onayla başlayan arka plan analizi sürüyor */
  analysisBusy?: boolean;
}) {
  return (
    <div className="bz-empty">
      <span className="bz-icon-box">{icon}</span>
      <p className="bz-empty__title">{title}</p>
      <p className="bz-empty__text">{text}</p>
      {analysisBusy ? (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm text-fg2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          AI analizi oluşturuluyor…
        </p>
      ) : !aiApproved ? (
        <AwaitingReviewNotice />
      ) : aiConnected ? (
        <>
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || !hasAnswers}
            className="bz-btn bz-btn--data mt-2"
          >
            {isRunning ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {isRunning ? "Analiz yapılıyor" : "AI analizini başlat"}
          </button>
          {!hasAnswers && (
            <p className="bz-hint">Analiz için önce cevaplar gereklidir</p>
          )}
        </>
      ) : (
        <AiNotConnectedNotice feature="AI analizi" className="mt-2 max-w-sm" />
      )}
    </div>
  );
}

function RerunButton({
  onRun,
  isRunning,
  aiConnected,
  aiApproved,
}: {
  onRun: () => void;
  isRunning: boolean;
  aiConnected: boolean;
  aiApproved: boolean;
}) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning || !aiConnected || !aiApproved}
        title={
          !aiApproved
            ? "AI analizi İK onayından sonra oluşturulur"
            : aiConnected
              ? undefined
              : "AI entegrasyonu bağlı değil"
        }
        className="bz-btn bz-btn--subtle bz-btn--sm"
      >
        {isRunning ? <Loader2 className="animate-spin" /> : <Sparkles />}
        {isRunning ? "Analiz yapılıyor" : "Yeniden analiz et"}
      </button>
    </div>
  );
}

export function SessionDetailPanel({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data: session, isLoading } = useSession(sessionId);
  const runAnalysis = useRunSessionAiAnalysis();
  const { data: aiStatus } = useAiStatus();
  // Durum bilinmiyorsa düğme açık kalır; sunucu yine "bağlı değil" döner
  const aiConnected = aiStatus?.connected !== false;
  // AI analizi İK onayından sonra oluşturulur
  const aiApproved =
    session?.requiresHrReview === false || session?.analysisReview?.status === "APPROVED";
  const analysisBusy =
    session?.analysisPipeline === "QUEUED" || session?.analysisPipeline === "RUNNING";
  const [activeTab, setActiveTab] = useState<AnalysisTab>("answers");
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  const toggleAnswer = (id: string) => {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunAnalysis = (
    type: "HR_PDR_ANALYSIS" | "PSYCHOLOGICAL_ANALYSIS",
  ) => {
    runAnalysis.mutate(
      { id: sessionId, analysisType: type },
      {
        onSuccess: () => toast.success("AI analizi tamamlandı"),
        onError: (err) => toast.error(apiErrorMessage(err, "Analiz başarısız")),
      },
    );
  };

  const sessionStatus = session ? SESSION_STATUS[session.status] : undefined;

  return (
    <div className="fixed inset-0 z-[200] flex items-stretch justify-end p-2">
      <motion.div
        className="bz-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      {/* Bizmo çekmecesi (DESIGN.md §16): kenarlardan 8px, köşe 26, cam yüzey, gölge 3 */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-detail-title"
        className="relative z-modal flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-glass-border bg-popover shadow-3 backdrop-blur-xl"
        initial={{ x: "105%" }}
        animate={{ x: 0 }}
        exit={{ x: "105%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="bz-icon-box">
              <BrainCircuit />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <h2
                  id="session-detail-title"
                  className="font-display text-[19px] font-bold leading-snug text-foreground"
                >
                  Oturum detayı
                </h2>
                {sessionStatus && (
                  <span className="bz-status" data-status={sessionStatus.status}>
                    {sessionStatus.label}
                  </span>
                )}
              </div>
              {session && (
                <p className="truncate text-[13px] text-fg2">
                  {session.personnel.firstName} {session.personnel.lastName}
                  {session.personnel.position
                    ? ` — ${session.personnel.position}`
                    : ""}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bz-icon-btn bz-icon-btn--sm -mr-2"
            aria-label="Kapat"
            title="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {session && session.status === "COMPLETED" && (
          <ReviewAndReportBar session={session} sessionId={sessionId} />
        )}

        <div className="bz-tabs shrink-0 px-2 sm:px-4" role="tablist" aria-label="Oturum bölümleri">
          {ANALYSIS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="bz-tab"
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="hidden h-4 w-4 sm:block" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {isLoading ? (
            <div className="space-y-3" aria-busy="true" aria-label="Yükleniyor">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bz-skeleton h-[72px] rounded-2xl" />
              ))}
            </div>
          ) : !session ? (
            <div className="bz-empty">
              <p className="bz-empty__title">Oturum bulunamadı</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeTab === "answers" && (
                <motion.div
                  key="answers"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-3"
                >
                  {session.answers.length === 0 ? (
                    <div className="bz-empty">
                      <span className="bz-icon-box">
                        <MessageSquare />
                      </span>
                      <p className="bz-empty__title">Henüz cevap bulunmuyor</p>
                      <p className="bz-empty__text">
                        Personel teste başladığında cevaplar burada görünür.
                      </p>
                    </div>
                  ) : (
                    session.answers.map((answer: AnswerRow, idx: number) => {
                      const expanded = expandedAnswers.has(answer.id);
                      const dim = answer.question?.dimension;
                      return (
                        <div
                          key={answer.id}
                          className="bz-card bz-card--flat overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleAnswer(answer.id)}
                            aria-expanded={expanded}
                            className="flex w-full items-start gap-3 p-3.5 text-left transition-colors hover:bg-hover"
                          >
                            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-surface-3 text-[11px] font-bold tabular-nums text-fg2">
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold leading-snug text-foreground">
                                {answer.question?.text ?? "Soru yüklenemedi"}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                {dim && (
                                  <span className="bz-chip">
                                    <span
                                      className={cn("bz-dot", dimensionColor(dim).bar)}
                                      aria-hidden="true"
                                    />
                                    {DIMENSION_LABELS[dim] ?? dim}
                                  </span>
                                )}
                                {answer.aiScore !== null && (
                                  <span
                                    className={cn(
                                      "bz-chip tabular-nums",
                                      `bz-chip--${scoreTone(answer.aiScore)}`,
                                    )}
                                  >
                                    AI: {answer.aiScore.toFixed(1)}
                                  </span>
                                )}
                              </div>
                            </div>
                            {expanded ? (
                              <ChevronUp className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                            )}
                          </button>
                          <AnimatePresence>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="ml-9 space-y-3 px-3.5 pb-3.5 pt-0">
                                  {answer.textAnswer && (
                                    <div>
                                      <p className="bz-kicker mb-1.5">Cevap</p>
                                      <p className="rounded-xl bg-surface-2 p-3 text-sm text-foreground">
                                        {answer.textAnswer}
                                      </p>
                                    </div>
                                  )}
                                  {answer.scaleValue !== null && (
                                    <div>
                                      <p className="bz-kicker mb-1.5">Puan</p>
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={cn(
                                            "bz-progress flex-1",
                                            TONE_PROGRESS[scoreTone(answer.scaleValue)],
                                          )}
                                        >
                                          <span style={pct(answer.scaleValue)} />
                                        </div>
                                        <span className="text-sm font-semibold tabular-nums text-foreground">
                                          {answer.scaleValue}/10
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {answer.choiceKey && (
                                    <div>
                                      <p className="bz-kicker mb-1.5">Seçim</p>
                                      <p className="text-sm text-foreground">
                                        {answer.choiceKey}
                                      </p>
                                    </div>
                                  )}
                                  {answer.durationSec !== null && (
                                    <p className="text-xs tabular-nums text-muted-foreground">
                                      Cevaplama süresi:{" "}
                                      {Math.floor(answer.durationSec / 60)}dk{" "}
                                      {answer.durationSec % 60}sn
                                    </p>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}

              {activeTab === "hrpdr" && (
                <motion.div
                  key="hrpdr"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <HrPdrAnalysisView
                    session={session}
                    onRun={() => handleRunAnalysis("HR_PDR_ANALYSIS")}
                    aiConnected={aiConnected}
                    aiApproved={aiApproved}
                    analysisBusy={analysisBusy}
                    isRunning={
                      runAnalysis.isPending &&
                      runAnalysis.variables?.analysisType ===
                        "HR_PDR_ANALYSIS"
                    }
                  />
                </motion.div>
              )}

              {activeTab === "psychological" && (
                <motion.div
                  key="psychological"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <PsychologicalAnalysisView
                    session={session}
                    onRun={() => handleRunAnalysis("PSYCHOLOGICAL_ANALYSIS")}
                    aiConnected={aiConnected}
                    aiApproved={aiApproved}
                    isRunning={
                      runAnalysis.isPending &&
                      runAnalysis.variables?.analysisType ===
                        "PSYCHOLOGICAL_ANALYSIS"
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/** AI analiz hattı durumu → çip tonu (DESIGN.md §13 `.bz-chip`; ton yoksa nötr) */
const PIPELINE_CHIP: Record<
  string,
  { label: string; tone?: "success" | "warning" | "danger" | "info" }
> = {
  NOT_QUEUED: { label: "Analiz yapılmadı" },
  QUEUED: { label: "Analiz sırada", tone: "warning" },
  RUNNING: { label: "Analiz sürüyor", tone: "info" },
  COMPLETED: { label: "Analiz tamam", tone: "success" },
  FAILED: { label: "Analiz başarısız", tone: "danger" },
};

/** İK onayı → Bizmo süreç durumu rozeti (DESIGN.md §13 `.bz-status`) */
const REVIEW_STATUS: Record<string, { label: string; status: string }> = {
  PENDING: { label: "İK onayı bekliyor", status: "pending" },
  APPROVED: { label: "İK onaylı", status: "approved" },
  REJECTED: { label: "İK reddetti", status: "rejected" },
};

/** Tamamlanan oturum için analiz durumu, İK onayı ve rapor işlemleri */
function ReviewAndReportBar({
  session,
  sessionId,
}: {
  session: SessionDetail;
  sessionId: string;
}) {
  const { canAnalyze } = usePermissions();
  const submitReview = useSubmitReview();
  const generateReport = useGenerateReport();
  const { data: report } = useSessionReport(canAnalyze ? sessionId : null);
  const [comment, setComment] = useState(session.analysisReview?.comment ?? "");

  const reviewStatus = session.analysisReview?.status ?? "PENDING";
  const needsReview = session.requiresHrReview !== false;
  const analysisBusy =
    session.analysisPipeline === "QUEUED" || session.analysisPipeline === "RUNNING";
  const canGenerate = (!needsReview || reviewStatus === "APPROVED") && !analysisBusy;
  const pipeline = PIPELINE_CHIP[session.analysisPipeline] ?? {
    label: session.analysisPipeline,
  };
  const review = REVIEW_STATUS[reviewStatus]!;
  const failed = session.analysisPipeline === "FAILED";

  const decide = (status: "APPROVED" | "REJECTED") => {
    submitReview.mutate(
      { id: sessionId, data: { status, comment: comment.trim() || undefined } },
      {
        onSuccess: (res) =>
          toast.success(
            status === "APPROVED"
              ? res.analysisQueued
                ? "Onaylandı — AI analizi oluşturuluyor"
                : "Onaylandı"
              : "Reddedildi",
          ),
        onError: (err) => toast.error(apiErrorMessage(err, "İnceleme kaydedilemedi")),
      },
    );
  };

  const handleGenerate = () => {
    generateReport.mutate(sessionId, {
      onSuccess: () => toast.success("Rapor oluşturuldu"),
      onError: (err) => toast.error(apiErrorMessage(err, "Rapor oluşturulamadı")),
    });
  };

  return (
    <section
      aria-label="Analiz onayı ve rapor"
      className="bz-card bz-card--flat mx-4 mb-3 shrink-0 space-y-3 p-3 sm:mx-6"
      data-tone={
        failed ? "danger" : needsReview && reviewStatus === "PENDING" ? "warning" : undefined
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn("bz-chip", pipeline.tone && `bz-chip--${pipeline.tone}`)}
        >
          <span className="bz-dot" aria-hidden="true" />
          {pipeline.label}
        </span>
        {needsReview && (
          <span className="bz-status" data-status={review.status}>
            {review.label}
          </span>
        )}
        {session.analysisPipeline === "NOT_QUEUED" && session.analysisError && (
          <span className="bz-hint">{session.analysisError}</span>
        )}

        {canAnalyze && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {report ? (
              <Link
                href={`/reports/${report.id}`}
                className="bz-btn bz-btn--ghost bz-btn--sm"
              >
                <FileText />
                Raporu aç
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || generateReport.isPending}
              title={
                canGenerate
                  ? undefined
                  : analysisBusy
                    ? "AI analizi bitince rapor oluşturabilirsiniz"
                    : "Rapor için önce İK onayı gerekli"
              }
              className="bz-btn bz-btn--data bz-btn--sm"
            >
              {generateReport.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <FileDown />
              )}
              {report ? "Raporu yenile" : "Rapor oluştur"}
            </button>
          </div>
        )}
      </div>

      {failed && session.analysisError && (
        <div role="alert" className="bz-alert bz-alert--danger">
          <AlertTriangle />
          <div className="min-w-0">
            <p className="bz-alert__title">AI analizi tamamlanamadı</p>
            {/* Hata metni 1000 karaktere kadar çıkabilir; sabit başlık alanını taşırmasın */}
            <p className="max-h-24 overflow-y-auto break-words">{session.analysisError}</p>
          </div>
        </div>
      )}

      {canAnalyze && needsReview && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="İK yorumu (isteğe bağlı)"
            aria-label="İK yorumu"
            maxLength={5000}
            className="bz-field bz-field--sm flex-1"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide("APPROVED")}
              disabled={submitReview.isPending}
              title="Onaylayınca AI analizi oluşturulur"
              className="bz-btn bz-btn--primary bz-btn--sm"
            >
              <CheckCircle2 />
              Onayla
            </button>
            <button
              type="button"
              onClick={() => decide("REJECTED")}
              disabled={submitReview.isPending}
              className="bz-btn bz-btn--danger bz-btn--sm"
            >
              <XCircle />
              Reddet
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function HrPdrAnalysisView({
  session,
  onRun,
  isRunning,
  aiConnected,
  aiApproved,
  analysisBusy,
}: {
  session: SessionDetail;
  onRun: () => void;
  isRunning: boolean;
  aiConnected: boolean;
  aiApproved: boolean;
  /** Onayla başlayan arka plan analizi sürüyor */
  analysisBusy: boolean;
}) {
  const analysis = session.hrPdrAnalysis as Record<string, unknown> | null;

  if (!analysis) {
    return (
      <AnalysisEmpty
        icon={<FileText />}
        title="HR PDR analizi"
        text="Bu oturum için henüz HR Performans Değerlendirme analizi yapılmadı. AI analizi başlatarak cevaplar üzerinden kapsamlı bir PDR raporu oluşturun."
        onRun={onRun}
        isRunning={isRunning}
        hasAnswers={session.answers.length > 0}
        aiConnected={aiConnected}
        aiApproved={aiApproved}
        analysisBusy={analysisBusy}
      />
    );
  }

  const perfScore = analysis.performanceScore as number | undefined;
  const promo = analysis.promotionReadiness as string | undefined;
  const promoStatus =
    promo === "READY"
      ? { status: "approved", label: "Terfi için hazır" }
      : promo === "DEVELOPING"
        ? { status: "progress", label: "Gelişim sürecinde" }
        : { status: "pending", label: "Henüz hazır değil" };

  return (
    <div className="space-y-4">
      <RerunButton onRun={onRun} isRunning={isRunning} aiConnected={aiConnected} aiApproved={aiApproved} />

      {perfScore != null && (
        <section className="bz-card bz-card--flat p-4">
          <div className="mb-3 flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl font-display text-lg font-extrabold tabular-nums",
                TONE_TILE[scoreTone(Number(perfScore))],
              )}
            >
              {Number(perfScore).toFixed(1)}
            </div>
            <div className="min-w-0">
              <h4 className="text-[15px] font-bold text-foreground">
                Performans puanı
              </h4>
              <span
                className="bz-status mt-1"
                data-status={promoStatus.status}
              >
                {promoStatus.label}
              </span>
            </div>
          </div>
          {typeof analysis.performanceSummary === "string" && (
            <p className="text-sm text-fg2">{analysis.performanceSummary}</p>
          )}
        </section>
      )}

      {Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
        <Section
          title="Güçlü yönler"
          icon={<TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />}
        >
          <ul className="space-y-1.5">
            {(analysis.strengths as string[]).map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fg2">
                <span className="font-semibold text-success-ink" aria-hidden="true">
                  +
                </span>
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {Array.isArray(analysis.developmentAreas) &&
        analysis.developmentAreas.length > 0 && (
          <Section
            title="Gelişim alanları"
            icon={<Target className="h-4 w-4 text-warning" aria-hidden="true" />}
          >
            <ul className="space-y-2.5">
              {(analysis.developmentAreas as { area: string; recommendation?: string }[]).map(
                (d, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-semibold text-foreground">{d.area}</span>
                    {d.recommendation && (
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {d.recommendation}
                      </p>
                    )}
                  </li>
                ),
              )}
            </ul>
          </Section>
        )}

      {Array.isArray(analysis.competencyAnalysis) &&
        analysis.competencyAnalysis.length > 0 && (
          <Section title="Yetkinlik analizi">
            <div className="space-y-3">
              {(
                analysis.competencyAnalysis as {
                  dimension: string;
                  score: number;
                }[]
              ).map((comp, i) => (
                <div key={i}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <span
                        className={cn("bz-dot", dimensionColor(comp.dimension).bar)}
                        aria-hidden="true"
                      />
                      {DIMENSION_LABELS[comp.dimension] ?? comp.dimension}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {comp.score}/10
                    </span>
                  </div>
                  <div className="bz-progress">
                    <span
                      className={dimensionColor(comp.dimension).bar}
                      style={pct(comp.score)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

      {analysis.goals != null &&
        typeof analysis.goals === "object" &&
        !Array.isArray(analysis.goals) && (
          <Section title="Hedef önerileri">
            <div className="grid grid-cols-1 gap-3">
              {(
                [
                  {
                    label: "Kısa vadeli (3 ay)",
                    items: (analysis.goals as { shortTerm?: string[] }).shortTerm,
                  },
                  {
                    label: "Orta vadeli (6 ay)",
                    items: (analysis.goals as { midTerm?: string[] }).midTerm,
                  },
                  {
                    label: "Uzun vadeli (1 yıl)",
                    items: (analysis.goals as { longTerm?: string[] }).longTerm,
                  },
                ] as const
              ).map((group) =>
                Array.isArray(group.items) && group.items.length > 0 ? (
                  <div key={group.label}>
                    <p className="bz-kicker mb-1.5">{group.label}</p>
                    <ul className="space-y-1">
                      {group.items.map((item: string, i: number) => (
                        <li
                          key={i}
                          className="relative pl-3.5 text-[13px] text-fg2 before:absolute before:left-0 before:top-[8px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-fg3"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </Section>
        )}

      {Array.isArray(analysis.trainingNeeds) &&
        analysis.trainingNeeds.length > 0 && (
          <Section title="Eğitim ihtiyaçları">
            <div className="flex flex-wrap gap-1.5">
              {(analysis.trainingNeeds as string[]).map((t, i) => (
                <span key={i} className="bz-chip bz-chip--lg">
                  {t}
                </span>
              ))}
            </div>
          </Section>
        )}

      {typeof analysis.overallRecommendation === "string" && (
        <div className="bz-callout" data-tone="info">
          <p className="bz-callout__title">
            <Sparkles aria-hidden="true" />
            Genel değerlendirme
          </p>
          <p className="text-fg2">{analysis.overallRecommendation}</p>
        </div>
      )}
    </div>
  );
}

function PsychologicalAnalysisView({
  session,
  onRun,
  isRunning,
  aiConnected,
  aiApproved,
}: {
  session: SessionDetail;
  onRun: () => void;
  isRunning: boolean;
  aiConnected: boolean;
  aiApproved: boolean;
}) {
  const analysis = session.psychologicalAnalysis as Record<string, unknown> | null;

  if (!analysis) {
    return (
      <AnalysisEmpty
        icon={<Heart />}
        title="Psikolojik analiz"
        text="Bu oturum için henüz psikolojik analiz yapılmadı. AI analizi başlatarak Big Five kişilik profili, duygusal zeka ve daha fazlasını keşfedin."
        onRun={onRun}
        isRunning={isRunning}
        hasAnswers={session.answers.length > 0}
        aiConnected={aiConnected}
        aiApproved={aiApproved}
      />
    );
  }

  const bigFive = analysis.personalityProfile as Record<
    string,
    { score: number; description?: string }
  > | null;
  const ei = analysis.emotionalIntelligence as Record<string, unknown> | null;
  const stress = analysis.stressManagement as
    | { level?: string; copingStrategies?: string[] }
    | null
    | undefined;
  const decision = analysis.decisionMaking as
    | { style?: string; riskTolerance?: string }
    | null
    | undefined;

  return (
    <div className="space-y-4">
      <RerunButton onRun={onRun} isRunning={isRunning} aiConnected={aiConnected} aiApproved={aiApproved} />

      {bigFive && (
        <Section title="Big Five kişilik profili">
          <div className="space-y-3">
            {/* Kategori renkleri: Bizmo seri paleti (yalnız işarette; etiket metin renginde) */}
            {[
              { key: "openness", label: "Deneyime açıklık", color: "bg-series-1" },
              { key: "conscientiousness", label: "Sorumluluk", color: "bg-series-2" },
              { key: "extraversion", label: "Dışadönüklük", color: "bg-series-3" },
              { key: "agreeableness", label: "Uyumluluk", color: "bg-series-4" },
              { key: "neuroticism", label: "Duygusal denge", color: "bg-series-5" },
            ].map((trait) => {
              const data = bigFive[trait.key];
              if (!data) return null;
              return (
                <div key={trait.key}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                      <span className={cn("bz-dot", trait.color)} aria-hidden="true" />
                      {trait.label}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums text-foreground">
                      {data.score}/10
                    </span>
                  </div>
                  <div className="bz-progress">
                    <span className={trait.color} style={pct(data.score)} />
                  </div>
                  {data.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {ei && (
        <Section title="Duygusal zeka">
          <div className="mb-3 grid grid-cols-5 gap-2">
            {[
              { key: "selfAwareness", label: "Öz farkındalık" },
              { key: "selfRegulation", label: "Öz düzenleme" },
              { key: "motivation", label: "Motivasyon" },
              { key: "empathy", label: "Empati" },
              { key: "socialSkills", label: "Sosyal beceri" },
            ].map((dim) => {
              const val = ei[dim.key] as number | undefined;
              if (val == null) return null;
              return (
                <div key={dim.key} className="text-center">
                  <div
                    className={cn(
                      "mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-xl font-display text-sm font-extrabold tabular-nums",
                      TONE_TILE[scoreTone(val)],
                    )}
                  >
                    {val}
                  </div>
                  <p className="text-[11px] leading-tight text-muted-foreground">
                    {dim.label}
                  </p>
                </div>
              );
            })}
          </div>
          {typeof ei.summary === "string" && (
            <p className="text-[13px] text-fg2">{ei.summary}</p>
          )}
        </Section>
      )}

      {stress != null && typeof stress === "object" && !Array.isArray(stress) && (
        <Section title="Stres yönetimi">
          <span className={cn("bz-chip", levelChip(stress.level).className)}>
            Düzey: {levelChip(stress.level).label}
          </span>
          {Array.isArray(stress.copingStrategies) && (
            <div className="mt-3">
              <p className="bz-kicker mb-1.5">Başa çıkma stratejileri</p>
              <ul className="space-y-1">
                {stress.copingStrategies.map((s, i) => (
                  <li key={i} className="text-[13px] text-fg2">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {analysis.motivationProfile != null &&
        typeof analysis.motivationProfile === "object" &&
        !Array.isArray(analysis.motivationProfile) && (
          <Section title="Motivasyon profili">
            <div className="grid grid-cols-2 gap-3">
              {Array.isArray(
                (
                  analysis.motivationProfile as {
                    intrinsic?: string[];
                  }
                ).intrinsic,
              ) && (
                <div>
                  <p className="bz-kicker mb-1.5">İçsel</p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      analysis.motivationProfile as { intrinsic: string[] }
                    ).intrinsic.map((m, i) => (
                      <span key={i} className="bz-chip">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(
                (
                  analysis.motivationProfile as {
                    extrinsic?: string[];
                  }
                ).extrinsic,
              ) && (
                <div>
                  <p className="bz-kicker mb-1.5">Dışsal</p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      analysis.motivationProfile as { extrinsic: string[] }
                    ).extrinsic.map((m, i) => (
                      <span key={i} className="bz-chip">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {typeof (analysis.motivationProfile as { summary?: string })
              .summary === "string" && (
              <p className="mt-3 text-[13px] text-fg2">
                {(analysis.motivationProfile as { summary: string }).summary}
              </p>
            )}
          </Section>
        )}

      {analysis.teamDynamics != null &&
        typeof analysis.teamDynamics === "object" &&
        !Array.isArray(analysis.teamDynamics) && (
          <Section title="Ekip dinamikleri">
            <dl className="grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Rol</dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {(analysis.teamDynamics as { role?: string }).role ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">İşbirliği</dt>
                <dd className="mt-0.5 font-semibold text-foreground">
                  {(analysis.teamDynamics as { collaborationStyle?: string })
                    .collaborationStyle ?? "—"}
                </dd>
              </div>
            </dl>
          </Section>
        )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {decision != null && typeof decision === "object" && !Array.isArray(decision) && (
          <Section title="Karar verme">
            <p className="text-[13px] text-fg2">{decision.style}</p>
            <span
              className={cn(
                "bz-chip mt-2",
                levelChip(decision.riskTolerance).className,
              )}
            >
              Risk: {levelChip(decision.riskTolerance).label}
            </span>
          </Section>
        )}
        {analysis.resilience != null &&
          typeof analysis.resilience === "object" &&
          !Array.isArray(analysis.resilience) && (
            <Section title="Psikolojik dayanıklılık">
              <div className="mb-1.5 flex items-center gap-3">
                <div
                  className={cn(
                    "bz-progress flex-1",
                    TONE_PROGRESS[
                      scoreTone((analysis.resilience as { score: number }).score)
                    ],
                  )}
                >
                  <span style={pct((analysis.resilience as { score: number }).score)} />
                </div>
                <span className="text-[13px] font-semibold tabular-nums text-foreground">
                  {(analysis.resilience as { score: number }).score}/10
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {(analysis.resilience as { description?: string }).description}
              </p>
            </Section>
          )}
      </div>

      {typeof analysis.overallPsychologicalProfile === "string" && (
        <div className="bz-callout" data-tone="info">
          <p className="bz-callout__title">
            <Sparkles aria-hidden="true" />
            Genel psikolojik profil
          </p>
          <p className="text-fg2">{analysis.overallPsychologicalProfile}</p>
        </div>
      )}
    </div>
  );
}
