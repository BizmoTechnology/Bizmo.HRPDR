"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, Plus, Radar } from "lucide-react";
import { useReviewCycles, type ReviewCycleStatus } from "@/hooks/use-reviews";
import { usePermissions } from "@/lib/roles";
import { CycleStatusBadge, FREQUENCY_LABEL, formatDate, percent } from "@/components/performance/shared";

const TABS: Array<{ label: string; value?: ReviewCycleStatus }> = [
  { label: "Tümü" },
  { label: "Devam eden", value: "ACTIVE" },
  { label: "Taslak", value: "DRAFT" },
  { label: "Kapanan", value: "CLOSED" },
];

export default function ReviewCyclesPage() {
  const router = useRouter();
  const { canManage } = usePermissions();
  const [status, setStatus] = useState<ReviewCycleStatus | undefined>();
  const { data, isLoading, isError, refetch } = useReviewCycles(status);
  const cycles = data ?? [];

  return (
    <div className="w-full">
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">360° dönemleri</h1>
          <p className="bz-page-header__sub">
            Yönetici, eş düzey, ast ve öz değerlendirmeyle dönemsel geri bildirim toplayın.
          </p>
        </div>
        {canManage && (
          <div className="bz-page-header__actions">
            <Link href="/performance/cycles/new" className="bz-btn bz-btn--primary">
              <Plus />
              Yeni dönem
            </Link>
          </div>
        )}
      </motion.div>

      <div className="space-y-4">
        <div className="bz-tabs bz-tabs--pill max-w-full self-start" role="tablist" aria-label="Duruma göre süz">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              role="tab"
              aria-selected={status === t.value}
              className="bz-tab"
              onClick={() => setStatus(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="bz-card space-y-3 p-5" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bz-skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="bz-card">
            <div className="bz-empty" role="alert">
              <span className="bz-icon-box text-danger">
                <AlertCircle />
              </span>
              <p className="bz-empty__title">Dönemler yüklenemedi</p>
              <button type="button" className="bz-btn bz-btn--soft mt-2" onClick={() => void refetch()}>
                Tekrar dene
              </button>
            </div>
          </div>
        ) : cycles.length === 0 ? (
          <div className="bz-card">
            <div className="bz-empty">
              <span className="bz-icon-box">
                <Radar />
              </span>
              <p className="bz-empty__title">{status ? "Bu durumda dönem yok" : "Henüz 360° dönemi yok"}</p>
              <p className="bz-empty__text">
                {canManage
                  ? "Yeni bir dönem oluşturun; değerlendiriciler org şemasından önerilir."
                  : "İK bir dönem başlattığında burada görünür."}
              </p>
            </div>
          </div>
        ) : (
          <div className="bz-table-wrap">
            <table className="bz-table">
              <thead>
                <tr>
                  <th scope="col">Dönem</th>
                  <th scope="col">Durum</th>
                  <th scope="col" className="is-num hidden sm:table-cell">
                    Kişi
                  </th>
                  <th scope="col" className="hidden md:table-cell">
                    İlerleme
                  </th>
                  <th scope="col" className="hidden lg:table-cell">
                    Son gün
                  </th>
                </tr>
              </thead>
              <tbody>
                {cycles.map((c) => {
                  const pct = percent(c.assignmentStats.completed, c.assignmentStats.total);
                  const go = () => router.push(`/performance/cycles/${c.id}`);
                  return (
                    <tr
                      key={c.id}
                      tabIndex={0}
                      onClick={go}
                      onKeyDown={(e) => e.key === "Enter" && go()}
                      className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    >
                      <td className="max-w-[220px] whitespace-normal py-2.5 sm:max-w-[420px]">
                        <p className="truncate font-semibold text-foreground">{c.name}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {FREQUENCY_LABEL[c.frequency]} · {c.questionSet.name}
                        </p>
                      </td>
                      <td>
                        <CycleStatusBadge status={c.status} />
                      </td>
                      <td className="is-num hidden sm:table-cell">{c.subjectCount}</td>
                      <td className="hidden min-w-[160px] md:table-cell">
                        <div className="flex items-center gap-2">
                          <div
                            className="bz-progress flex-1"
                            role="progressbar"
                            aria-valuenow={pct}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Tamamlanan değerlendirme"
                          >
                            <span style={{ "--value": `${pct}%` } as React.CSSProperties} />
                          </div>
                          <span className="w-20 text-right text-xs tabular-nums text-fg2">
                            {c.assignmentStats.completed} / {c.assignmentStats.total}
                          </span>
                        </div>
                      </td>
                      <td className="hidden text-fg2 lg:table-cell">{formatDate(c.dueAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
