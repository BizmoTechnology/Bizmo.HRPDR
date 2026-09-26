"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  ClipboardCheck,
  TrendingUp,
  Clock,
  ArrowRight,
  Activity,
  BrainCircuit,
  Building2,
} from "lucide-react";
import { GlassCard, StatCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/use-api";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-muted/40",
        className
      )}
    />
  );
}

function StatSkeleton() {
  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-9 w-9 rounded-lg" />
      </div>
      <div>
        <SkeletonBlock className="h-8 w-16 mb-2" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
    </GlassCard>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <SkeletonBlock className="h-7 w-7 rounded-lg flex-shrink-0" />
          <SkeletonBlock className="h-4 w-28" />
          <SkeletonBlock className="h-4 w-16 ml-auto" />
          <SkeletonBlock className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();
  const router = useRouter();

  return (
    <div className="space-y-6 w-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Pano</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Hoş geldiniz — son 30 günlük özet
        </p>
      </motion.div>

      {/* ── Stat Kartları ── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {isLoading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <motion.div variants={item}>
              <StatCard
                title="Toplam Personel"
                value={stats?.totalPersonnel ?? 0}
                subtitle={`${stats?.activePersonnel ?? 0} aktif`}
                icon={Users}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Tamamlanan Test"
                value={stats?.completedSessions ?? 0}
                subtitle={`%${(stats?.completionRate ?? 0).toLocaleString("tr-TR")} tamamlanma`}
                icon={ClipboardCheck}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Ortalama Potansiyel"
                value={stats?.avgScore?.toFixed(1) ?? "—"}
                subtitle="genel ortalama"
                icon={TrendingUp}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                title="Bekleyen Test"
                value={(stats?.pendingSessions ?? 0) + (stats?.inProgressSessions ?? 0)}
                subtitle={`${stats?.inProgressSessions ?? 0} devam ediyor`}
                icon={Clock}
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── Alt İçerik ── */}
      <motion.div
        className="grid grid-cols-1 xl:grid-cols-3 gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Son Testler (2/3 genişlik) */}
        <motion.div variants={item} className="xl:col-span-2">
          <GlassCard hover={false} className="h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  Son Tamamlanan Testler
                </h2>
              </div>
              <Link
                href="/assessments"
                className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-4"
              >
                Tümünü gör
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {isLoading ? (
              <TableSkeleton />
            ) : !stats?.recentSessions?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Activity className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Henüz tamamlanan test yok</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                        Personel
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                        Departman
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                        Skor
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3">
                        Tarih
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {stats.recentSessions.map((s) => {
                      const name = `${s.personnel.firstName} ${s.personnel.lastName}`;
                      const initials = `${s.personnel.firstName[0]}${s.personnel.lastName[0]}`;
                      const score = s.avgScore;
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-primary">
                                  {initials}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-muted-foreground">
                              {s.department?.name ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {score != null ? (
                              <>
                                <span
                                  className={cn(
                                    "text-sm font-bold tabular-nums",
                                    score >= 8
                                      ? "text-accent-green"
                                      : score >= 6
                                        ? "text-accent-orange"
                                        : "text-accent-red"
                                  )}
                                >
                                  {score.toFixed(1)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  /10
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className="text-xs text-muted-foreground">
                              {format(
                                new Date(s.completedAt),
                                "dd MMM yyyy, HH:mm",
                                { locale: tr }
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* En Yüksek Potansiyel (1/3) */}
        <motion.div variants={item}>
          <GlassCard hover={false} className="h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                <BrainCircuit className="h-4 w-4 text-accent-purple" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                En Yüksek Potansiyel
              </h2>
            </div>

            {isLoading ? (
              <TableSkeleton rows={3} />
            ) : !stats?.topPerformers?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BrainCircuit className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Henüz veri yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.topPerformers.map((p, idx) => (
                  <div
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/personnel/${p.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") router.push(`/personnel/${p.id}`);
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">
                        #{idx + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {p.position}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          p.avgScore >= 9
                            ? "text-accent-green"
                            : "text-primary"
                        )}
                      >
                        {p.avgScore.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">/10</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/analytics"
              className="w-full mt-4 flex items-center justify-center gap-1.5 text-xs text-primary hover:underline underline-offset-4"
            >
              Tüm analizleri gör
              <ArrowRight className="h-3 w-3" />
            </Link>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* ── Departman Dağılımı ── */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <GlassCard hover={false}>
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                Departman Dağılımı
              </h2>
            </div>

            {isLoading ? (
              <TableSkeleton rows={4} />
            ) : !stats?.byDepartment?.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Building2 className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Departman verisi yok</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/30">
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                        Departman
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                        Personel
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                        Tamamlanan Test
                      </th>
                      <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3">
                        Ort. Skor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {stats.byDepartment.map((d) => (
                      <tr
                        key={d.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <span className="text-sm font-medium text-foreground">
                            {d.name}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {d.personnelCount}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <span className="text-sm tabular-nums text-muted-foreground">
                            {d.completedTests}
                          </span>
                        </td>
                        <td className="py-3">
                          {d.avgScore != null ? (
                            <span
                              className={cn(
                                "text-sm font-bold tabular-nums",
                                d.avgScore >= 8
                                  ? "text-accent-green"
                                  : d.avgScore >= 6
                                    ? "text-accent-orange"
                                    : "text-accent-red"
                              )}
                            >
                              {d.avgScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
