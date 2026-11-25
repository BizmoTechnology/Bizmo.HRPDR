"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ApexOptions } from "apexcharts";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  EyeOff,
  Loader2,
  MessageSquareQuote,
  Send,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import { useChartTheme } from "@/lib/chart-theme";
import { dimensionColor } from "@/lib/dimension-colors";
import { DIMENSION_LABELS } from "@ph/shared";
import {
  RELATION_LABEL,
  useReleaseSubject,
  useSubjectResults,
  type ItemResult,
  type ReviewRelation,
  type SubjectResults,
} from "@/hooks/use-reviews";
import { Dialog } from "@/components/performance/Dialog";
import { formatDate, formatScore } from "@/components/performance/shared";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const DIMENSION_ORDER = [
  "LOGICAL_ALGORITHMIC",
  "LEADERSHIP",
  "SOCIAL_INTELLIGENCE",
  "GROWTH_POTENTIAL",
  "DOMAIN_ALIGNMENT",
] as const;

/** Grup → sabit seri rengi (renk varlığa bağlı, sıraya değil: DESIGN.md §28.1) */
const SERIES_INDEX: Record<"OTHERS" | ReviewRelation, number> = {
  OTHERS: 0, // mavi
  MANAGER: 1, // turuncu
  PEER: 2, // camgöbeği
  SUBORDINATE: 3, // kehribar
  SELF: 4, // macenta
};

const FLAG_LABEL = { TOO_FAST: "Çok hızlı cevapladı", STRAIGHT_LINE: "Hep aynı puanı verdi" } as const;

function dimLabel(d: string) {
  return (DIMENSION_LABELS as Record<string, string>)[d] ?? d;
}

function GapChip({ gap }: { gap: number | null }) {
  if (gap === null) return <span className="text-fg3">—</span>;
  const sign = gap > 0 ? "+" : "";
  if (gap >= 1.5)
    return (
      <span className="bz-chip bz-chip--warning tabular-nums" title="Kendini diğerlerinden yüksek görüyor">
        {sign}
        {formatScore(gap)} · kör nokta
      </span>
    );
  if (gap <= -1.5)
    return (
      <span className="bz-chip bz-chip--info tabular-nums" title="Diğerleri kendisinden yüksek görüyor">
        {formatScore(gap)} · gizli güç
      </span>
    );
  return (
    <span className="tabular-nums text-fg2">
      {sign}
      {formatScore(gap)}
    </span>
  );
}

