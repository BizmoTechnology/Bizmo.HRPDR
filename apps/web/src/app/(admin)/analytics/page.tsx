"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import type { ApexOptions } from "apexcharts";
import {
  BarChart3,
  TrendingUp,
  Building2,
  Users,
  ArrowUp,
  ArrowDown,
  Minus,
  LayoutDashboard,
  GitCompareArrows,
  ThermometerSun,
  ArrowUpDown,
} from "lucide-react";
import { GlassCard, ScoreGauge } from "@ph/ui";
import { cn } from "@/lib/utils";
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
    transition: { staggerChildren: 0.07 },
  },
};

const motionItem = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const RADAR_CATEGORIES = ALL_DIMENSIONS.map(
  (d) => DIMENSION_SHORT_LABELS[d] ?? d,
);

const DIMENSION_COLORS: Record<string, { bg: string; text: string; stroke: string }> = {
  LOGICAL_ALGORITHMIC: {
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    stroke: "#3b82f6",
  },
  LEADERSHIP: {
    bg: "bg-purple-500/10",
    text: "text-purple-500",
    stroke: "#a855f7",
  },
  SOCIAL_INTELLIGENCE: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500",
    stroke: "#10b981",
  },
  GROWTH_POTENTIAL: {
    bg: "bg-amber-500/10",
    text: "text-amber-500",
    stroke: "#f59e0b",
  },
  DOMAIN_ALIGNMENT: {
    bg: "bg-rose-500/10",
    text: "text-rose-500",
    stroke: "#f43f5e",
  },
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

function useChartPalette() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return {
    dark,
    fg: dark ? "#e5e5e5" : "#262626",
    muted: dark ? "#a3a3a3" : "#737373",
    border: dark ? "#404040" : "#e5e5e5",
    grid: dark ? "#404040" : "#e7e5e4",
  };
}

function scoreHeatStyle(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) {
    return "bg-muted/50 text-muted-foreground";
  }
  if (score >= 8) {
    return "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-semibold";
  }
  if (score >= 6.5) {
    return "bg-lime-500/15 text-lime-900 dark:text-lime-200";
  }
  if (score >= 5) {
    return "bg-amber-500/15 text-amber-900 dark:text-amber-200";
  }
  return "bg-rose-500/15 text-rose-900 dark:text-rose-200";
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

