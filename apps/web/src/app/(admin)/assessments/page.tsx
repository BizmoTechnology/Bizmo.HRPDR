"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, ClipboardList } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { useAssessmentList } from "@/hooks/use-api";

const STATUS_TABS = [
  { label: "Tümü", value: undefined },
  { label: "Taslak", value: "DRAFT" },
  { label: "Aktif", value: "ACTIVE" },
  { label: "Tamamlanan", value: "COMPLETED" },
  { label: "Arşiv", value: "ARCHIVED" },
] as const;

/**
 * Değerlendirme durumu → Bizmo süreç durumu rozeti (DESIGN.md §13 `.bz-status`).
 * `status` boşsa nötr rozet (arşiv: süreç dışı, sessiz).
 */
const STATUS_BADGE: Record<string, { label: string; status?: string }> = {
  DRAFT: { label: "Taslak", status: "draft" },
  ACTIVE: { label: "Aktif", status: "progress" },
  PAUSED: { label: "Duraklatıldı", status: "pending" },
  COMPLETED: { label: "Tamamlandı", status: "done" },
  ARCHIVED: { label: "Arşiv" },
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default function AssessmentsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useAssessmentList({
    status: statusFilter,
    search: search || undefined,
    page,
    pageSize: 20,
  });

  const assessments = data?.items ?? [];
  const meta = {
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? 20,
  };

  return (
    <div className="w-full">
      {/* Header */}
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Değerlendirmeler</h1>
          <p className="bz-page-header__sub">
            Tüm değerlendirmeleri yönetin ve takip edin
          </p>
        </div>
        <div className="bz-page-header__actions">
          <button
            type="button"
            onClick={() => router.push("/assessments/new")}
            className="bz-btn bz-btn--primary"
          >
            <Plus />
            Yeni değerlendirme
          </button>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            className="bz-tabs bz-tabs--pill max-w-full self-start"
            role="tablist"
            aria-label="Duruma göre süz"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={statusFilter === tab.value}
                className="bz-tab"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bz-input-group sm:ml-auto sm:w-72">
            <span className="bz-input-prefix">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="search"
              placeholder="Değerlendirme ara"
              aria-label="Değerlendirme ara"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="bz-field bz-field--sm"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="bz-card space-y-3 p-5" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bz-skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : assessments.length === 0 ? (
          <div className="bz-card">
            <div className="bz-empty">
              <span className="bz-icon-box">
                <ClipboardList />
              </span>
              <p className="bz-empty__title">
                {search || statusFilter
                  ? "Eşleşen değerlendirme yok"
                  : "Henüz değerlendirme bulunmuyor"}
              </p>
              <p className="bz-empty__text">
                {search || statusFilter
                  ? "Arama metnini veya durum süzgecini değiştirip tekrar deneyin."
                  : "Yeni bir değerlendirme oluşturarak başlayın."}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="bz-table-wrap">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th scope="col">Başlık</th>
                    <th scope="col" className="hidden md:table-cell">
                      Soru seti
                    </th>
                    <th scope="col">Durum</th>
                    <th scope="col" className="is-num hidden lg:table-cell">
                      Oturumlar
                    </th>
                    <th scope="col" className="hidden sm:table-cell">
                      Tarih aralığı
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a: any) => {
                    const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.DRAFT!;
                    const total = a.sessionStats?.total ?? 0;
                    const completed = a.sessionStats?.completed ?? 0;
                    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                    return (
                      <tr
                        key={a.id}
                        tabIndex={0}
                        onClick={() => router.push(`/assessments/${a.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") router.push(`/assessments/${a.id}`);
                        }}
                        className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      >
                        <td className="max-w-[200px] whitespace-normal py-2.5 sm:max-w-[420px]">
                          <p className="truncate font-semibold text-foreground">
                            {a.title}
                          </p>
                          {a.description && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {a.description}
                            </p>
                          )}
                        </td>
                        <td className="hidden text-fg2 md:table-cell">
                          {a.questionSet?.name ?? (
                            <span className="is-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className="bz-status" data-status={badge.status}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="is-num hidden lg:table-cell">
                          <div className="flex items-center justify-end gap-2.5">
                            <div
                              className="bz-progress bz-progress--data w-14"
                              role="progressbar"
                              aria-label="Tamamlanan oturum oranı"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <span style={{ "--value": `${pct}%` } as CSSProperties} />
                            </div>
                            <span className="min-w-[3.25rem] tabular-nums text-foreground">
                              {completed}/{total}
                            </span>
                          </div>
                        </td>
                        <td className="hidden tabular-nums text-fg2 sm:table-cell">
                          {a.startsAt || a.endsAt ? (
                            <>
                              {formatDate(a.startsAt)} – {formatDate(a.endsAt)}
                            </>
                          ) : (
                            <span className="is-muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              className="mt-2"
              page={page}
              pageSize={meta.pageSize}
              total={meta.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
