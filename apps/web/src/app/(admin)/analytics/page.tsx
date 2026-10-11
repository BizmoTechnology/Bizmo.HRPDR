"use client";

import { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { ApexOptions } from "apexcharts";
import {
  BarChart3,
  TrendingUp,
  Building2,
  Users,
  LayoutDashboard,
  GitCompareArrows,
  Grid3x3,
  CalendarRange,
} from "lucide-react";
import { GlassCard, ScoreGauge, StatCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { dimensionColor, dimensionHex } from "@/lib/dimension-colors";
import { useChartTheme } from "@/lib/chart-theme";
import {
  useDimensionStats,
  useTrends,
  useDashboardStats,
  useDepartmentDimensionBreakdown,
  useMonthlyDimensionTrends,
} from "@/hooks/use-api";
import {
  DIMENSION_LABELS,
  DIMENSION_SHORT_LABELS,
  ALL_DIMENSIONS,
} from "@ph/shared";

const ApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

type RadarChartSeries = { name: string; data: number[] }[];

const motionContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const motionItem = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const RADAR_CATEGORIES = ALL_DIMENSIONS.map(
  (d) => DIMENSION_SHORT_LABELS[d] ?? d,
);

/**
 * Kıyaslanan departmanların renk yuvaları (Bizmo seri paleti; kurum ortalaması seri 1 / mavi).
 * Renk departmana bağlıdır, seçim sırasına değil: biri çıkarılınca diğerleri yeniden boyanmaz (DESIGN.md §28.1).
 */
const DEPT_SLOTS = [
  { series: 1, dot: "bg-series-2" },
  { series: 2, dot: "bg-series-3" },
  { series: 4, dot: "bg-series-5" },
] as const;

/** Grafik giriş animasyonu kısa ve sakin (DESIGN.md §5) */
const CHART_ANIMATIONS = {
  enabled: true,
  speed: 340,
  animateGradually: { enabled: false },
  dynamicAnimation: { enabled: true, speed: 240 },
};

function formatMonth(dateStr: string) {
  try {
    const [y, m] = dateStr.split("-").map(Number);
    const d = new Date(y!, m! - 1, 1);
    return new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Departman × boyut matrisi: büyüklük ölçeği → tek ton mavi sıralı skala (DESIGN.md §28.1).
 * Açık tonlarda metin birincil renkte, en koyu adımda veri dolgusu + karşıt metin (≥ 4.5:1, iki temada).
 */
function scoreHeatStyle(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) {
    return "border border-dashed border-border-strong text-muted-foreground";
  }
  if (score >= 8) {
    return "bg-data-solid text-data-contrast font-semibold";
  }
  if (score >= 6.5) {
    return "bg-data/[0.45] text-foreground";
  }
  if (score >= 5) {
    return "bg-data/20 text-foreground";
  }
  return "bg-data/[0.08] text-foreground";
}

const HEAT_LEGEND = [
  { swatch: "bg-data/[0.08]", label: "5’in altı" },
  { swatch: "bg-data/20", label: "5 – 6.5" },
  { swatch: "bg-data/[0.45]", label: "6.5 – 8" },
  { swatch: "bg-data-solid", label: "8 ve üzeri" },
  { swatch: "border border-dashed border-border-strong", label: "Veri yok" },
];

/** Aylık ortalama skor bandı (çip tonu); değer her zaman metin olarak yazılır */
function trendScoreTone(score: number) {
  if (score >= 7) return "bz-chip--success";
  if (score >= 4) return "bz-chip--warning";
  return "bz-chip--danger";
}

function deptCompositeAvg(
  averages: Record<string, { avg: number } | undefined>,
): number | null {
  const vals = ALL_DIMENSIONS.map((d) => averages[d]?.avg).filter(
    (x): x is number => x != null && !Number.isNaN(x),
  );
  if (vals.length === 0) return null;
  return (
    Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
  );
}

function SectionHeader({
  icon: Icon,
  title,
  sub,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-3">
      <span className="bz-icon-box" aria-hidden="true">
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="w-full sm:w-auto">{action}</div>}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text?: string;
}) {
  return (
    <div className="bz-empty">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="bz-empty__title">{title}</p>
      {text && <p className="bz-empty__text">{text}</p>}
    </div>
  );
}

function StatSkeleton() {
  return (
    <GlassCard className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="bz-skeleton h-4 w-24" />
        <div className="bz-skeleton h-[34px] w-[34px] rounded-[10px]" />
      </div>
      <div>
        <div className="bz-skeleton h-8 w-16" />
        <div className="bz-skeleton mt-2 h-3 w-24" />
      </div>
    </GlassCard>
  );
}

export default function AnalyticsPage() {
  const {
    mode,
    series: palette,
    grid,
    axis,
    muted,
    text2,
    fontFamily,
  } = useChartTheme();
  const { data: dimData, isLoading: dimLoading } = useDimensionStats();
  const { data: trendsData, isLoading: trendsLoading } = useTrends();
  const { data: dashData, isLoading: dashLoading } = useDashboardStats();
  const { data: deptDimData, isLoading: deptDimLoading } =
    useDepartmentDimensionBreakdown();
  const { data: monthlyDimData, isLoading: monthlyDimLoading } =
    useMonthlyDimensionTrends();

  const [compareDeptIds, setCompareDeptIds] = useState<string[]>([]);
  const [deptSort, setDeptSort] = useState<
    "name" | "avgDesc" | "sessionsDesc"
  >("avgDesc");

  // Sabit referans: veri yokken her render'da yeni [] üretip memo'ları bozmasın
  const dimensions = useMemo(() => dimData ?? [], [dimData]);
  const trends = trendsData ?? [];
  const byDeptSection = useMemo(() => dashData?.byDepartment ?? [], [dashData]);
  const deptBreakdown = useMemo(() => deptDimData?.departments ?? [], [deptDimData]);
  const monthlyPoints = useMemo(() => monthlyDimData?.points ?? [], [monthlyDimData]);

  const dimByKey = useMemo(() => {
    const m = new Map<string, (typeof dimensions)[0]>();
    for (const d of dimensions) {
      m.set(d.dimension, d);
    }
    return m;
  }, [dimensions]);

  // Seçilen her departman ilk boş renk yuvasını alır ve seçili kaldıkça onu korur
  const slotRef = useRef<Map<string, number>>(new Map());
  const deptSlots = useMemo(() => {
    const prev = slotRef.current;
    const next = new Map<string, number>();
    for (const id of compareDeptIds) {
      const s = prev.get(id);
      if (s != null) next.set(id, s);
    }
    for (const id of compareDeptIds) {
      if (next.has(id)) continue;
      const used = new Set(next.values());
      next.set(id, DEPT_SLOTS.findIndex((_, i) => !used.has(i)));
    }
    slotRef.current = next;
    return next;
  }, [compareDeptIds]);

  const radar = useMemo(() => {
    const orgData = ALL_DIMENSIONS.map((d) => {
      const stat = dimByKey.get(d);
      return stat?.avg ?? 0;
    });
    const series: RadarChartSeries = [
      { name: "Kurum ortalaması", data: orgData },
    ];
    const colors: string[] = [palette[0]!];
    for (const id of compareDeptIds) {
      const row = deptBreakdown.find((x) => x.departmentId === id);
      if (!row) continue;
      const data = ALL_DIMENSIONS.map((d) => {
        const v = row.averages[d]?.avg;
        if (v != null) return v;
        const fallback = dimByKey.get(d)?.avg ?? 0;
        return fallback;
      });
      series.push({
        name:
          row.departmentName.length > 28
            ? `${row.departmentName.slice(0, 26)}…`
            : row.departmentName,
        data,
      });
      const slot = DEPT_SLOTS[deptSlots.get(id) ?? 0] ?? DEPT_SLOTS[0];
      colors.push(palette[slot.series]!);
    }
    return { series, colors };
  }, [compareDeptIds, deptBreakdown, dimByKey, deptSlots, palette]);

  const sortedDeptCards = useMemo(() => {
    const rows = [...byDeptSection];
    if (deptSort === "name") {
      rows.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    } else if (deptSort === "sessionsDesc") {
      rows.sort((a, b) => b.completedTests - a.completedTests);
    } else {
      rows.sort((a, b) => {
        const av = a.avgScore ?? -1;
        const bv = b.avgScore ?? -1;
        return bv - av;
      });
    }
    return rows;
  }, [byDeptSection, deptSort]);

  // Grafik teması: DESIGN.md §28 — sabit sıralı palet, soluk yatay ızgara, 11px soluk eksen etiketi, 2px düz çizgi
  const radarOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        toolbar: { show: false },
        fontFamily,
        foreColor: muted,
        background: "transparent",
        animations: CHART_ANIMATIONS,
      },
      colors: radar.colors,
      plotOptions: {
        radar: {
          polygons: {
            strokeColors: grid,
            connectorColors: grid,
            fill: { colors: ["transparent"] },
          },
        },
      },
      xaxis: {
        categories: RADAR_CATEGORIES,
        labels: {
          style: {
            colors: RADAR_CATEGORIES.map(() => text2),
            fontSize: "12px",
            fontWeight: 500,
          },
        },
      },
      yaxis: {
        show: false,
        max: 10,
        min: 0,
        tickAmount: 5,
      },
      stroke: { width: 2 },
      markers: { size: 0, hover: { size: 5 } },
      fill: { opacity: 0.1 },
      dataLabels: { enabled: false },
      legend: {
        position: "bottom",
        fontSize: "12px",
        fontWeight: 500,
        labels: { colors: text2 },
        markers: { size: 5, shape: "circle", strokeWidth: 0, offsetX: -4 },
        itemMargin: { horizontal: 10, vertical: 4 },
      },
      states: {
        hover: { filter: { type: "none" } },
        active: { filter: { type: "none" } },
      },
      theme: { mode },
      tooltip: {
        theme: mode,
        y: {
          formatter: (val: number) => `${val.toFixed(1)} / 10`,
        },
      },
    }),
    [radar.colors, fontFamily, muted, grid, text2, mode],
  );

  const lineSeries = useMemo(() => {
    return ALL_DIMENSIONS.map((dim) => ({
      name: DIMENSION_SHORT_LABELS[dim] ?? dim,
      data: monthlyPoints.map((p) => {
        const v = p.dimensions[dim];
        return v != null ? v : null;
      }),
    }));
  }, [monthlyPoints]);

  const lineOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        toolbar: { show: true },
        zoom: { enabled: true },
        fontFamily,
        foreColor: muted,
        background: "transparent",
        animations: CHART_ANIMATIONS,
      },
      stroke: { width: 2, curve: "straight", connectNulls: true },
      dataLabels: { enabled: false },
      markers: { size: 0, strokeWidth: 0, hover: { size: 5 } },
      xaxis: {
        categories: monthlyPoints.map((p) => formatMonth(p.month)),
        axisBorder: { show: true, color: axis },
        axisTicks: { show: false },
        crosshairs: { stroke: { color: axis, width: 1, dashArray: 0 } },
        tooltip: { enabled: false },
        labels: {
          style: { colors: muted, fontSize: "11px" },
          hideOverlappingLabels: true,
        },
      },
      yaxis: {
        min: 0,
        max: 10,
        tickAmount: 5,
        labels: {
          style: { colors: muted, fontSize: "11px" },
          formatter: (v: number) => v.toFixed(0),
        },
      },
      grid: {
        borderColor: grid,
        strokeDashArray: 0,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
        padding: { left: 8, right: 12 },
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
      colors: ALL_DIMENSIONS.map((d) => dimensionHex(d, mode)),
      states: {
        hover: { filter: { type: "none" } },
        active: { filter: { type: "none" } },
      },
      tooltip: {
        theme: mode,
        shared: true,
        intersect: false,
        y: {
          formatter: (val: number | null) =>
            val != null ? `${val.toFixed(1)} / 10` : "—",
        },
      },
      theme: { mode },
    }),
    [monthlyPoints, fontFamily, muted, axis, grid, text2, mode],
  );

  const toggleCompareDept = (id: string) => {
    setCompareDeptIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  return (
    <div className="w-full space-y-8">
      <motion.div
        className="bz-page-header mb-0"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Analitik</h1>
          <p className="bz-page-header__sub">
            Kurumsal özet, boyut kıyaslamaları, departman matrisi ve zaman içi
            trendler
          </p>
        </div>
      </motion.div>

      {/* KPI */}
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        variants={motionContainer}
        initial="hidden"
        animate="show"
      >
        {dashLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <motion.div variants={motionItem}>
              <StatCard
                className="h-full"
                title="Tamamlanma oranı"
                value={
                  dashData?.completionRate != null
                    ? `${dashData.completionRate.toFixed(1)}%`
                    : "—"
                }
                subtitle={`${dashData?.completedSessions ?? 0} / ${dashData?.totalSessions ?? 0} oturum`}
                icon={LayoutDashboard}
              />
            </motion.div>
            <motion.div variants={motionItem}>
              <StatCard
                className="h-full"
                title="Genel ortalama skor"
                value={(dashData?.avgScore ?? 0).toFixed(1)}
                subtitle="Tamamlanan oturumların boyut ortalaması"
                icon={BarChart3}
              />
            </motion.div>
            <motion.div variants={motionItem}>
              <StatCard
                className="h-full"
                title="Aktif personel"
                value={dashData?.activePersonnel ?? 0}
                subtitle={`Toplam ${dashData?.totalPersonnel ?? 0} kayıt`}
                icon={Users}
              />
            </motion.div>
            <motion.div variants={motionItem}>
              <StatCard
                className="h-full"
                title="Aktif değerlendirme"
                value={dashData?.activeAssessments ?? 0}
                subtitle={`Toplam ${dashData?.totalAssessments ?? 0} tanım`}
                icon={TrendingUp}
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Boyut özeti */}
      <section>
        <SectionHeader icon={BarChart3} title="Boyut özeti" />

        {dimLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bz-skeleton h-60 rounded-2xl" />
            ))}
          </div>
        ) : dimensions.length === 0 ? (
          <GlassCard hover={false}>
            <EmptyState
              icon={BarChart3}
              title="Henüz boyut verisi yok"
              text="Boyut özetleri tamamlanan değerlendirmelerden hesaplanır."
            />
          </GlassCard>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5"
            variants={motionContainer}
            initial="hidden"
            animate="show"
          >
            {dimensions.map((dim: (typeof dimensions)[0]) => (
              <motion.div key={dim.dimension} variants={motionItem}>
                <GlassCard className="flex h-full flex-col items-center px-3 text-center sm:px-5">
                  <span className="bz-chip mb-3">
                    <span
                      className={cn("bz-dot", dimensionColor(dim.dimension).bar)}
                      aria-hidden="true"
                    />
                    {DIMENSION_SHORT_LABELS[dim.dimension] ?? dim.dimension}
                  </span>
                  <ScoreGauge
                    score={dim.avg ?? 0}
                    size="lg"
                    label={DIMENSION_LABELS[dim.dimension]}
                    className="mb-4"
                  />
                  <dl className="mt-auto grid w-full grid-cols-3 gap-2 border-t border-divider pt-3">
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Min</dt>
                      <dd className="text-sm font-semibold tabular-nums text-foreground">
                        {(dim.min ?? 0).toFixed(1)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Maks</dt>
                      <dd className="text-sm font-semibold tabular-nums text-foreground">
                        {(dim.max ?? 0).toFixed(1)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted-foreground">Örnek</dt>
                      <dd className="text-sm font-semibold tabular-nums text-foreground">
                        {dim.count ?? 0}
                      </dd>
                    </div>
                  </dl>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Isı haritası: departman × boyut */}
      <section>
        <SectionHeader
          icon={Grid3x3}
          title="Departman × boyut matrisi"
          sub="Hücreler boyut ortalamasını gösterir (0–10); koyu ton daha yüksek skor"
        />

        <GlassCard hover={false} className="overflow-hidden p-0">
          {deptDimLoading ? (
            <div className="p-5" aria-hidden="true">
              <div className="bz-skeleton h-48 w-full rounded-xl" />
            </div>
          ) : deptBreakdown.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Matris için veri yok"
              text="Departmanlı tamamlanmış oturum yok veya boyut skoru eksik."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="bz-table min-w-[680px]">
                  <thead>
                    <tr>
                      <th className="pl-5">Departman</th>
                      <th className="is-num">Oturum</th>
                      {ALL_DIMENSIONS.map((d) => (
                        <th key={d} className="px-1.5 text-center">
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className={cn(
                                "h-2 w-2 flex-none rounded-full",
                                dimensionColor(d).bar,
                              )}
                              aria-hidden="true"
                            />
                            {DIMENSION_SHORT_LABELS[d]}
                          </span>
                        </th>
                      ))}
                      <th className="is-num pr-5">Ortalama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptBreakdown.map((row) => {
                      const comp = deptCompositeAvg(row.averages);
                      return (
                        <tr key={row.departmentId} className="[&>td]:h-11">
                          <td className="pl-5 font-semibold text-foreground">
                            {row.departmentName}
                          </td>
                          <td className="is-num text-fg2">{row.sessionCount}</td>
                          {ALL_DIMENSIONS.map((d) => {
                            const v = row.averages[d]?.avg;
                            return (
                              <td key={d} className="px-1.5">
                                <div
                                  className={cn(
                                    "flex h-8 min-w-[3.25rem] items-center justify-center rounded-md text-[13px] tabular-nums",
                                    scoreHeatStyle(v),
                                  )}
                                  title={`${DIMENSION_LABELS[d] ?? d}: ${v != null ? v.toFixed(1) : "veri yok"}`}
                                >
                                  {v != null ? v.toFixed(1) : "—"}
                                </div>
                              </td>
                            );
                          })}
                          <td className="is-num pr-5 font-semibold text-foreground">
                            {comp != null ? comp.toFixed(1) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider px-5 py-3 text-xs text-muted-foreground">
                <span className="font-semibold text-fg2">Ölçek</span>
                {HEAT_LEGEND.map((s) => (
                  <span key={s.label} className="inline-flex items-center gap-1.5">
                    <span
                      className={cn("h-3 w-5 rounded-[4px]", s.swatch)}
                      aria-hidden="true"
                    />
                    {s.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      </section>

      {/* Radar kıyaslama */}
      <section>
        <SectionHeader
          icon={GitCompareArrows}
          title="Boyut profili kıyaslama"
          sub="Kurum ortalaması sabit; en fazla 3 departman seçin"
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <GlassCard hover={false} className="min-h-[360px] min-w-0 xl:col-span-2">
            {dimensions.length === 0 ? (
              <EmptyState
                icon={GitCompareArrows}
                title="Henüz skor yok"
                text="Radar için önce tamamlanmış skorlar gerekli."
              />
            ) : (
              <div className="tabular-nums">
                <ApexChart
                  type="radar"
                  height={380}
                  series={radar.series}
                  options={radarOptions}
                />
              </div>
            )}
          </GlassCard>

          <GlassCard hover={false} className="flex flex-col">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-bold text-foreground">
                Departman seç
              </h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {compareDeptIds.length} / 3
              </span>
            </div>
            <div className="bz-scroll max-h-80 flex-1 space-y-1.5 overflow-y-auto pr-1">
              {deptDimLoading ? (
                <div className="space-y-1.5" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bz-skeleton h-11 rounded-xl" />
                  ))}
                </div>
              ) : deptBreakdown.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  Karşılaştırılacak departman yok.
                </p>
              ) : (
                deptBreakdown.map((d) => {
                  const active = compareDeptIds.includes(d.departmentId);
                  const slot = DEPT_SLOTS[deptSlots.get(d.departmentId) ?? 0];
                  return (
                    <button
                      key={d.departmentId}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleCompareDept(d.departmentId)}
                      className={cn(
                        "flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-[13.5px] transition-colors duration-150",
                        active
                          ? "border-brand/40 bg-brand-soft text-foreground"
                          : "border-border text-fg2 hover:bg-hover hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-2.5 w-2.5 flex-none rounded-full",
                          active && slot
                            ? slot.dot
                            : "bg-transparent ring-1 ring-inset ring-border-strong",
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {d.departmentName}
                      </span>
                      <span className="flex-none text-xs tabular-nums text-muted-foreground">
                        {d.sessionCount} oturum
                      </span>
                    </button>
                  );
                })
              )}
            </div>
            {compareDeptIds.length > 0 && (
              <button
                type="button"
                onClick={() => setCompareDeptIds([])}
                className="bz-btn bz-btn--ghost bz-btn--sm mt-3 self-start"
              >
                Seçimi temizle
              </button>
            )}
          </GlassCard>
        </div>
      </section>

      {/* Aylık boyut trendleri */}
      <section>
        <SectionHeader
          icon={TrendingUp}
          title="Aylık boyut trendleri"
          sub="Son 12 ay — her boyut için ortalama skor"
        />

        <GlassCard hover={false} className="min-w-0">
          {monthlyDimLoading ? (
            <div className="bz-skeleton h-80 rounded-xl" aria-hidden="true" />
          ) : monthlyPoints.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Trend verisi yok"
              text="Bu aralıkta boyutlu oturum verisi yok."
            />
          ) : (
            <div className="tabular-nums">
              <ApexChart
                type="line"
                height={400}
                series={lineSeries}
                options={lineOptions}
              />
            </div>
          )}
        </GlassCard>
      </section>

      {/* Genel aylık özet */}
      <section>
        <SectionHeader icon={CalendarRange} title="Genel aylık özet" />

        <GlassCard hover={false} className="overflow-hidden p-0">
          {trendsLoading ? (
            <div className="space-y-2 p-5" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bz-skeleton h-9 rounded-lg" />
              ))}
            </div>
          ) : trends.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="Henüz trend verisi yok"
              text="Aylık özet, tamamlanan oturumlar oldukça oluşur."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th className="pl-5">Dönem</th>
                    <th className="is-num">Tamamlanan</th>
                    <th className="is-num">Ort. skor</th>
                    <th className="is-num pr-5">Değişim</th>
                  </tr>
                </thead>
                <tbody>
                  {trends.map((t: (typeof trends)[0], idx: number) => {
                    // Sunucu ayları eskiden yeniye sıralar: değişim bir önceki aya göredir
                    const prev = idx > 0 ? trends[idx - 1] : undefined;
                    // Gösterilen hassasiyete (0.1) yuvarlanır: "0.0" görünen fark yatay sayılır
                    const diff =
                      prev && t.avgScore != null && prev.avgScore != null
                        ? Math.round((t.avgScore - prev.avgScore) * 10) / 10
                        : null;
                    const trend =
                      diff == null ? null : diff > 0 ? "up" : diff < 0 ? "down" : "flat";
                    return (
                      <tr key={t.month ?? idx}>
                        <td className="pl-5 font-semibold text-foreground">
                          {formatMonth(t.month)}
                        </td>
                        <td className="is-num text-fg2">{t.completionCount ?? 0}</td>
                        <td className="is-num">
                          {t.avgScore != null ? (
                            <span
                              className={cn(
                                "bz-chip tabular-nums",
                                trendScoreTone(t.avgScore),
                              )}
                            >
                              {t.avgScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="is-num pr-5">
                          {diff !== null && trend ? (
                            <span
                              className="bz-delta"
                              data-trend={trend}
                              data-good="up"
                            >
                              {diff > 0 ? "+" : ""}
                              {diff.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </section>

      {/* Departman özeti */}
      <section>
        <SectionHeader
          icon={Building2}
          title="Departman özeti"
          action={
            <label className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-fg2">Sırala</span>
              <select
                value={deptSort}
                onChange={(e) =>
                  setDeptSort(e.target.value as typeof deptSort)
                }
                className="bz-field bz-field--sm w-auto"
              >
                <option value="avgDesc">Ortalama skor (yüksek)</option>
                <option value="sessionsDesc">Tamamlanan oturum</option>
                <option value="name">İsim (A–Z)</option>
              </select>
            </label>
          }
        />

        {dashLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bz-skeleton h-36 rounded-2xl" />
            ))}
          </div>
        ) : sortedDeptCards.length === 0 ? (
          <GlassCard hover={false}>
            <EmptyState
              icon={Building2}
              title="Henüz departman verisi yok"
              text="Personel departmanlara atandığında özet burada görünür."
            />
          </GlassCard>
        ) : (
          <motion.div
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            variants={motionContainer}
            initial="hidden"
            animate="show"
          >
            {sortedDeptCards.map(
              (dept: {
                id: string;
                name: string;
                personnelCount: number;
                completedTests: number;
                avgScore: number | null;
              }) => (
                <motion.div key={dept.id ?? dept.name} variants={motionItem}>
                  <GlassCard className="h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-bold text-foreground">
                          {dept.name}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                          <span className="tabular-nums">{dept.personnelCount} personel</span>
                        </p>
                      </div>
                      {dept.avgScore != null && (
                        <ScoreGauge score={dept.avgScore} size="sm" />
                      )}
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-divider pt-3">
                      <div>
                        <dt className="text-[11px] text-muted-foreground">
                          Tamamlanan
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">
                          {dept.completedTests}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">
                          Bekleyen
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground">
                          {Math.max(
                            0,
                            dept.personnelCount - dept.completedTests,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </GlassCard>
                </motion.div>
              ),
            )}
          </motion.div>
        )}
      </section>
    </div>
  );
}
