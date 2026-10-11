"use client";

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
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/** Skor bandı (0–10): durum tonu çipte; değer her zaman metin olarak yazılır */
function scoreBand(score: number) {
  if (score >= 8) return { tone: "bz-chip--success", label: "Yüksek" };
  if (score >= 6) return { tone: "bz-chip--warning", label: "Orta" };
  return { tone: "bz-chip--danger", label: "Düşük" };
}

function ScoreChip({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const band = scoreBand(score);
  return (
    <span
      // relative: içteki sr-only (absolute) metin tablonun kaydırma kabında kalsın, sayfayı yana taşırmasın
      className={cn("bz-chip relative tabular-nums", band.tone)}
      title={`${band.label} · ${score.toFixed(1)} / 10`}
    >
      {score.toFixed(1)}
      <span className="sr-only"> / 10, {band.label.toLowerCase()}</span>
    </span>
  );
}

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`;
}

function StatSkeleton() {
  return (
    <GlassCard className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="bz-skeleton h-4 w-28" />
        <div className="bz-skeleton h-[34px] w-[34px] rounded-[10px]" />
      </div>
      <div>
        <div className="bz-skeleton h-8 w-20" />
        <div className="bz-skeleton mt-2 h-3 w-24" />
      </div>
    </GlassCard>
  );
}

function RowsSkeleton({ rows = 5, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="px-5 pb-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex min-h-[52px] items-center gap-3 border-b border-divider last:border-b-0"
        >
          {avatar && <div className="bz-skeleton h-8 w-8 flex-none rounded-[10px]" />}
          <div className="bz-skeleton h-3.5 w-32" />
          <div className="bz-skeleton ml-auto h-3.5 w-20" />
          <div className="bz-skeleton h-5 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function CardHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 px-5 pb-3 pt-5">
      <span className="bz-icon-box" aria-hidden="true">
        <Icon />
      </span>
      <h2 className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-foreground">
        {title}
      </h2>
      {action}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <div className="w-full space-y-6">
      <motion.div
        className="bz-page-header mb-0"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Pano</h1>
          <p className="bz-page-header__sub">Hoş geldiniz — son 30 günlük özet</p>
        </div>
      </motion.div>

      {/* ── KPI kartları ── */}
      <motion.div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
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
                className="h-full"
                title="Toplam personel"
                value={stats?.totalPersonnel ?? 0}
                subtitle="bu ay"
                icon={Users}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                className="h-full"
                title="Tamamlanan test"
                value={stats?.completedSessions ?? 0}
                subtitle="bu ay"
                icon={ClipboardCheck}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                className="h-full"
                title="Ortalama potansiyel"
                value={stats?.avgScore?.toFixed(1) ?? "—"}
                subtitle="genel ortalama"
                icon={TrendingUp}
              />
            </motion.div>
            <motion.div variants={item}>
              <StatCard
                className="h-full"
                title="Bekleyen test"
                value={stats?.pendingSessions ?? 0}
                subtitle="atanmış, bekleniyor"
                icon={Clock}
              />
            </motion.div>
          </>
        )}
      </motion.div>

      {/* ── Alt içerik ── */}
      <motion.div
        className="grid grid-cols-1 gap-4 xl:grid-cols-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Son tamamlanan testler (2/3 genişlik) */}
        <motion.div variants={item} className="min-w-0 xl:col-span-2">
          <GlassCard hover={false} className="h-full overflow-hidden p-0">
            <CardHeader
              icon={Activity}
              title="Son tamamlanan testler"
              action={
                <button type="button" className="bz-btn bz-btn--ghost bz-btn--sm">
                  Tümünü gör
                  <ArrowRight />
                </button>
              }
            />

            {isLoading ? (
              <RowsSkeleton />
            ) : !stats?.recentSessions?.length ? (
              <div className="bz-empty">
                <Activity className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="bz-empty__title">Henüz tamamlanan test yok</p>
                <p className="bz-empty__text">
                  Personel bir değerlendirmeyi tamamladığında sonuç burada görünür.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="bz-table">
                  <thead>
                    <tr>
                      <th className="pl-5">Personel</th>
                      <th className="hidden sm:table-cell">Departman</th>
                      <th className="is-num">Skor</th>
                      <th className="is-num pr-5">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentSessions.map((s) => {
                      const name = `${s.personnel.firstName} ${s.personnel.lastName}`;
                      return (
                        <tr key={s.id} className="[&>td]:h-[52px]">
                          <td className="pl-5">
                            <div className="bz-cell-user">
                              <span className="bz-avatar" aria-hidden="true">
                                {initialsOf(s.personnel.firstName, s.personnel.lastName)}
                              </span>
                              <span className="truncate font-semibold text-foreground">
                                {name}
                              </span>
                            </div>
                          </td>
                          <td className="hidden text-fg2 sm:table-cell">
                            {s.department?.name ?? "—"}
                          </td>
                          <td className="is-num">
                            <ScoreChip score={s.avgScore} />
                          </td>
                          <td className="is-num pr-5 text-[13px] text-muted-foreground">
                            {format(new Date(s.completedAt), "dd MMM yyyy, HH:mm", {
                              locale: tr,
                            })}
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

        {/* En yüksek potansiyel (1/3) */}
        <motion.div variants={item} className="min-w-0">
          <GlassCard hover={false} className="flex h-full flex-col p-0">
            <CardHeader icon={BrainCircuit} title="En yüksek potansiyel" />

            <div className="flex-1 px-5">
              {isLoading ? (
                <div className="-mx-5">
                  <RowsSkeleton rows={4} />
                </div>
              ) : !stats?.topPerformers?.length ? (
                <div className="bz-empty">
                  <BrainCircuit className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                  <p className="bz-empty__title">Henüz veri yok</p>
                  <p className="bz-empty__text">
                    Skorlar tamamlanan testlerden hesaplanır.
                  </p>
                </div>
              ) : (
                <ol className="bz-list" aria-label="En yüksek potansiyel sıralaması">
                  {stats.topPerformers.map((p, idx) => (
                    <li key={p.id} className="bz-list-item">
                      <span
                        className="w-4 flex-none text-center text-[13px] font-semibold tabular-nums text-muted-foreground"
                        aria-hidden="true"
                      >
                        {idx + 1}
                      </span>
                      <span className="bz-avatar" aria-hidden="true">
                        {initialsOf(p.firstName, p.lastName)}
                      </span>
                      <div className="bz-list-item__main">
                        <p className="bz-list-item__title text-foreground">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="bz-list-item__sub">{p.position}</p>
                      </div>
                      <div className="bz-list-item__end">
                        <span className="bz-value text-[15px]">
                          {p.avgScore.toFixed(1)}
                          <span className="bz-value__unit">/10</span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="border-t border-divider px-5 py-3">
              <button type="button" className="bz-btn bz-btn--ghost bz-btn--sm bz-btn--block">
                Tüm analizleri gör
                <ArrowRight />
              </button>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* ── Departman dağılımı ── */}
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <GlassCard hover={false} className="overflow-hidden p-0">
            <CardHeader icon={Building2} title="Departman dağılımı" />

            {isLoading ? (
              <RowsSkeleton rows={4} avatar={false} />
            ) : !stats?.byDepartment?.length ? (
              <div className="bz-empty">
                <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
                <p className="bz-empty__title">Departman verisi yok</p>
                <p className="bz-empty__text">
                  Personel departmanlara atandığında dağılım burada görünür.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="bz-table">
                  <thead>
                    <tr>
                      <th className="pl-5">Departman</th>
                      <th className="is-num">Personel</th>
                      <th className="is-num">Tamamlanan test</th>
                      <th className="is-num pr-5">Ort. skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byDepartment.map((d) => (
                      <tr key={d.id}>
                        <td className="pl-5 font-semibold text-foreground">{d.name}</td>
                        <td className="is-num text-fg2">{d.personnelCount}</td>
                        <td className="is-num text-fg2">{d.completedTests}</td>
                        <td className="is-num pr-5">
                          <ScoreChip score={d.avgScore} />
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