function ItemList({ items, empty }: { items: ItemResult[]; empty: string }) {
  if (items.length === 0) return <p className="text-[13px] text-fg3">{empty}</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.questionId} className="flex items-start gap-2 text-[13px]">
          <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dimensionColor(i.dimension).bar}`} aria-hidden="true" />
          <span className="min-w-0 flex-1 text-foreground">{i.text}</span>
          <span className="shrink-0 tabular-nums text-fg2">
            {formatScore(i.others)}
            {i.gap !== null && Math.abs(i.gap) >= 1.5 && (
              <span className="ml-1 text-xs text-fg3">(öz {formatScore(i.self)})</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function SubjectReportPage() {
  const { id, sid } = useParams<{ id: string; sid: string }>();
  const { canManage, canAnalyze } = usePermissions();
  const { data, isLoading, isError, error, refetch } = useSubjectResults(id, sid);
  const release = useReleaseSubject();
  const [confirmRelease, setConfirmRelease] = useState(false);

  if (!canAnalyze) {
    return (
      <div className="bz-card">
        <div className="bz-empty">
          <p className="bz-empty__title">Bu raporu görme yetkiniz yok</p>
          <p className="bz-empty__text">Bireysel 360° sonuçları yalnız İK ve analist rollerine açıktır.</p>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="bz-skeleton h-24 rounded-2xl" />
        <div className="bz-skeleton h-80 rounded-2xl" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="bz-card">
        <div className="bz-empty" role="alert">
          <span className="bz-icon-box text-danger">
            <AlertCircle />
          </span>
          <p className="bz-empty__title">Rapor yüklenemedi</p>
          <p className="bz-empty__text">{apiErrorMessage(error, "Beklenmeyen bir hata oluştu")}</p>
          <button type="button" className="bz-btn bz-btn--soft mt-2" onClick={() => void refetch()}>
            Tekrar dene
          </button>
        </div>
      </div>
    );
  }

  return (
    <Report
      data={data}
      canManage={canManage}
      releasing={release.isPending}
      onRelease={() => setConfirmRelease(true)}
      onUnrelease={async () => {
        try {
          await release.mutateAsync({ cycleId: id, subjectId: sid, released: false });
          toast.success("Yayın geri alındı");
        } catch (err) {
          toast.error(apiErrorMessage(err, "Yayın geri alınamadı"));
        }
      }}
      confirm={
        <Dialog
          open={confirmRelease}
          onClose={() => setConfirmRelease(false)}
          title="Sonucu yayınla"
          description="Yayınlanan sonuç, paylaşım ayarı açıksa personelin kendi portalında görünür. Eşik altındaki gruplar orada da gizli kalır."
          footer={
            <>
              <button type="button" className="bz-btn" onClick={() => setConfirmRelease(false)}>
                Vazgeç
              </button>
              <button
                type="button"
                className="bz-btn bz-btn--primary"
                onClick={async () => {
                  setConfirmRelease(false);
                  try {
                    await release.mutateAsync({ cycleId: id, subjectId: sid, released: true });
                    toast.success("Sonuç yayınlandı");
                  } catch (err) {
                    toast.error(apiErrorMessage(err, "Sonuç yayınlanamadı"));
                  }
                }}
              >
                Yayınla
              </button>
            </>
          }
        >
          <p className="text-[13px] text-fg2">
            Yayın, personelle paylaşımın ön koşuludur; paylaşımın açık olup olmadığı kurum ve dönem ayarına bağlıdır
            (varsayılan: paylaşma).
          </p>
        </Dialog>
      }
    />
  );
}

function Report({
  data,
  canManage,
  releasing,
  onRelease,
  onUnrelease,
  confirm,
}: {
  data: SubjectResults;
  canManage: boolean;
  releasing: boolean;
  onRelease: () => void;
  onUnrelease: () => void;
  confirm: React.ReactNode;
}) {
  const { series: palette, grid, muted, text2, fontFamily, mode } = useChartTheme();
  const [showTable, setShowTable] = useState(false);

  const dims = useMemo(
    () => DIMENSION_ORDER.map((d) => data.dimensions.find((x) => x.dimension === d)).filter(Boolean) as SubjectResults["dimensions"],
    [data],
  );

  const radar = useMemo(() => {
    const series: { name: string; data: number[] }[] = [];
    const colors: string[] = [];
    const push = (key: keyof typeof SERIES_INDEX, name: string, values: Array<number | null | undefined>) => {
      if (values.every((v) => v === null || v === undefined)) return;
      series.push({ name, data: values.map((v) => v ?? 0) });
      colors.push(palette[SERIES_INDEX[key]]!);
    };
    push("OTHERS", "Diğerleri (ağırlıklı)", dims.map((d) => d.others));
    for (const g of data.groups) {
      if (!g.visible || g.relation === "SELF") continue;
      push(g.relation, g.relation === "MANAGER" && g.raterNames?.length ? `Yönetici (${g.raterNames.join(", ")})` : g.label, dims.map((d) => d.byGroup[g.relation]));
    }
    push("SELF", "Öz değerlendirme", dims.map((d) => d.self));
    return { series, colors };
  }, [data, dims, palette]);

  const options: ApexOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false }, fontFamily, foreColor: muted, background: "transparent", animations: { enabled: false } },
      colors: radar.colors,
      stroke: { width: 2 },
      fill: { opacity: 0.08 },
      markers: { size: 0, hover: { size: 5 } },
      dataLabels: { enabled: false },
      theme: { mode },
      plotOptions: {
        radar: { size: 130, polygons: { strokeColors: grid, connectorColors: grid, fill: { colors: ["transparent"] } } },
      },
      responsive: [{ breakpoint: 640, options: { plotOptions: { radar: { size: 88 } } } }],
      xaxis: {
        categories: dims.map((d) => dimLabel(d.dimension)),
        labels: { style: { colors: dims.map(() => text2), fontSize: "12px", fontWeight: 500 } },
      },
      yaxis: { show: false, min: 0, max: 10, tickAmount: 5 },
      legend: {
        position: "bottom",
        labels: { colors: text2 },
        fontSize: "12px",
        markers: { size: 5, shape: "circle", strokeWidth: 0, offsetX: -4 },
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      tooltip: { theme: mode, y: { formatter: (v: number) => formatScore(v) } },
    }),
    [radar.colors, dims, fontFamily, muted, grid, text2, mode],
  );

  const s = data.subject;
  const visibleOthers = data.groups.filter((g) => g.relation !== "SELF" && g.visible);
  const flags = data.raterFlags ?? [];

  return (
    <div className="w-full">
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text min-w-0">
          <Link href={`/performance/cycles/${data.cycle.id}`} className="bz-btn bz-btn--ghost bz-btn--sm -ml-2 mb-1 w-fit">
            <ArrowLeft />
            {data.cycle.name}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="bz-page-header__title">{s.name}</h1>
            {s.status === "RELEASED" ? (
              <span className="bz-status" data-status="approved">
                Yayınlandı {s.releasedAt ? `· ${formatDate(s.releasedAt)}` : ""}
              </span>
            ) : (
              <span className="bz-status" data-status="draft">
                Yayınlanmadı
              </span>
            )}
          </div>
          <p className="bz-page-header__sub">
            {s.position}
            {s.department ? ` · ${s.department}` : ""} · {data.completedRaters} / {data.totalRaters} değerlendirici tamamladı
            {data.cycle.status !== "CLOSED" ? " · anlık sonuç" : ""}
          </p>
        </div>
        {canManage && (
          <div className="bz-page-header__actions">
            {s.status === "RELEASED" ? (
              <button type="button" className="bz-btn" onClick={onUnrelease} disabled={releasing}>
                {releasing ? <Loader2 className="animate-spin" /> : <Undo2 />}
                Yayını geri al
              </button>
            ) : (
              <button
                type="button"
                className="bz-btn bz-btn--primary"
                onClick={onRelease}
                disabled={releasing || data.cycle.status !== "CLOSED"}
                aria-describedby={data.cycle.status !== "CLOSED" ? "release-hint" : undefined}
              >
                {releasing ? <Loader2 className="animate-spin" /> : <Send />}
                Sonucu yayınla
              </button>
            )}
          </div>
        )}
      </motion.div>
      {canManage && data.cycle.status !== "CLOSED" && s.status !== "RELEASED" && (
        <p id="release-hint" className="bz-hint -mt-2 mb-4">
          Sonuç dönem kapandıktan sonra yayınlanabilir.
        </p>
      )}

      {/* Özet puanlar */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="bz-card bz-stat">
          <span className="bz-stat__label">Birleşik puan</span>
          <span className="bz-stat__value tabular-nums">{formatScore(data.overall.weighted)}</span>
          <span className="text-xs text-fg3">0–10 · grup ağırlıklı</span>
        </div>
        <div className="bz-card bz-stat">
          <span className="bz-stat__label">Diğerleri</span>
          <span className="bz-stat__value tabular-nums">{formatScore(data.overall.others)}</span>
          <span className="text-xs text-fg3">{visibleOthers.map((g) => g.label).join(", ") || "Görünür grup yok"}</span>
        </div>
        <div className="bz-card bz-stat">
          <span className="bz-stat__label">Öz değerlendirme</span>
          <span className="bz-stat__value tabular-nums">{formatScore(data.overall.self)}</span>
        </div>
        <div className="bz-card bz-stat">
          <span className="bz-stat__label">Öz − diğerleri</span>
          <span className="bz-stat__value">
            <GapChip
              gap={
                data.overall.self !== null && data.overall.others !== null
                  ? Math.round((data.overall.self - data.overall.others) * 10) / 10
                  : null
              }
            />
          </span>
        </div>
      </div>

      {/* Gruplar */}
      <section aria-labelledby="groups-title" className="mb-4">
        <h2 id="groups-title" className="sr-only">
          Değerlendirici grupları
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.groups.map((g) => (
            <div key={g.relation} className="bz-card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-bold text-foreground">{g.label}</p>
                <span className="text-xs tabular-nums text-fg3">ağırlık {g.weight}</span>
              </div>
              {g.visible ? (
                <>
                  <p className="mt-1 font-display text-[24px] font-extrabold tabular-nums text-foreground">
                    {formatScore(g.overall)}
                  </p>
                  <p className="text-xs text-fg3">
                    {g.completed} / {g.assigned} tamamladı
                    {g.raterNames?.length ? ` · ${g.raterNames.join(", ")}` : ""}
                    {(g.relation === "PEER" || g.relation === "SUBORDINATE") && " · grup ortalaması"}
                  </p>
                </>
              ) : (
                <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-fg2">
                  <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg3" aria-hidden="true" />
                  {g.hiddenReason === "INSUFFICIENT_RATERS"
                    ? `Eşik altında: ${g.completed} / ${data.anonymityMinRaters} kişi tamamladı. Anonimlik için sonuç gizli.`
                    : g.assigned > 0
                      ? `Henüz tamamlayan yok (${g.assigned} atandı).`
                      : "Bu grupta değerlendirici yok."}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Radar + güçlü yanlar */}
      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <GlassCard hover={false} className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-foreground">Yetkinlik radarı</h2>
            <button type="button" className="bz-btn bz-btn--ghost bz-btn--sm" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
              {showTable ? "Grafik" : "Tablo görünümü"}
            </button>
          </div>
          {dims.length === 0 ? (
            <div className="bz-empty py-10">
              <p className="bz-empty__title">Henüz gösterilecek puan yok</p>
              <p className="bz-empty__text">Görünür bir grup tamamlayınca radar oluşur.</p>
            </div>
          ) : showTable ? (
            <div className="bz-table-wrap">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th scope="col">Boyut</th>
                    <th scope="col" className="is-num">Öz</th>
                    {visibleOthers.map((g) => (
                      <th key={g.relation} scope="col" className="is-num">
                        {g.label}
                      </th>
                    ))}
                    <th scope="col" className="is-num">Diğerleri</th>
                    <th scope="col" className="is-num">Fark</th>
                  </tr>
                </thead>
                <tbody>
                  {dims.map((d) => (
                    <tr key={d.dimension}>
                      <td>{dimLabel(d.dimension)}</td>
                      <td className="is-num">{formatScore(d.self)}</td>
                      {visibleOthers.map((g) => (
                        <td key={g.relation} className="is-num">
                          {formatScore(d.byGroup[g.relation])}
                        </td>
                      ))}
                      <td className="is-num font-semibold">{formatScore(d.others)}</td>
                      <td className="is-num">
                        <GapChip gap={d.gap} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="tabular-nums">
              <ApexChart type="radar" height={360} series={radar.series} options={options} />
            </div>
          )}
        </GlassCard>

        <div className="space-y-4">
          <section className="bz-card p-4" aria-labelledby="strengths-title">
            <h2 id="strengths-title" className="mb-2 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <TrendingUp className="h-4 w-4 text-success" aria-hidden="true" />
              Güçlü yanlar
            </h2>
            <ItemList items={data.strengths} empty="Diğerlerinin 7 ve üzeri verdiği madde yok." />
          </section>
          <section className="bz-card p-4" aria-labelledby="dev-title">
            <h2 id="dev-title" className="mb-2 flex items-center gap-2 text-[15px] font-bold text-foreground">
              <TrendingDown className="h-4 w-4 text-warning" aria-hidden="true" />
              Gelişim alanları
            </h2>
            <ItemList items={data.developmentAreas} empty="Henüz veri yok." />
          </section>
        </div>
      </div>

      {/* Öz vs diğerleri */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="bz-card p-4" aria-labelledby="blind-title">
          <h2 id="blind-title" className="mb-1 text-[15px] font-bold text-foreground">
            Kör noktalar
          </h2>
          <p className="mb-3 text-xs text-fg3">Kendini diğerlerinden en az 1,5 puan yüksek gördüğü maddeler.</p>
          <ItemList items={data.blindSpots} empty="Belirgin kör nokta yok." />
        </section>
        <section className="bz-card p-4" aria-labelledby="hidden-title">
          <h2 id="hidden-title" className="mb-1 text-[15px] font-bold text-foreground">
            Gizli güçlü yanlar
          </h2>
          <p className="mb-3 text-xs text-fg3">Diğerlerinin kendisinden en az 1,5 puan yüksek gördüğü maddeler.</p>
          <ItemList items={data.hiddenStrengths} empty="Belirgin gizli güçlü yan yok." />
        </section>
      </div>

      {/* Yetkinlik detayı */}
      <section className="bz-card mb-4 min-w-0 p-4" aria-labelledby="items-title">
        <h2 id="items-title" className="mb-3 text-[15px] font-bold text-foreground">
          Yetkinlik detayı
        </h2>
        {data.items.length === 0 ? (
          <p className="text-[13px] text-fg3">Henüz gösterilecek madde yok.</p>
        ) : (
          <div className="bz-table-wrap">
            <table className="bz-table">
              <thead>
                <tr>
                  <th scope="col">Madde</th>
                  <th scope="col" className="is-num">Öz</th>
                  {visibleOthers.map((g) => (
                    <th key={g.relation} scope="col" className="is-num hidden md:table-cell">
                      {g.label}
                    </th>
                  ))}
                  <th scope="col" className="is-num">Diğerleri</th>
                  <th scope="col" className="is-num">Fark</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => {
                  const c = dimensionColor(i.dimension);
                  return (
                    <tr key={i.questionId}>
                      <td className="min-w-[200px] whitespace-normal py-2">
                        <p className="text-foreground">{i.text}</p>
                        <span className={`bz-chip bz-chip--sm mt-1 ${c.bg}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${c.bar}`} aria-hidden="true" />
                          {dimLabel(i.dimension)}
                        </span>
                      </td>
                      <td className="is-num">{formatScore(i.self)}</td>
                      {visibleOthers.map((g) => (
                        <td key={g.relation} className="is-num hidden md:table-cell">
                          {formatScore(i.byGroup[g.relation])}
                        </td>
                      ))}
                      <td className="is-num font-semibold">{formatScore(i.others)}</td>
                      <td className="is-num">
                        <GapChip gap={i.gap} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Yorumlar */}
      <section className="bz-card mb-4 p-4" aria-labelledby="comments-title">
        <h2 id="comments-title" className="mb-1 flex items-center gap-2 text-[15px] font-bold text-foreground">
          <MessageSquareQuote className="h-4 w-4 text-fg3" aria-hidden="true" />
          Yorumlar
        </h2>
        <p className="mb-3 text-xs text-fg3">
          Sıra karıştırılmıştır. Eş düzey ve ast yorumları kimlik olmadan, yalnız grup eşiği aşıldıysa gösterilir.
        </p>
        {data.comments.length === 0 ? (
          <p className="text-[13px] text-fg3">Gösterilecek yorum yok.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {data.comments.map((c) => (
              <li key={c.id} className="bz-well rounded-xl p-3">
                <p className="text-[13.5px] leading-relaxed text-foreground">“{c.text}”</p>
                <p className="mt-1.5 text-[11.5px] text-fg3">
                  <b className="font-semibold text-fg2">{c.authorName ?? RELATION_LABEL[c.relation]}</b> · {c.questionText}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Özensiz değerlendirici işaretleri (yalnız panel) */}
      <section className="bz-card p-4" aria-labelledby="flags-title">
        <h2 id="flags-title" className="mb-1 flex items-center gap-2 text-[15px] font-bold text-foreground">
          <ShieldCheck className="h-4 w-4 text-fg3" aria-hidden="true" />
          Veri kalitesi
        </h2>
        <p className="mb-3 text-xs text-fg3">
          Çok hızlı (soru başına 3 sn altı) ya da hep aynı puanla doldurulan formlar. Puanlar hesaba dahildir; yalnız İK görür.
        </p>
        {flags.length === 0 ? (
          <p className="text-[13px] text-fg2">Şüpheli form yok.</p>
        ) : (
          <ul className="space-y-2">
            {flags.map((f) => (
              <li key={f.assignmentId} className="flex flex-wrap items-center gap-2 text-[13px]">
                <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
                <b className="text-foreground">{f.raterName}</b>
                <span className="text-fg3">{RELATION_LABEL[f.relation]}</span>
                {f.reasons.map((r) => (
                  <span key={r} className="bz-chip bz-chip--warning">
                    {FLAG_LABEL[r]}
                  </span>
                ))}
                {f.durationSec !== null && <span className="text-xs text-fg3">{f.durationSec} sn</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirm}
    </div>
  );
}
