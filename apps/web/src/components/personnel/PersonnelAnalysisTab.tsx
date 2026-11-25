"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowDown, ArrowUp, Lock, Minus, TrendingUp } from "lucide-react";
import { DIMENSION_LABELS, DIMENSION_SHORT_LABELS, type QuestionDimension } from "@ph/shared";
import { cn } from "@/lib/utils";
import { useChartTheme } from "@/lib/chart-theme";
import { dimensionColor, dimensionHex } from "@/lib/dimension-colors";
import type { HistoryTrendPoint, PersonnelHistory } from "@/hooks/use-personnel-history";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

const CHART_ANIMATIONS = {
  enabled: true,
  speed: 340,
  animateGradually: { enabled: false },
  dynamicAnimation: { enabled: true, speed: 280 },
};

const fmtShort = (iso: string) => format(new Date(iso), "MMM yyyy", { locale: tr });
const fmtDay = (iso: string) => format(new Date(iso), "d MMM yyyy", { locale: tr });

/** Ondalık virgül (tr-TR) ile bir basamak */
const num = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Delta({ value, suffix }: { value: number | null; suffix?: string }) {
  if (value == null) return <span className="text-fg3">—</span>;
  const rounded = Math.round(value * 10) / 10;
  const dir = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const Icon = dir === "up" ? ArrowUp : dir === "down" ? ArrowDown : Minus;
  const text = dir === "up" ? `+${num(rounded)}` : dir === "down" ? `−${num(Math.abs(rounded))}` : "0,0";
  return (
    <span className={cn("bz-stat__delta", `bz-stat__delta--${dir}`)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>
        {text}
        <span className="sr-only">
          {dir === "up" ? " artış" : dir === "down" ? " düşüş" : " değişim yok"}
        </span>
        {suffix && <span className="font-medium text-fg3"> · {suffix}</span>}
      </span>
    </span>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="bz-stat">
      <span className="bz-stat__label">{label}</span>
      <span className="bz-stat__value tabular-nums">{value}</span>
      {children}
    </div>
  );
}

export function PersonnelAnalysisTab({ history }: { history: PersonnelHistory }) {
  const { fontFamily, muted, grid, axis, text2, mode, series: palette } = useChartTheme();
  const points = history.trend.points;
  const dims = history.trend.dimensions;
  const latest = points[points.length - 1] ?? null;
  const previous = points.length > 1 ? points[points.length - 2]! : null;

  // Eksende kısa tarih; test adı ipucunda (uzun adlar eksen kenarında kesilmesin)
  const categories = useMemo(() => points.map((p) => fmtShort(p.date)), [points]);

  const lineSeries = useMemo(
    () => [
      ...dims.map((d) => ({
        name: DIMENSION_SHORT_LABELS[d] ?? d,
        data: points.map((p) => p.scores[d]),
      })),
      { name: "Genel", data: points.map((p) => p.overall) },
    ],
    [dims, points],
  );

  const lineOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily,
        foreColor: muted,
        background: "transparent",
        animations: CHART_ANIMATIONS,
      },
      // DESIGN.md §28.2: 2px düz çizgi; tek noktalı seriler de görünsün diye nokta 4px
      stroke: { width: [...dims.map(() => 2), 3], curve: "straight", dashArray: [...dims.map(() => 0), 5] },
      dataLabels: { enabled: false },
      markers: { size: 4, strokeWidth: 0, hover: { size: 6 } },
      xaxis: {
        categories,
        axisBorder: { show: true, color: axis },
        axisTicks: { show: false },
        crosshairs: { stroke: { color: axis, width: 1, dashArray: 0 } },
        tooltip: { enabled: false },
        labels: { style: { colors: muted, fontSize: "11px" }, hideOverlappingLabels: true, trim: true },
      },
      yaxis: {
        min: 0,
        max: 10,
        tickAmount: 5,
        labels: { style: { colors: muted, fontSize: "11px" }, formatter: (v: number) => v.toFixed(0) },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 0,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { left: 12, right: 24 },
      },
      legend: {
        position: "bottom",
        horizontalAlign: "center",
        fontSize: "12px",
        fontWeight: 500,
        labels: { colors: text2 },
        markers: { size: 5, shape: "circle", strokeWidth: 0, offsetX: -4 },
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      colors: [...dims.map((d) => dimensionHex(d, mode)), palette[5]],
      states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
      tooltip: {
        theme: mode,
        shared: true,
        intersect: false,
        x: {
          formatter: (_val: number, opts?: { dataPointIndex?: number }) => {
            const p = points[opts?.dataPointIndex ?? -1];
            return p ? `${p.label} · ${fmtDay(p.date)}` : String(_val);
          },
        },
        y: { formatter: (val: number | null) => (val != null ? `${val.toFixed(1)} / 10` : "—") },
      },
      theme: { mode },
    }),
    [categories, points, dims, fontFamily, muted, axis, grid, text2, mode, palette],
  );

  // Radar: son test (+ varsa önceki) — yalnız son testte skoru olan boyutlar
  const radarDims = useMemo(
    () => (latest ? dims.filter((d) => latest.scores[d] != null) : []),
    [latest, dims],
  );
  const radarSeries = useMemo(() => {
    if (!latest) return [];
    const s = [{ name: `Son: ${latest.label}`, data: radarDims.map((d) => latest.scores[d] ?? 0) }];
    // Önceki test yalnız aynı boyutların hepsinde skor varsa çizilir (eksik boyut 0 gibi görünmesin)
    if (previous && radarDims.every((d) => previous.scores[d] != null)) {
      s.push({
        name: `Önceki: ${previous.label}`,
        data: radarDims.map((d) => previous.scores[d] ?? 0),
      });
    }
    return s;
  }, [latest, previous, radarDims]);

  const radarOptions: ApexOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false }, fontFamily, foreColor: muted, background: "transparent", animations: CHART_ANIMATIONS },
      colors: [palette[0], muted],
      plotOptions: {
        radar: { polygons: { strokeColors: grid, connectorColors: grid, fill: { colors: ["transparent"] } } },
      },
      xaxis: {
        categories: radarDims.map((d) => DIMENSION_SHORT_LABELS[d] ?? d),
        labels: { style: { colors: radarDims.map(() => text2), fontSize: "12px", fontWeight: 500 } },
      },
      yaxis: { show: false, min: 0, max: 10, tickAmount: 5 },
      stroke: { width: 2, dashArray: [0, 4] },
      markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
      fill: { opacity: [0.12, 0] },
      dataLabels: { enabled: false },
      legend: {
        position: "bottom",
        fontSize: "12px",
        fontWeight: 500,
        labels: { colors: text2 },
        markers: { size: 5, shape: "circle", strokeWidth: 0, offsetX: -4 },
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      states: { hover: { filter: { type: "none" } }, active: { filter: { type: "none" } } },
      theme: { mode },
      tooltip: { theme: mode, y: { formatter: (val: number) => `${val.toFixed(1)} / 10` } },
    }),
    [radarDims, fontFamily, muted, grid, text2, mode, palette],
  );

  if (!history.canViewAnalysis) {
    return (
      <div className="bz-empty py-12">
        <Lock className="h-7 w-7 text-fg3" aria-hidden="true" />
        <p className="bz-empty__title text-[15px]">Analizleri görme yetkiniz yok</p>
        <p className="bz-empty__text">
          Skorlar ve analizler yalnız İK yöneticisi, analist ve yönetici rollerine açıktır.
        </p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="bz-empty py-12">
        <TrendingUp className="h-7 w-7 text-fg3" aria-hidden="true" />
        <p className="bz-empty__title text-[15px]">Henüz skorlu test yok</p>
        <p className="bz-empty__text">
          Tamamlanan testlerin boyut skorları oluştukça trend ve karşılaştırma burada görünür.
        </p>
      </div>
    );
  }

  const { summary } = history;
  const overallDelta =
    summary.latestOverall != null && summary.previousOverall != null
      ? summary.latestOverall - summary.previousOverall
      : null;

  return (
    <div className="space-y-6">
      {/* KPI: tek değerler grafik değil (DESIGN.md §28.2) */}
      <div className="bz-kpi-row overflow-hidden rounded-[var(--bz-radius-md)] border border-border">
        <Stat
          label="Son genel skor"
          value={summary.latestOverall != null ? num(summary.latestOverall) : "—"}
        >
          {overallDelta != null ? (
            <Delta value={overallDelta} suffix="önceki teste göre" />
          ) : (
            <span className="text-[12px] text-fg3">Karşılaştırma için tek test var</span>
          )}
        </Stat>
        <Stat
          label="Ortalama"
          value={summary.averageOverall != null ? num(summary.averageOverall) : "—"}
        >
          <span className="text-[12px] text-fg3 tabular-nums">{points.length} skorlu test</span>
        </Stat>
        <Stat label="Tamamlanan test" value={String(summary.completedSessions)}>
          <span className="text-[12px] text-fg3 tabular-nums">
            {summary.totalSessions} atanmış
          </span>
        </Stat>
        <Stat label="İK onaylı analiz" value={String(summary.approvedSessions)}>
          <span className="text-[12px] text-fg3">
            {summary.lastCompletedAt ? `Son test ${fmtDay(summary.lastCompletedAt)}` : "—"}
          </span>
        </Stat>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <section className="min-w-0 xl:col-span-3" aria-labelledby="trend-title">
          <h3 id="trend-title" className="bz-record__group">
            Boyut trendi
          </h3>
          <p className="-mt-2 mb-2 text-[12.5px] text-fg3">
            Her tamamlanan testin boyut skorları, eskiden yeniye. Kesikli çizgi genel skordur.
          </p>
          <div className="tabular-nums">
            <ApexChart type="line" height={340} series={lineSeries} options={lineOptions} />
          </div>
        </section>

        <section className="min-w-0 xl:col-span-2" aria-labelledby="radar-title">
          <h3 id="radar-title" className="bz-record__group">
            Son profil
          </h3>
          <p className="-mt-2 mb-2 text-[12.5px] text-fg3">
            {latest ? `${latest.label} · ${fmtDay(latest.date)}` : ""}
            {radarSeries.length > 1
              ? " — önceki testle karşılaştırmalı"
              : previous
                ? " — önceki testte bu boyutların hepsi skorlanmadığı için karşılaştırma tabloda"
                : ""}
          </p>
          {radarDims.length >= 3 ? (
            <div className="tabular-nums">
              <ApexChart type="radar" height={340} series={radarSeries} options={radarOptions} />
            </div>
          ) : (
            <div className="bz-empty py-10">
              <p className="bz-empty__text">
                Radar için son testte en az üç boyutun skoru gerekli; bu testte{" "}
                {radarDims.length} boyut skorlandı.
              </p>
            </div>
          )}
        </section>
      </div>

      <ComparisonTable points={points} dims={dims} />

      {history.reviews.length === 0 && (
        <p className="text-[12.5px] text-fg3">
          360° değerlendirme sonuçları yayınlandığında bu karşılaştırmaya eklenir.
        </p>
      )}
    </div>
  );
}

