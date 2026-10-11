"use client";

import { useState, type CSSProperties } from "react";
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
  FileX,
  ThumbsUp,
  Sprout,
  Sparkles,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard, ScoreGauge } from "@ph/ui";
import { DIMENSION_LABELS } from "@ph/shared";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { dimensionColor } from "@/lib/dimension-colors";
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

/** Terfi hazırlığı → süreç durumu rozeti (DESIGN.md §13 `.bz-status`; oturum panelindeki eşlemeyle aynı) */
const READINESS_STATUS: Record<string, string> = {
  READY: "approved",
  DEVELOPING: "progress",
  NOT_READY: "pending",
};

const REVIEW_LABELS: Record<string, string> = {
  PENDING: "İK onayı bekliyor",
  APPROVED: "İK onaylı",
  REJECTED: "İK reddetti",
};

/** İK inceleme durumu → simge tonu (işaret rengi; anlam metinde) */
const REVIEW_ICON_TONE: Record<string, string> = {
  PENDING: "text-warning",
  APPROVED: "text-success",
  REJECTED: "text-danger",
};

type Tone = "success" | "warning" | "danger" | "info";

/** SWOT bölümleri → durum tonları: kart şeridi (`.bz-card[data-tone]`), başlıkta mürekkep, işarette ana ton */
const TONE_CLASSES: Record<Tone, { ink: string; icon: string; marker: string }> = {
  success: { ink: "text-success-ink", icon: "text-success", marker: "marker:text-success" },
  warning: { ink: "text-warning-ink", icon: "text-warning", marker: "marker:text-warning" },
  danger: { ink: "text-danger-ink", icon: "text-danger", marker: "marker:text-danger" },
  info: { ink: "text-info-ink", icon: "text-info", marker: "marker:text-info" },
};

/** Skor bandı (0–10; iyi ≥ 8 · orta ≥ 6 · zayıf) → ilerleme çubuğu tonu (DESIGN.md §18 `.bz-progress`; varsayılan yeşil) */
function scoreProgressTone(score: number) {
  if (score >= 8) return "";
  if (score >= 6) return "bz-progress--warning";
  return "bz-progress--danger";
}

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
    ["Genel Skor", report.overallScore ?? report.fullReportJson?.overallScore ?? ""],
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

