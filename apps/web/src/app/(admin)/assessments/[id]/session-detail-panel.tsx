"use client";

import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import {
  useSession,
  useRunSessionAiAnalysis,
  useSubmitReview,
  useGenerateReport,
  useSessionReport,
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

const ANALYSIS_TABS = [
  { id: "answers" as const, label: "Cevaplar", icon: MessageSquare },
  { id: "hrpdr" as const, label: "HR PDR Analizi", icon: FileText },
  { id: "psychological" as const, label: "Psikolojik Analiz", icon: Heart },
];

type AnalysisTab = (typeof ANALYSIS_TABS)[number]["id"];

export function SessionDetailPanel({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data: session, isLoading } = useSession(sessionId);
  const runAnalysis = useRunSessionAiAnalysis();
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

  return (
    <div className="fixed inset-0 z-[200] flex items-stretch justify-end">
      <motion.div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="relative z-10 w-full max-w-3xl bg-popover border-l border-border/50 shadow-2xl flex flex-col overflow-hidden"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <BrainCircuit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Oturum Detayı
              </h2>
              {session && (
                <p className="text-xs text-muted-foreground">
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
            className="p-2 rounded-lg hover:bg-muted/60 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {session && session.status === "COMPLETED" && (
          <ReviewAndReportBar session={session} sessionId={sessionId} />
        )}

        <div className="flex gap-1 px-6 pt-3 pb-0 shrink-0">
          {ANALYSIS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-colors border-b-2",
                activeTab === tab.id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-3 text-sm text-muted-foreground">
                Yükleniyor...
              </span>
            </div>
          ) : !session ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">Oturum bulunamadı</p>
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
                    <div className="text-center py-12">
                      <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Henüz cevap bulunmuyor
                      </p>
                    </div>
                  ) : (
                    session.answers.map((answer: AnswerRow, idx: number) => (
                      <div
                        key={answer.id}
                        className="rounded-xl border border-border/30 bg-muted/20 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleAnswer(answer.id)}
                          className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                        >
                          <span className="flex-shrink-0 h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground leading-snug">
                              {answer.question?.text ?? "Soru yüklenemedi"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {answer.question?.dimension && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                                  {DIMENSION_LABELS[answer.question.dimension] ??
                                    answer.question.dimension}
                                </span>
                              )}
                              {answer.aiScore !== null && (
                                <span
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded font-bold",
                                    answer.aiScore >= 7
                                      ? "bg-accent-green/10 text-accent-green"
                                      : answer.aiScore >= 4
                                        ? "bg-amber-500/10 text-amber-500"
                                        : "bg-destructive/10 text-destructive",
                                  )}
                                >
                                  AI: {answer.aiScore.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                          {expandedAnswers.has(answer.id) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                        </button>
                        <AnimatePresence>
                          {expandedAnswers.has(answer.id) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 pt-0 ml-9 space-y-2">
                                {answer.textAnswer && (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                      Cevap
                                    </p>
                                    <p className="text-sm text-foreground bg-background/50 rounded-lg p-2.5 border border-border/20">
                                      {answer.textAnswer}
                                    </p>
                                  </div>
                                )}
                                {answer.scaleValue !== null && (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                      Puan
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full rounded-full transition-all",
                                            answer.scaleValue >= 7
                                              ? "bg-accent-green"
                                              : answer.scaleValue >= 4
                                                ? "bg-amber-500"
                                                : "bg-destructive",
                                          )}
                                          style={{
                                            width: `${(answer.scaleValue / 10) * 100}%`,
                                          }}
                                        />
                                      </div>
                                      <span className="text-sm font-bold tabular-nums">
                                        {answer.scaleValue}/10
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {answer.choiceKey && (
                                  <div>
                                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                      Seçim
                                    </p>
                                    <p className="text-sm text-foreground">
                                      {answer.choiceKey}
                                    </p>
                                  </div>
                                )}
                                {answer.durationSec !== null && (
                                  <p className="text-[10px] text-muted-foreground">
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
                    ))
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

const PIPELINE_LABELS: Record<string, { label: string; className: string }> = {
  NOT_QUEUED: { label: "Analiz bekliyor", className: "bg-muted text-muted-foreground" },
  QUEUED: { label: "Analiz sırada", className: "bg-amber-500/10 text-amber-600" },
  RUNNING: { label: "Analiz sürüyor", className: "bg-amber-500/10 text-amber-600" },
  COMPLETED: { label: "Analiz tamam", className: "bg-accent-green/10 text-accent-green" },
  FAILED: { label: "Analiz başarısız", className: "bg-destructive/10 text-destructive" },
};

const REVIEW_LABELS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "İK onayı bekliyor", className: "bg-amber-500/10 text-amber-600" },
  APPROVED: { label: "İK onaylı", className: "bg-accent-green/10 text-accent-green" },
  REJECTED: { label: "İK reddetti", className: "bg-destructive/10 text-destructive" },
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
  const canGenerate = !needsReview || reviewStatus === "APPROVED";
  const pipeline = PIPELINE_LABELS[session.analysisPipeline] ?? {
    label: session.analysisPipeline,
    className: "bg-muted text-muted-foreground",
  };
  const review = REVIEW_LABELS[reviewStatus]!;

  const decide = (status: "APPROVED" | "REJECTED") => {
    submitReview.mutate(
      { id: sessionId, data: { status, comment: comment.trim() || undefined } },
      {
        onSuccess: () =>
          toast.success(status === "APPROVED" ? "Analiz onaylandı" : "Analiz reddedildi"),
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
    <div className="px-6 py-3 border-b border-border/30 space-y-2 shrink-0 bg-muted/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-[11px] px-2 py-0.5 rounded-md font-medium", pipeline.className)}>
          {pipeline.label}
        </span>
        {needsReview && (
          <span className={cn("text-[11px] px-2 py-0.5 rounded-md font-medium", review.className)}>
            {review.label}
          </span>
        )}
        {session.analysisPipeline === "FAILED" && session.analysisError && (
          <span className="inline-flex items-center gap-1 text-[11px] text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {session.analysisError}
          </span>
        )}
        {session.analysisPipeline === "NOT_QUEUED" && session.analysisError && (
          <span className="text-[11px] text-muted-foreground">{session.analysisError}</span>
        )}

        {canAnalyze && (
          <div className="ml-auto flex items-center gap-2">
            {report ? (
              <Link
                href={`/reports/${report.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                Raporu aç
              </Link>
            ) : null}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate || generateReport.isPending}
              title={canGenerate ? undefined : "Rapor için önce İK onayı gerekli"}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generateReport.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileDown className="h-3.5 w-3.5" />
              )}
              {report ? "Raporu yenile" : "Rapor oluştur"}
            </button>
          </div>
        )}
      </div>

      {canAnalyze && needsReview && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="İK yorumu (isteğe bağlı)"
            maxLength={5000}
            className="flex-1 h-8 px-3 rounded-lg bg-background border border-border/50 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => decide("APPROVED")}
              disabled={submitReview.isPending}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium bg-accent-green/10 text-accent-green hover:bg-accent-green/20 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Onayla
            </button>
            <button
              type="button"
              onClick={() => decide("REJECTED")}
              disabled={submitReview.isPending}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reddet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function HrPdrAnalysisView({
  session,
  onRun,
  isRunning,
}: {
  session: SessionDetail;
  onRun: () => void;
  isRunning: boolean;
}) {
  const analysis = session.hrPdrAnalysis as Record<string, unknown> | null;

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <FileText className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          HR PDR Analizi
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Bu oturum için henüz HR Performans Değerlendirme analizi yapılmadı.
          AI analizi başlatarak cevaplar üzerinden kapsamlı bir PDR raporu
          oluşturun.
        </p>
        <motion.button
          type="button"
          onClick={onRun}
          disabled={isRunning || session.answers.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isRunning ? "Analiz Yapılıyor..." : "AI Analizi Başlat"}
        </motion.button>
        {session.answers.length === 0 && (
          <p className="text-xs text-muted-foreground/60 mt-2">
            Analiz için önce cevaplar gereklidir
          </p>
        )}
      </div>
    );
  }

  const perfScore = analysis.performanceScore as number | undefined;
  const promo = analysis.promotionReadiness as string | undefined;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Yeniden Analiz Et
        </button>
      </div>

      {perfScore != null && (
        <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold",
                perfScore >= 7
                  ? "bg-accent-green/10 text-accent-green"
                  : perfScore >= 4
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {Number(perfScore).toFixed(1)}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Performans Puanı
              </h4>
              <p className="text-xs text-muted-foreground">
                {promo === "READY"
                  ? "Terfi için hazır"
                  : promo === "DEVELOPING"
                    ? "Gelişim sürecinde"
                    : "Henüz hazır değil"}
              </p>
            </div>
          </div>
          {typeof analysis.performanceSummary === "string" && (
            <p className="text-sm text-foreground/80">
              {analysis.performanceSummary}
            </p>
          )}
        </div>
      )}

      {Array.isArray(analysis.strengths) && analysis.strengths.length > 0 && (
        <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent-green" />
            Güçlü Yönler
          </h4>
          <ul className="space-y-1">
            {(analysis.strengths as string[]).map((s, i) => (
              <li
                key={i}
                className="text-sm text-foreground/80 flex items-start gap-2"
              >
                <span className="text-accent-green mt-1">+</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {Array.isArray(analysis.developmentAreas) &&
        analysis.developmentAreas.length > 0 && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-amber-500" />
              Gelişim Alanları
            </h4>
            <ul className="space-y-2">
              {(analysis.developmentAreas as { area: string; recommendation?: string }[]).map(
                (d, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-foreground">{d.area}</span>
                    {d.recommendation && (
                      <p className="text-foreground/60 text-xs mt-0.5">
                        {d.recommendation}
                      </p>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

      {Array.isArray(analysis.competencyAnalysis) &&
        analysis.competencyAnalysis.length > 0 && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Yetkinlik Analizi
            </h4>
            <div className="space-y-3">
              {(
                analysis.competencyAnalysis as {
                  dimension: string;
                  score: number;
                }[]
              ).map((comp, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {DIMENSION_LABELS[comp.dimension] ?? comp.dimension}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums",
                        comp.score >= 7
                          ? "text-accent-green"
                          : comp.score >= 4
                            ? "text-amber-500"
                            : "text-destructive",
                      )}
                    >
                      {comp.score}/10
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        comp.score >= 7
                          ? "bg-accent-green"
                          : comp.score >= 4
                            ? "bg-amber-500"
                            : "bg-destructive",
                      )}
                      style={{ width: `${(comp.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {analysis.goals != null &&
        typeof analysis.goals === "object" &&
        !Array.isArray(analysis.goals) && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Hedef Önerileri
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {(
                [
                  {
                    label: "Kısa Vadeli (3 ay)",
                    items: (analysis.goals as { shortTerm?: string[] }).shortTerm,
                  },
                  {
                    label: "Orta Vadeli (6 ay)",
                    items: (analysis.goals as { midTerm?: string[] }).midTerm,
                  },
                  {
                    label: "Uzun Vadeli (1 yıl)",
                    items: (analysis.goals as { longTerm?: string[] }).longTerm,
                  },
                ] as const
              ).map((group) =>
                Array.isArray(group.items) && group.items.length > 0 ? (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.items.map((item: string, i: number) => (
                        <li
                          key={i}
                          className="text-xs text-foreground/80 pl-3 relative before:absolute before:left-0 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:bg-primary/50"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}

      {Array.isArray(analysis.trainingNeeds) &&
        analysis.trainingNeeds.length > 0 && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Eğitim İhtiyaçları
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {(analysis.trainingNeeds as string[]).map((t, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-medium"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

      {typeof analysis.overallRecommendation === "string" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Genel Değerlendirme
          </h4>
          <p className="text-sm text-foreground/80">
            {analysis.overallRecommendation}
          </p>
        </div>
      )}
    </div>
  );
}

function PsychologicalAnalysisView({
  session,
  onRun,
  isRunning,
}: {
  session: SessionDetail;
  onRun: () => void;
  isRunning: boolean;
}) {
  const analysis = session.psychologicalAnalysis as Record<string, unknown> | null;

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
          <Heart className="h-7 w-7 text-purple-500" />
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          Psikolojik Analiz
        </h3>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Bu oturum için henüz psikolojik analiz yapılmadı. AI analizi başlatarak
          Big Five kişilik profili, duygusal zeka ve daha fazlasını keşfedin.
        </p>
        <motion.button
          type="button"
          onClick={onRun}
          disabled={isRunning || session.answers.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500 text-white text-sm font-semibold hover:bg-purple-500/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isRunning ? "Analiz Yapılıyor..." : "AI Analizi Başlat"}
        </motion.button>
        {session.answers.length === 0 && (
          <p className="text-xs text-muted-foreground/60 mt-2">
            Analiz için önce cevaplar gereklidir
          </p>
        )}
      </div>
    );
  }

  const bigFive = analysis.personalityProfile as Record<
    string,
    { score: number; description?: string }
  > | null;
  const ei = analysis.emotionalIntelligence as Record<string, unknown> | null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRun}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-500 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Yeniden Analiz Et
        </button>
      </div>

      {bigFive && (
        <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Big Five Kişilik Profili
          </h4>
          <div className="space-y-3">
            {[
              {
                key: "openness",
                label: "Deneyime Açıklık",
                color: "bg-blue-500",
              },
              {
                key: "conscientiousness",
                label: "Sorumluluk",
                color: "bg-green-500",
              },
              {
                key: "extraversion",
                label: "Dışadönüklük",
                color: "bg-amber-500",
              },
              {
                key: "agreeableness",
                label: "Uyumluluk",
                color: "bg-pink-500",
              },
              {
                key: "neuroticism",
                label: "Duygusal Denge",
                color: "bg-purple-500",
              },
            ].map((trait) => {
              const data = bigFive[trait.key];
              if (!data) return null;
              return (
                <div key={trait.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">
                      {trait.label}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-foreground">
                      {data.score}/10
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", trait.color)}
                      style={{ width: `${(data.score / 10) * 100}%` }}
                    />
                  </div>
                  {data.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {data.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ei && (
        <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Duygusal Zeka
          </h4>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {[
              { key: "selfAwareness", label: "Öz Farkındalık" },
              { key: "selfRegulation", label: "Öz Düzenleme" },
              { key: "motivation", label: "Motivasyon" },
              { key: "empathy", label: "Empati" },
              { key: "socialSkills", label: "Sosyal Beceri" },
            ].map((dim) => {
              const val = ei[dim.key] as number | undefined;
              if (val == null) return null;
              return (
                <div key={dim.key} className="text-center">
                  <div
                    className={cn(
                      "h-10 w-10 mx-auto rounded-xl flex items-center justify-center text-sm font-bold mb-1",
                      val >= 7
                        ? "bg-accent-green/10 text-accent-green"
                        : val >= 4
                          ? "bg-amber-500/10 text-amber-500"
                          : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {val}
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-tight">
                    {dim.label}
                  </p>
                </div>
              );
            })}
          </div>
          {typeof ei.summary === "string" && (
            <p className="text-xs text-foreground/80">{ei.summary}</p>
          )}
        </div>
      )}

      {analysis.stressManagement != null &&
        typeof analysis.stressManagement === "object" &&
        !Array.isArray(analysis.stressManagement) && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Stres Yönetimi
            </h4>
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-lg font-semibold",
                (analysis.stressManagement as { level?: string }).level ===
                "LOW"
                  ? "bg-accent-green/10 text-accent-green"
                  : (analysis.stressManagement as { level?: string }).level ===
                      "MODERATE"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-destructive/10 text-destructive",
              )}
            >
              {(analysis.stressManagement as { level?: string }).level ===
              "LOW"
                ? "Düşük"
                : (analysis.stressManagement as { level?: string }).level ===
                    "MODERATE"
                  ? "Orta"
                  : "Yüksek"}
            </span>
            {Array.isArray(
              (analysis.stressManagement as { copingStrategies?: string[] })
                .copingStrategies,
            ) && (
              <div className="mt-2">
                <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">
                  Başa Çıkma Stratejileri
                </p>
                <ul className="space-y-0.5">
                  {(
                    (analysis.stressManagement as { copingStrategies: string[] })
                      .copingStrategies
                  ).map((s, i) => (
                    <li key={i} className="text-xs text-foreground/80">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      {analysis.motivationProfile != null &&
        typeof analysis.motivationProfile === "object" &&
        !Array.isArray(analysis.motivationProfile) && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Motivasyon Profili
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {Array.isArray(
                (
                  analysis.motivationProfile as {
                    intrinsic?: string[];
                  }
                ).intrinsic,
              ) && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">
                    İçsel
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      analysis.motivationProfile as { intrinsic: string[] }
                    ).intrinsic.map((m, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green"
                      >
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
                  <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">
                    Dışsal
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(
                      analysis.motivationProfile as { extrinsic: string[] }
                    ).extrinsic.map((m, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {typeof (analysis.motivationProfile as { summary?: string })
              .summary === "string" && (
              <p className="text-xs text-foreground/80 mt-2">
                {(analysis.motivationProfile as { summary: string }).summary}
              </p>
            )}
          </div>
        )}

      {analysis.teamDynamics != null &&
        typeof analysis.teamDynamics === "object" &&
        !Array.isArray(analysis.teamDynamics) && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-2">
              Ekip Dinamikleri
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Rol:</span>{" "}
                <span className="font-medium text-foreground">
                  {(analysis.teamDynamics as { role?: string }).role}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">İşbirliği:</span>{" "}
                <span className="font-medium text-foreground">
                  {
                    (analysis.teamDynamics as { collaborationStyle?: string })
                      .collaborationStyle
                  }
                </span>
              </div>
            </div>
          </div>
        )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {analysis.decisionMaking != null &&
          typeof analysis.decisionMaking === "object" &&
          !Array.isArray(analysis.decisionMaking) && (
            <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
              <h4 className="text-sm font-semibold text-foreground mb-1">
                Karar Verme
              </h4>
              <p className="text-xs text-foreground/80">
                {(analysis.decisionMaking as { style?: string }).style}
              </p>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium mt-1 inline-block",
                  (analysis.decisionMaking as { riskTolerance?: string })
                    .riskTolerance === "LOW"
                    ? "bg-accent-green/10 text-accent-green"
                    : (analysis.decisionMaking as { riskTolerance?: string })
                          .riskTolerance === "MODERATE"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-destructive/10 text-destructive",
                )}
              >
                Risk:{" "}
                {(analysis.decisionMaking as { riskTolerance?: string })
                  .riskTolerance === "LOW"
                  ? "Düşük"
                  : (analysis.decisionMaking as { riskTolerance?: string })
                        .riskTolerance === "MODERATE"
                    ? "Orta"
                    : "Yüksek"}
              </span>
            </div>
          )}
        {analysis.resilience != null &&
          typeof analysis.resilience === "object" &&
          !Array.isArray(analysis.resilience) && (
          <div className="rounded-xl border border-border/30 bg-muted/20 p-4">
            <h4 className="text-sm font-semibold text-foreground mb-1">
              Psikolojik Dayanıklılık
            </h4>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex-1 h-2 rounded-full bg-muted/60 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    (analysis.resilience as { score: number }).score >= 7
                      ? "bg-accent-green"
                      : (analysis.resilience as { score: number }).score >= 4
                        ? "bg-amber-500"
                        : "bg-destructive",
                  )}
                  style={{
                    width: `${((analysis.resilience as { score: number }).score / 10) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums">
                {(analysis.resilience as { score: number }).score}/10
              </span>
            </div>
            <p className="text-[10px] text-foreground/60">
              {(analysis.resilience as { description?: string }).description}
            </p>
          </div>
        )}
      </div>

      {typeof analysis.overallPsychologicalProfile === "string" && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Genel Psikolojik Profil
          </h4>
          <p className="text-sm text-foreground/80">
            {analysis.overallPsychologicalProfile}
          </p>
        </div>
      )}
    </div>
  );
}