/** Testler arası karşılaştırma; grafiklerin tablo görünümü (DESIGN.md §28.2) */
function ComparisonTable({ points, dims }: { points: HistoryTrendPoint[]; dims: QuestionDimension[] }) {
  const last = points[points.length - 1]!;
  const prev = points.length > 1 ? points[points.length - 2]! : null;
  const rows: { key: string; label: string; dim?: QuestionDimension; get: (p: HistoryTrendPoint) => number | null }[] = [
    ...dims.map((d) => ({
      key: d,
      label: DIMENSION_LABELS[d] ?? d,
      dim: d,
      get: (p: HistoryTrendPoint) => p.scores[d],
    })),
    { key: "overall", label: "Genel skor", get: (p: HistoryTrendPoint) => p.overall },
  ];

  return (
    <section aria-labelledby="compare-title">
      <h3 id="compare-title" className="bz-record__group">
        Testler arası karşılaştırma
      </h3>
      <div className="overflow-x-auto rounded-[var(--bz-radius-md)] border border-border">
        <table className="bz-table">
          <caption className="sr-only">
            Boyut skorları testlere göre; son sütun son iki test arasındaki değişim
          </caption>
          <thead>
            <tr>
              <th scope="col">Boyut</th>
              {points.map((p) => (
                <th key={p.sessionId} scope="col" className="is-num whitespace-nowrap">
                  <span className="block max-w-[180px] truncate" title={p.label}>
                    {p.label}
                  </span>
                  <span className="block text-[11px] font-medium text-fg3">{fmtDay(p.date)}</span>
                </th>
              ))}
              <th scope="col" className="is-num whitespace-nowrap">
                Değişim
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = r.get(last);
              const b = prev ? r.get(prev) : null;
              return (
                <tr key={r.key} className={r.key === "overall" ? "font-semibold" : undefined}>
                  <th scope="row" className="whitespace-nowrap text-left font-medium">
                    <span className="inline-flex items-center gap-2">
                      {r.dim ? (
                        <span
                          className={cn("h-2.5 w-2.5 flex-none rounded-full", dimensionColor(r.dim).bar)}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="h-2.5 w-2.5 flex-none rounded-full bg-series-6" aria-hidden="true" />
                      )}
                      {r.label}
                    </span>
                  </th>
                  {points.map((p) => {
                    const v = r.get(p);
                    return (
                      <td key={p.sessionId} className="is-num tabular-nums">
                        {v != null ? num(v) : <span className="text-fg3">—</span>}
                      </td>
                    );
                  })}
                  <td className="is-num">
                    <Delta value={a != null && b != null ? a - b : null} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