/** Künye satırı: etiket üstte soluk, değer altta kalın (DESIGN.md §41 `__facts`) */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-foreground [overflow-wrap:anywhere]">
        {children}
      </dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="bz-skeleton h-[38px] w-[38px] rounded-[10px]" />
        <div className="space-y-2">
          <div className="bz-skeleton h-6 w-64" />
          <div className="bz-skeleton h-3.5 w-44" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bz-skeleton h-40 rounded-2xl md:col-span-2" />
        <div className="bz-skeleton h-40 rounded-2xl" />
      </div>
      <div className="bz-skeleton h-64 rounded-2xl" />
    </div>
  );
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
    return <DetailSkeleton />;
  }

  if (isError || !report) {
    return (
      <div className="bz-card">
        <div className="bz-empty">
          <span className="bz-icon-box" aria-hidden="true">
            <FileX />
          </span>
          <p className="bz-empty__title">{apiErrorMessage(error, "Rapor bulunamadı")}</p>
          <Link href="/reports" className="bz-btn">
            <ArrowLeft />
            Raporlara dön
          </Link>
        </div>
      </div>
    );
  }

  const s = report.session;
  const scores = (report.fullReportJson?.dimensionScores ?? s?.dimensionScores ?? null) as
    | Record<string, number>
    | null;
  const overall = report.overallScore ?? report.fullReportJson?.overallScore ?? null;
  const swot = s?.swotAnalysis ?? null;
  const career = s?.careerPaths ?? null;
  const hr = (s?.hrPdrAnalysis ?? null) as Record<string, unknown> | null;
  const developmentAreas = Array.isArray(hr?.["developmentAreas"])
    ? (hr!["developmentAreas"] as Array<{ area?: string; recommendation?: string }>)
    : [];
  const readiness = typeof hr?.["promotionReadiness"] === "string" ? (hr["promotionReadiness"] as string) : null;
  const review = s?.analysisReview ?? null;
  const trainingNeeds = strings(hr?.["trainingNeeds"]);

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

  const swotSections: { title: string; items: unknown; tone: Tone; icon: LucideIcon }[] = swot
    ? [
        { title: "Güçlü yönler", items: swot.strengths, tone: "success", icon: ThumbsUp },
        { title: "Gelişim alanları", items: swot.weaknesses, tone: "warning", icon: Sprout },
        { title: "Fırsatlar", items: swot.opportunities, tone: "info", icon: Sparkles },
        { title: "Riskler", items: swot.threats, tone: "danger", icon: AlertTriangle },
      ]
    : [];

  return (
    <div className="bz-record mx-auto w-full max-w-5xl print:max-w-none">
      {/* Kayıt başlığı: kimlik + kayıt eylemleri (DESIGN.md §41) */}
      <motion.div
        className="bz-record__head"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/reports")}
            className="bz-icon-btn flex-none print:hidden"
            aria-label="Raporlara dön"
            title="Raporlara dön"
          >
            <ArrowLeft />
          </button>
          <div className="bz-record__heading gap-1">
            <h1 className="bz-record__title">
              {report.personnel.firstName} {report.personnel.lastName}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {s?.assessment.title ?? "Değerlendirme"} · Sicil{" "}
              <span className="font-mono text-[12.5px] font-semibold text-fg2">
                {report.personnel.employeeId}
              </span>
              {report.personnel.department?.name ? ` · ${report.personnel.department.name}` : ""}
            </p>
          </div>
        </div>
        <div className="bz-record__actions print:hidden">
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerate.isPending || !s}
            className="bz-btn"
            title="Yenile"
          >
            {regenerate.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            <span>Yenile</span>
          </button>
          <button
            type="button"
            onClick={handleExcel}
            disabled={exporting}
            className="bz-btn"
            title="Excel"
          >
            {exporting ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="bz-btn bz-btn--primary"
          >
            <Printer />
            Yazdır / PDF
          </button>
        </div>
      </motion.div>

      {/* Özet + genel skor */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GlassCard hover={false} className="md:col-span-2">
          <h2 className="mb-2 text-[15px] font-bold text-foreground">Yönetici özeti</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-fg2">
            {report.executiveSummary ?? "Özet bulunmuyor."}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-divider pt-4 sm:grid-cols-4">
            <Fact label="Tamamlanma">{formatDate(s?.completedAt)}</Fact>
            <Fact label="Süre">{formatDuration(s?.durationSec)}</Fact>
            <Fact label="Rapor tarihi">{formatDate(report.generatedAt)}</Fact>
            <Fact label="Oluşturan">{report.generatedBy?.name ?? "—"}</Fact>
          </dl>
        </GlassCard>
        <GlassCard
          hover={false}
          className="flex flex-col items-center justify-center gap-2 text-center"
        >
          <h2 className="text-[15px] font-bold text-foreground">Genel potansiyel skoru</h2>
          {typeof overall === "number" ? (
            <ScoreGauge score={overall} size="lg" />
          ) : (
            <p className="font-display text-2xl font-extrabold text-fg3">—</p>
          )}
          {readiness && (
            <span className="bz-status" data-status={READINESS_STATUS[readiness]}>
              {READINESS_LABELS[readiness] ?? readiness}
            </span>
          )}
          {review && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck
                className={cn("h-3.5 w-3.5 flex-none", REVIEW_ICON_TONE[review.status])}
                aria-hidden="true"
              />
              {REVIEW_LABELS[review.status] ?? review.status}
              {review.reviewer?.name ? ` · ${review.reviewer.name}` : ""}
            </span>
          )}
        </GlassCard>
      </div>

      {/* Boyut skorları */}
      <GlassCard hover={false}>
        <h2 className="mb-4 text-[15px] font-bold text-foreground">Boyut skorları</h2>
        {scores && Object.keys(scores).length > 0 ? (
          <ul className="space-y-3.5">
            {DIMENSION_ORDER.filter((d) => typeof scores[d] === "number").map((d) => {
              const v = scores[d]!;
              return (
                <li key={d} className="flex items-center gap-3">
                  <span className="flex w-44 shrink-0 items-center gap-2 text-sm text-foreground">
                    <span className={cn("bz-dot", dimensionColor(d).bar)} aria-hidden="true" />
                    {DIMENSION_LABELS[d] ?? d}
                  </span>
                  <div className={cn("bz-progress flex-1", scoreProgressTone(v))} aria-hidden="true">
                    <span
                      style={
                        { "--value": `${Math.min(100, (v / 10) * 100)}%` } as CSSProperties
                      }
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">
                    {v.toFixed(1)}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Boyut skoru bulunmuyor.</p>
        )}
      </GlassCard>

      {/* SWOT */}
      {swot && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:break-inside-avoid">
          {swotSections.map(({ title, items, tone, icon: Icon }) => {
            const list = strings(items);
            const t = TONE_CLASSES[tone];
            return (
              <GlassCard key={title} hover={false} data-tone={tone}>
                <h3 className={cn("mb-2 flex items-center gap-2 text-[15px] font-bold", t.ink)}>
                  <Icon className={cn("h-4 w-4 flex-none", t.icon)} aria-hidden="true" />
                  {title}
                </h3>
                {list.length > 0 ? (
                  <ul className={cn("list-disc space-y-1 pl-4 text-sm text-fg2", t.marker)}>
                    {list.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-fg3">—</p>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Kariyer yolu + gelişim önerileri */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:break-inside-avoid">
        <GlassCard hover={false}>
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-foreground">
            <TrendingUp className="h-4 w-4 flex-none text-data" aria-hidden="true" />
            Kariyer yolu
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
                    <dt className="text-[11.5px] font-semibold text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 text-foreground">{text}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Kariyer yolu önerisi yok.</p>
          )}
        </GlassCard>
        <GlassCard hover={false}>
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-foreground">
            <Target className="h-4 w-4 flex-none text-data" aria-hidden="true" />
            Gelişim önerileri
          </h2>
          {developmentAreas.length > 0 || trainingNeeds.length > 0 ? (
            <div className="space-y-3 text-sm">
              {developmentAreas.map((d, i) => (
                <div key={i}>
                  <p className="font-semibold text-foreground">{d.area}</p>
                  {d.recommendation && (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{d.recommendation}</p>
                  )}
                </div>
              ))}
              {trainingNeeds.length > 0 && (
                <div className={cn(developmentAreas.length > 0 && "border-t border-divider pt-3")}>
                  <p className="mb-1.5 text-[11.5px] font-semibold text-muted-foreground">
                    Eğitim ihtiyaçları
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {trainingNeeds.map((t) => (
                      <span key={t} className="bz-chip">
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
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold text-foreground">
            <Lightbulb className="h-4 w-4 flex-none text-data" aria-hidden="true" />
            Öne çıkan içgörüler
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-fg2">{s.keyInsights}</p>
          {review?.comment && (
            <p className="mt-3 border-t border-divider pt-3 text-xs text-fg2">
              <span className="font-semibold text-foreground">İK yorumu:</span> {review.comment}
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
            aria-expanded={showAnswers}
            className="flex w-full items-center justify-between gap-3 rounded-lg text-left text-[15px] font-bold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring print:hidden"
          >
            <span className="tabular-nums">Cevaplar ({s.answers.length})</span>
            {showAnswers ? (
              <ChevronUp className="h-4 w-4 flex-none text-fg3" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 flex-none text-fg3" aria-hidden="true" />
            )}
          </button>
          <div className={cn("mt-4 space-y-3", !showAnswers && "hidden print:block")}>
            {s.answers.map((a, i) => (
              <div
                key={a.id}
                className="rounded-xl border border-divider bg-surface-2 p-3.5 print:break-inside-avoid"
              >
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {i + 1}. {a.question?.text ?? "Soru"}
                </p>
                {a.question?.dimension && (
                  <div className="mt-1.5">
                    <span className="bz-chip bz-chip--sm">
                      <span
                        className={cn("bz-dot", dimensionColor(a.question.dimension).bar)}
                        aria-hidden="true"
                      />
                      {DIMENSION_LABELS[a.question.dimension] ?? a.question.dimension}
                    </span>
                  </div>
                )}
                <p className="mt-1.5 whitespace-pre-line text-sm text-fg2">{answerText(a)}</p>
                {a.followUpAnswer && (
                  <p className="mt-1 text-xs text-muted-foreground">Takip: {a.followUpAnswer}</p>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
