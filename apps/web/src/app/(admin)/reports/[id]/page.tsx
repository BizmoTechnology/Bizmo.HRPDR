"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Target,
  TrendingUp,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard, ScoreGauge } from "@ph/ui";
import { DIMENSION_LABELS } from "@ph/shared";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { useGenerateReport, useReport, type ReportDetail } from "@/hooks/use-api";

const DIMENSION_ORDER = [
  "LOGICAL_ALGORITHMIC",
  "LEADERSHIP",
  "SOCIAL_INTELLIGENCE",
  "GROWTH_POTENTIAL",
  "DOMAIN_ALIGNMENT",
];

const READINESS_LABELS: Record<string, string> = {
  READY: "Terfiye hazır",
  DEVELOPING: "Gelişiyor",
  NOT_READY: "Henüz hazır değil",
};

const REVIEW_LABELS: Record<string, string> = {
  PENDING: "İK onayı bekliyor",
  APPROVED: "İK onaylı",
  REJECTED: "İK reddetti",
};

function formatDate(date: string | null | undefined, withTime = false) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
  }).format(new Date(date));
}

function formatDuration(sec: number | null | undefined) {
  if (!sec) return "—";
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa ${m % 60} dk`;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function answerText(a: NonNullable<NonNullable<ReportDetail["session"]>["answers"]>[number]) {
  if (a.textAnswer) return a.textAnswer;
  if (a.scaleValue !== null) return `${a.scaleValue}`;
  if (a.choiceKey) {
    const options = a.question?.options as Record<string, string> | null | undefined;
    const label = options && typeof options === "object" ? options[a.choiceKey] : undefined;
    return label ? `${a.choiceKey}. ${label}` : a.choiceKey;
  }
  return "—";
}

function scoreBarClass(score: number) {
  if (score >= 8) return "bg-accent-green";
  if (score >= 6) return "bg-amber-500";
  return "bg-destructive";
}

async function exportToExcel(report: ReportDetail) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const s = report.session;
  const name = `${report.personnel.firstName} ${report.personnel.lastName}`;
  const scores = (report.fullReportJson?.dimensionScores ?? s?.dimensionScores ?? {}) as Record<string, number>;

  const summaryRows: (string | number)[][] = [
    ["Personel", name],
    ["Sicil No", report.personnel.employeeId],
    ["Pozisyon", report.personnel.position ?? ""],
    ["Departman", report.personnel.department?.name ?? ""],
    ["Değerlendirme", s?.assessment.title ?? ""],
    ["Tamamlanma", s?.completedAt ? formatDate(s.completedAt, true) : ""],
    ["Rapor Tarihi", report.generatedAt ? formatDate(report.generatedAt, true) : ""],
    ["Genel Skor", report.fullReportJson?.overallScore ?? ""],
    [],
    ["Yönetici Özeti", report.executiveSummary ?? ""],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Özet");

  const scoreRows = DIMENSION_ORDER.filter((d) => typeof scores[d] === "number").map((d) => ({
    Boyut: DIMENSION_LABELS[d] ?? d,
    Skor: scores[d],
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(scoreRows), "Boyut Skorları");

  const answerRows = (s?.answers ?? []).map((a, i) => ({
    "#": i + 1,
    Soru: a.question?.text ?? "",
    Boyut: a.question ? DIMENSION_LABELS[a.question.dimension] ?? a.question.dimension : "",
    Cevap: answerText(a),
    "Süre (sn)": a.durationSec ?? "",
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(answerRows), "Cevaplar");

  const safeName = name.replace(/[^\p{L}\p{N}]+/gu, "_");
  XLSX.writeFile(wb, `rapor_${safeName}_${report.personnel.employeeId}.xlsx`);
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data: report, isLoading, isError, error } = useReport(id);
  const regenerate = useGenerateReport();
  const [showAnswers, setShowAnswers] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 w-full">
        <div className="h-8 w-64 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-40 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (isError || !report) {
    return (
      <GlassCard hover={false}>
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            {apiErrorMessage(error, "Rapor bulunamadı")}
          </p>
          <Link href="/reports" className="text-sm text-primary hover:underline">
            Raporlara dön
          </Link>
        </div>
      </GlassCard>
    );
  }

  const s = report.session;
  const scores = (report.fullReportJson?.dimensionScores ?? s?.dimensionScores ?? null) as
    | Record<string, number>
    | null;
  const overall = report.fullReportJson?.overallScore ?? null;
  const swot = s?.swotAnalysis ?? null;
  const career = s?.careerPaths ?? null;
  const hr = (s?.hrPdrAnalysis ?? null) as Record<string, unknown> | null;
  const developmentAreas = Array.isArray(hr?.["developmentAreas"])
    ? (hr!["developmentAreas"] as Array<{ area?: string; recommendation?: string }>)
    : [];
  const readiness = typeof hr?.["promotionReadiness"] === "string" ? (hr["promotionReadiness"] as string) : null;
  const review = s?.analysisReview ?? null;

  const handleRegenerate = () => {
    if (!s) return;
    regenerate.mutate(s.id, {
      onSuccess: () => toast.success("Rapor güncellendi"),
      onError: (err) => toast.error(apiErrorMessage(err, "Rapor güncellenemedi")),
    });
  };

  const handleExcel = async () => {
    setExporting(true);
    try {
      await exportToExcel(report);
    } catch {
      toast.error("Excel dosyası oluşturulamadı");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto print:max-w-none">
      {/* Başlık */}
      <motion.div
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/reports")}
            className="h-9 w-9 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {report.personnel.firstName} {report.personnel.lastName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {s?.assessment.title ?? "Değerlendirme"} · Sicil {report.personnel.employeeId}
              {report.personnel.department?.name ? ` · ${report.personnel.department.name}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerate.isPending || !s}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-muted/50 hover:bg-muted/70 disabled:opacity-50 transition-colors"
          >
            {regenerate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Yenile
          </button>
          <button
            type="button"
            onClick={handleExcel}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-muted/50 hover:bg-muted/70 disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Yazdır / PDF
          </button>
        </div>
      </motion.div>

      {/* Özet + genel skor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard hover={false} className="md:col-span-2">
          <h2 className="text-sm font-semibold text-foreground mb-2">Yönetici Özeti</h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {report.executiveSummary ?? "Özet bulunmuyor."}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
            <div>
              <p className="text-muted-foreground">Tamamlanma</p>
              <p className="font-medium text-foreground">{formatDate(s?.completedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Süre</p>
              <p className="font-medium text-foreground">{formatDuration(s?.durationSec)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rapor tarihi</p>
              <p className="font-medium text-foreground">{formatDate(report.generatedAt)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Oluşturan</p>
              <p className="font-medium text-foreground">{report.generatedBy?.name ?? "—"}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard hover={false} className="flex flex-col items-center justify-center text-center">
          <p className="text-xs font-medium text-muted-foreground mb-2">Genel Potansiyel Skoru</p>
          {typeof overall === "number" ? (
            <ScoreGauge score={overall} size="lg" />
          ) : (
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          )}
          {readiness && (
            <span className="mt-3 text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
              {READINESS_LABELS[readiness] ?? readiness}
            </span>
          )}
          {review && (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {REVIEW_LABELS[review.status] ?? review.status}
              {review.reviewer?.name ? ` · ${review.reviewer.name}` : ""}
            </span>
          )}
        </GlassCard>
      </div>

      {/* Boyut skorları */}
      <GlassCard hover={false}>
        <h2 className="text-sm font-semibold text-foreground mb-4">Boyut Skorları</h2>
        {scores && Object.keys(scores).length > 0 ? (
          <div className="space-y-3">
            {DIMENSION_ORDER.filter((d) => typeof scores[d] === "number").map((d) => {
              const v = scores[d]!;
              return (
                <div key={d} className="flex items-center gap-3">
                  <span className="w-44 text-sm text-foreground shrink-0">{DIMENSION_LABELS[d] ?? d}</span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted/50 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", scoreBarClass(v))}
                      style={{ width: `${Math.min(100, (v / 10) * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums">{v.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Boyut skoru bulunmuyor.</p>
        )}
      </GlassCard>

      {/* SWOT */}
      {swot && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:break-inside-avoid">
          {(
            [
              ["Güçlü Yönler", swot.strengths, "text-accent-green"],
              ["Gelişim Alanları", swot.weaknesses, "text-amber-500"],
              ["Fırsatlar", swot.opportunities, "text-sky-500"],
              ["Riskler", swot.threats, "text-destructive"],
            ] as const
          ).map(([title, items, color]) => (
            <GlassCard key={title} hover={false}>
              <h3 className={cn("text-sm font-semibold mb-2", color)}>{title}</h3>
              {strings(items).length > 0 ? (
                <ul className="space-y-1 text-sm text-muted-foreground list-disc pl-4">
                  {strings(items).map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground/60">—</p>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Kariyer yolu + gelişim önerileri */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:break-inside-avoid">
        <GlassCard hover={false}>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Kariyer Yolu
          </h2>
          {career && (career.shortTerm || career.midTerm || career.longTerm) ? (
            <dl className="space-y-3 text-sm">
              {(
                [
                  ["Kısa vade", career.shortTerm],
                  ["Orta vade", career.midTerm],
                  ["Uzun vade", career.longTerm],
                ] as const
              ).map(([label, text]) =>
                text ? (
                  <div key={label}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="text-foreground">{text}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Kariyer yolu önerisi yok.</p>
          )}
        </GlassCard>
        <GlassCard hover={false}>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Gelişim Önerileri
          </h2>
          {developmentAreas.length > 0 || strings(hr?.["trainingNeeds"]).length > 0 ? (
            <div className="space-y-3 text-sm">
              {developmentAreas.map((d, i) => (
                <div key={i}>
                  <p className="font-medium text-foreground">{d.area}</p>
                  {d.recommendation && <p className="text-muted-foreground">{d.recommendation}</p>}
                </div>
              ))}
              {strings(hr?.["trainingNeeds"]).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Eğitim ihtiyaçları</p>
                  <div className="flex flex-wrap gap-1.5">
                    {strings(hr?.["trainingNeeds"]).map((t) => (
                      <span key={t} className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Gelişim önerisi için oturumda HR PDR analizini çalıştırın.
            </p>
          )}
        </GlassCard>
      </div>

      {s?.keyInsights && (
        <GlassCard hover={false}>
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Öne Çıkan İçgörüler
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{s.keyInsights}</p>
          {review?.comment && (
            <p className="text-xs text-muted-foreground mt-3 border-t border-border/30 pt-3">
              <span className="font-medium text-foreground">İK yorumu:</span> {review.comment}
            </p>
          )}
        </GlassCard>
      )}

      {/* Cevaplar */}
      {s?.answers && s.answers.length > 0 && (
        <GlassCard hover={false}>
          <button
            type="button"
            onClick={() => setShowAnswers((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-foreground print:hidden"
          >
            Cevaplar ({s.answers.length})
            {showAnswers ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <div className={cn("mt-4 space-y-3", !showAnswers && "hidden print:block")}>
            {s.answers.map((a, i) => (
              <div key={a.id} className="rounded-xl border border-border/30 p-3 print:break-inside-avoid">
                <p className="text-sm font-medium text-foreground">
                  {i + 1}. {a.question?.text ?? "Soru"}
                </p>
                {a.question?.dimension && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                    {DIMENSION_LABELS[a.question.dimension] ?? a.question.dimension}
                  </span>
                )}
                <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-line">{answerText(a)}</p>
                {a.followUpAnswer && (
                  <p className="text-xs text-muted-foreground mt-1">Takip: {a.followUpAnswer}</p>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