export default function AnalyticsPage() {
  const palette = useChartPalette();
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

  const radarSeries = useMemo(() => {
    const orgData = ALL_DIMENSIONS.map((d) => {
      const stat = dimByKey.get(d);
      return stat?.avg ?? 0;
    });
    const series: RadarChartSeries = [
      { name: "Kurum ortalaması", data: orgData },
    ];
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
    }
    return series;
  }, [compareDeptIds, deptBreakdown, dimByKey]);

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

  const radarOptions: ApexOptions = useMemo(
    () => ({
      chart: {
        toolbar: { show: false },
        fontFamily: "inherit",
        background: "transparent",
      },
      plotOptions: {
        radar: {
          polygons: {
            strokeColors: palette.grid,
            connectorColors: palette.grid,
          },
        },
      },
      xaxis: { categories: RADAR_CATEGORIES },
      yaxis: {
        show: false,
        max: 10,
        min: 0,
        tickAmount: 5,
      },
      stroke: { width: 2 },
      markers: { size: 4, hover: { size: 6 } },
      fill: { opacity: 0.12 },
      legend: {
        position: "bottom",
        labels: { colors: palette.fg },
      },
      theme: { mode: palette.dark ? "dark" : "light" },
      tooltip: {
        theme: palette.dark ? "dark" : "light",
        y: {
          formatter: (val: number) => `${val.toFixed(1)} / 10`,
        },
      },
    }),
    [palette],
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
        fontFamily: "inherit",
        background: "transparent",
      },
      stroke: { width: 2.5, curve: "smooth", connectNulls: true },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 5 } },
      xaxis: {
        categories: monthlyPoints.map((p) => formatMonth(p.month)),
        labels: {
          style: { colors: palette.muted, fontSize: "11px" },
          rotate: -35,
          rotateAlways: monthlyPoints.length > 6,
        },
      },
      yaxis: {
        min: 0,
        max: 10,
        tickAmount: 5,
        labels: {
          style: { colors: palette.muted },
          formatter: (v: number) => v.toFixed(0),
        },
      },
      grid: { borderColor: palette.grid, strokeDashArray: 4 },
      legend: {
        position: "bottom",
        horizontalAlign: "center",
        labels: { colors: palette.fg },
      },
      colors: ALL_DIMENSIONS.map(
        (d) => DIMENSION_COLORS[d]?.stroke ?? "#6366f1",
      ),
      tooltip: {
        theme: palette.dark ? "dark" : "light",
        shared: true,
        intersect: false,
        y: {
          formatter: (val: number | null) =>
            val != null ? `${val.toFixed(1)} / 10` : "—",
        },
      },
      theme: { mode: palette.dark ? "dark" : "light" },
    }),
    [monthlyPoints, palette],
  );

  const toggleCompareDept = (id: string) => {
    setCompareDeptIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  return (
    <div className="space-y-8 w-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Analitik</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kurumsal özet, boyut kıyaslamaları, departman matrisi ve zaman içi
          trendler
        </p>
      </motion.div>

      {/* KPI */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        variants={motionContainer}
        initial="hidden"
        animate="show"
      >
        {dashLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-muted/40 animate-pulse"
            />
          ))
        ) : (
          <>
            <motion.div variants={motionItem}>
              <GlassCard hover={false} className="h-full">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Tamamlanma oranı
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {dashData?.completionRate != null
                    ? `${dashData.completionRate.toFixed(1)}%`
                    : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {dashData?.completedSessions ?? 0} /{" "}
                  {dashData?.totalSessions ?? 0} oturum
                </p>
              </GlassCard>
            </motion.div>
            <motion.div variants={motionItem}>
              <GlassCard hover={false} className="h-full">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-accent-green" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Genel ortalama skor
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {(dashData?.avgScore ?? 0).toFixed(1)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tamamlanan oturumların boyut ortalaması
                </p>
              </GlassCard>
            </motion.div>
            <motion.div variants={motionItem}>
              <GlassCard hover={false} className="h-full">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-accent-purple" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Aktif personel
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {dashData?.activePersonnel ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Toplam {dashData?.totalPersonnel ?? 0} kayıt
                </p>
              </GlassCard>
            </motion.div>
            <motion.div variants={motionItem}>
              <GlassCard hover={false} className="h-full">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Aktif değerlendirme
                  </span>
                </div>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {dashData?.activeAssessments ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Toplam {dashData?.totalAssessments ?? 0} tanım
                </p>
              </GlassCard>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Dimension Stats */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Boyut özeti
          </h2>
        </div>

        {dimLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : dimensions.length === 0 ? (
          <GlassCard hover={false}>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Henüz boyut verisi bulunmuyor
              </p>
            </div>
          </GlassCard>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4"
            variants={motionContainer}
            initial="hidden"
            animate="show"
          >
            {dimensions.map((dim: (typeof dimensions)[0]) => {
              const colors =
                DIMENSION_COLORS[dim.dimension] ??
                DIMENSION_COLORS.LOGICAL_ALGORITHMIC!;
              const colorBg = colors?.bg ?? "bg-blue-500/10";
              const colorText = colors?.text ?? "text-blue-500";
              return (
                <motion.div key={dim.dimension} variants={motionItem}>
                  <GlassCard className="flex flex-col items-center text-center">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold mb-3",
                        colorBg,
                        colorText,
                      )}
                    >
                      {DIMENSION_SHORT_LABELS[dim.dimension] ?? dim.dimension}
                    </span>
                    <ScoreGauge
                      score={dim.avg ?? 0}
                      size="lg"
                      label={DIMENSION_LABELS[dim.dimension]}
                    />
                    <div className="grid grid-cols-3 gap-3 w-full mt-4 pt-3 border-t border-border/20">
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Min
                        </p>
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {(dim.min ?? 0).toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Maks
                        </p>
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {(dim.max ?? 0).toFixed(1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Örnek
                        </p>
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {dim.count ?? 0}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Heatmap: department × dimension */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <ThermometerSun className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Departman × boyut matrisi
              </h2>
              <p className="text-xs text-muted-foreground">
                Hücreler boyut ortalamasını gösterir (0–10)
              </p>
            </div>
          </div>
        </div>

        <GlassCard hover={false} className="overflow-x-auto">
          {deptDimLoading ? (
            <div className="h-48 rounded-xl bg-muted/40 animate-pulse" />
          ) : deptBreakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Departmanlı tamamlanmış oturum yok veya boyut skoru eksik
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-3 pr-3 font-medium text-muted-foreground whitespace-nowrap">
                    Departman
                  </th>
                  <th className="text-center py-3 px-1 font-medium text-muted-foreground">
                    n
                  </th>
                  {ALL_DIMENSIONS.map((d) => (
                    <th
                      key={d}
                      className="text-center py-3 px-1 font-medium text-muted-foreground text-[11px] max-w-[5rem]"
                    >
                      {DIMENSION_SHORT_LABELS[d]}
                    </th>
                  ))}
                  <th className="text-center py-3 pl-2 font-medium text-muted-foreground whitespace-nowrap">
                    Ort.
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/25">
                {deptBreakdown.map((row) => {
                  const comp = deptCompositeAvg(row.averages);
                  return (
                    <tr key={row.departmentId} className="hover:bg-muted/20">
                      <td className="py-2.5 pr-3 font-medium text-foreground">
                        {row.departmentName}
                      </td>
                      <td className="text-center tabular-nums text-muted-foreground">
                        {row.sessionCount}
                      </td>
                      {ALL_DIMENSIONS.map((d) => {
                        const v = row.averages[d]?.avg;
                        return (
                          <td key={d} className="px-1 py-1.5">
                            <div
                              className={cn(
                                "rounded-lg py-1.5 text-center text-xs tabular-nums",
                                scoreHeatStyle(v),
                              )}
                            >
                              {v != null ? v.toFixed(1) : "—"}
                            </div>
                          </td>
                        );
                      })}
                      <td className="text-center pl-2 font-semibold tabular-nums">
                        {comp != null ? comp.toFixed(1) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </GlassCard>
      </div>

      {/* Radar compare */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
            <GitCompareArrows className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Boyut profili kıyaslama
            </h2>
            <p className="text-xs text-muted-foreground">
              Kurum ortalaması sabit; en fazla 3 departman seçin
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <GlassCard hover={false} className="xl:col-span-2 min-h-[360px]">
            {dimensions.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                Radar için önce tamamlanmış skorlar gerekli
              </div>
            ) : (
              <ApexChart
                type="radar"
                height={380}
                series={radarSeries}
                options={radarOptions}
              />
            )}
          </GlassCard>

          <GlassCard hover={false} className="flex flex-col">
            <p className="text-sm font-medium text-foreground mb-3">
              Departman seç
            </p>
            <div className="flex-1 overflow-y-auto max-h-72 space-y-2 pr-1">
              {deptDimLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 rounded-lg bg-muted/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : deptBreakdown.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Karşılaştırılacak departman yok.
                </p>
              ) : (
                deptBreakdown.map((d) => {
                  const active = compareDeptIds.includes(d.departmentId);
                  return (
                    <button
                      key={d.departmentId}
                      type="button"
                      onClick={() => toggleCompareDept(d.departmentId)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/40 hover:bg-muted/50 text-muted-foreground",
                      )}
                    >
                      <span className="truncate pr-2">{d.departmentName}</span>
                      <span className="text-[10px] tabular-nums opacity-70">
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
                className="mt-3 text-xs text-primary hover:underline"
              >
                Seçimi temizle
              </button>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Monthly dimension lines */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Aylık boyut trendleri
            </h2>
            <p className="text-xs text-muted-foreground">
              Son 12 ay — her boyut için ortalama skor
            </p>
          </div>
        </div>

        <GlassCard hover={false}>
          {monthlyDimLoading ? (
            <div className="h-80 rounded-xl bg-muted/40 animate-pulse" />
          ) : monthlyPoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Bu aralıkta boyutlu oturum verisi yok
              </p>
            </div>
          ) : (
            <ApexChart
              type="line"
              height={400}
              series={lineSeries}
              options={lineOptions}
            />
          )}
        </GlassCard>
      </div>

      {/* Monthly aggregate trend (existing table) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-accent-green/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-accent-green" />
          </div>
          <h2 className="text-base font-semibold text-foreground">
            Genel aylık özet
          </h2>
        </div>

        <GlassCard hover={false}>
          {trendsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-xl bg-muted/40 animate-pulse"
                />
              ))}
            </div>
          ) : trends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Henüz trend verisi bulunmuyor
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Dönem
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Tamamlanan
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Ort. Skor
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3">
                      Değişim
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {trends.map((t: (typeof trends)[0], idx: number) => {
                    const prev = trends[idx + 1];
                    const diff =
                      prev && t.avgScore != null && prev.avgScore != null
                        ? t.avgScore - prev.avgScore
                        : null;
                    return (
                      <tr
                        key={t.month ?? idx}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <span className="text-sm font-medium text-foreground">
                            {formatMonth(t.month)}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {t.completionCount ?? 0}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {t.avgScore != null ? (
                            <span
                              className={cn(
                                "text-sm font-bold tabular-nums",
                                t.avgScore >= 7
                                  ? "text-accent-green"
                                  : t.avgScore >= 4
                                    ? "text-amber-500"
                                    : "text-destructive",
                              )}
                            >
                              {t.avgScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          {diff !== null ? (
                            <div className="flex items-center gap-1">
                              {diff > 0 ? (
                                <ArrowUp className="h-3.5 w-3.5 text-accent-green" />
                              ) : diff < 0 ? (
                                <ArrowDown className="h-3.5 w-3.5 text-destructive" />
                              ) : (
                                <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                              <span
                                className={cn(
                                  "text-xs font-semibold tabular-nums",
                                  diff > 0
                                    ? "text-accent-green"
                                    : diff < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground",
                                )}
                              >
                                {diff > 0 ? "+" : ""}
                                {diff.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
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
      </div>

      {/* Department cards */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-accent-purple" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Departman özeti
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
            <select
              value={deptSort}
              onChange={(e) =>
                setDeptSort(e.target.value as typeof deptSort)
              }
              className="h-9 rounded-xl border border-border/50 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="avgDesc">Ortalama skor (yüksek)</option>
              <option value="sessionsDesc">Tamamlanan oturum</option>
              <option value="name">İsim (A-Z)</option>
            </select>
          </div>
        </div>

        {dashLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : sortedDeptCards.length === 0 ? (
          <GlassCard hover={false}>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Henüz departman verisi bulunmuyor
              </p>
            </div>
          </GlassCard>
        ) : (
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
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
                  <GlassCard>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {dept.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Users className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">
                            {dept.personnelCount} personel
                          </span>
                        </div>
                      </div>
                      {dept.avgScore != null && (
                        <ScoreGauge score={dept.avgScore} size="sm" />
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border/20">
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Tamamlanan
                        </p>
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {dept.completedTests}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">
                          Bekleyen
                        </p>
                        <p className="text-sm font-bold tabular-nums text-foreground">
                          {Math.max(
                            0,
                            dept.personnelCount - dept.completedTests,
                          )}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ),
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
