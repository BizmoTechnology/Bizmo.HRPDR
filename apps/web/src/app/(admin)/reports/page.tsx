"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Trash2,
  Loader2,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import { useDeleteReport, useReportList, type ReportRow } from "@/hooks/use-api";

/**
 * Rapor durumu → Bizmo süreç durumu rozeti (DESIGN.md §13 `.bz-status`): şekil + sözcük.
 * `status` boşsa nötr rozet (bilinmeyen durum).
 */
const STATUS_BADGE: Record<string, { label: string; status?: string }> = {
  READY: { label: "Hazır", status: "done" },
  GENERATING: { label: "Hazırlanıyor", status: "progress" },
  FAILED: { label: "Başarısız", status: "rejected" },
};

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/** Skor bandı (0–10; iyi ≥ 8 · orta ≥ 6 · zayıf): durum tonu çipte, değer her zaman metin olarak yazılır */
function scoreTone(score: number) {
  if (score >= 8) return "bz-chip--success";
  if (score >= 6) return "bz-chip--warning";
  return "bz-chip--danger";
}

function initialsOf(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toLocaleUpperCase("tr-TR");
}

export default function ReportsPage() {
  const router = useRouter();
  const { canAnalyze } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const deleteMutation = useDeleteReport();

  // Her tuş vuruşunda istek atmamak için kısa gecikme
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isError, error } = useReportList({
    search: search || undefined,
    page,
    pageSize: 20,
  });

  const reports = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 20;
  const totalPages = Math.ceil(total / pageSize) || 1;

  const handleDelete = async (e: React.MouseEvent, report: ReportRow) => {
    e.stopPropagation();
    if (
      !confirm(
        `${report.personnel.firstName} ${report.personnel.lastName} için oluşturulan rapor silinsin mi?`,
      )
    ) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(report.id);
      toast.success("Rapor silindi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Rapor silinemedi"));
    }
  };

  if (!canAnalyze) {
    return (
      <div className="bz-card">
        <div className="bz-empty">
          <span className="bz-icon-box" aria-hidden="true">
            <ShieldAlert />
          </span>
          <p className="bz-empty__title">Raporlara erişim yetkiniz yok</p>
          <p className="bz-empty__text">
            Rapor görüntüleme ve indirme için Analist veya üzeri rol gerekir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Başlık */}
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Raporlar</h1>
          <p className="bz-page-header__sub">
            Tamamlanan değerlendirmeler için oluşturulan potansiyel raporları
          </p>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* Araç çubuğu: arama (DESIGN.md §11 `.bz-input-group`) */}
        <div className="bz-toolbar" role="search">
          <div className="bz-input-group w-full sm:w-80">
            <span className="bz-input-prefix">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              aria-label="Personel adı, sicil no veya değerlendirme ara"
              placeholder="Personel adı, sicil no veya değerlendirme ara..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bz-field bz-field--sm"
            />
          </div>
        </div>

        {/* Liste */}
        {isLoading ? (
          <div className="bz-card space-y-3 p-5" aria-busy="true">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bz-skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="bz-alert bz-alert--danger">
            <AlertTriangle />
            <div className="min-w-0">
              <p className="bz-alert__title break-words">
                {apiErrorMessage(error, "Raporlar yüklenemedi")}
              </p>
            </div>
          </div>
        ) : reports.length === 0 ? (
          <div className="bz-card">
            <div className="bz-empty">
              <span className="bz-icon-box" aria-hidden="true">
                <FileText />
              </span>
              <p className="bz-empty__title">
                {search ? "Aramanızla eşleşen rapor yok" : "Henüz rapor oluşturulmamış"}
              </p>
              {!search && (
                <p className="bz-empty__text">
                  Değerlendirme detayında tamamlanmış bir oturumu açıp İK onayından sonra
                  &ldquo;Rapor oluştur&rdquo; ile rapor üretebilirsiniz.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="bz-table-wrap">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th scope="col">Personel</th>
                    <th scope="col" className="hidden md:table-cell">
                      Değerlendirme
                    </th>
                    <th scope="col" className="is-num">
                      Genel skor
                    </th>
                    <th scope="col" className="hidden sm:table-cell">
                      Durum
                    </th>
                    <th scope="col" className="hidden lg:table-cell">
                      Oluşturulma
                    </th>
                    <th scope="col" className="w-14">
                      <span className="sr-only">Eylemler</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => {
                    const badge = STATUS_BADGE[r.status] ?? { label: r.status };
                    const deleting =
                      deleteMutation.isPending && deleteMutation.variables === r.id;
                    return (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        onClick={() => router.push(`/reports/${r.id}`)}
                        onKeyDown={(e) => {
                          // Yalnız satırın kendisi odaktayken: içteki sil düğmesinde Enter satırı açmasın
                          if (e.key === "Enter" && e.target === e.currentTarget) {
                            router.push(`/reports/${r.id}`);
                          }
                        }}
                        className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      >
                        <td className="max-w-[220px] whitespace-normal py-2.5 sm:max-w-[360px]">
                          <div className="bz-cell-user">
                            <span className="bz-avatar bz-avatar--sm" aria-hidden="true">
                              {initialsOf(r.personnel.firstName, r.personnel.lastName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">
                                {r.personnel.firstName} {r.personnel.lastName}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {r.personnel.employeeId}
                                {r.personnel.department?.name
                                  ? ` · ${r.personnel.department.name}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden text-fg2 md:table-cell">
                          {r.session?.assessment?.title ?? <span className="is-muted">—</span>}
                        </td>
                        <td className="is-num">
                          {typeof r.overallScore === "number" ? (
                            <span
                              className={cn("bz-chip tabular-nums", scoreTone(r.overallScore))}
                            >
                              {r.overallScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="is-muted">—</span>
                          )}
                        </td>
                        <td className="hidden sm:table-cell">
                          <span className="bz-status" data-status={badge.status}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="hidden tabular-nums text-fg2 lg:table-cell">
                          {formatDate(r.generatedAt ?? r.createdAt)}
                        </td>
                        <td className="w-14">
                          <div className={cn("bz-cell-actions", deleting && "opacity-100")}>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, r)}
                              disabled={deleteMutation.isPending}
                              title="Raporu sil"
                              aria-label="Raporu sil"
                              className="bz-icon-btn bz-icon-btn--sm hover:bg-danger-soft hover:text-danger-ink disabled:pointer-events-none disabled:opacity-40"
                            >
                              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sayfalama (DESIGN.md §9.6; ortak Pagination bileşeniyle aynı görünüm) */}
            {totalPages > 1 && (
              <div className="mt-2 flex items-center justify-between gap-3 px-1 py-2">
                <span className="text-[13px] tabular-nums text-muted-foreground">
                  Toplam {total} rapor
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="bz-icon-btn bz-icon-btn--sm disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Önceki sayfa"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[3.5rem] text-center text-[13px] font-semibold tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="bz-icon-btn bz-icon-btn--sm disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Sonraki sayfa"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
