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
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import { useDeleteReport, useReportList, type ReportRow } from "@/hooks/use-api";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  READY: { label: "Hazır", className: "bg-accent-green/10 text-accent-green" },
  GENERATING: { label: "Hazırlanıyor", className: "bg-amber-500/10 text-amber-500" },
  FAILED: { label: "Başarısız", className: "bg-destructive/10 text-destructive" },
};

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function scoreClass(score: number) {
  if (score >= 8) return "text-accent-green";
  if (score >= 6) return "text-amber-500";
  return "text-destructive";
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
      <GlassCard hover={false}>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Raporlara erişim yetkiniz yok</p>
          <p className="text-xs text-muted-foreground mt-1">
            Rapor görüntüleme ve indirme için Analist veya üzeri rol gerekir.
          </p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Raporlar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tamamlanan değerlendirmeler için oluşturulan potansiyel raporları
          </p>
        </div>
      </motion.div>

      <GlassCard hover={false} className="!p-3 md:!p-4">
        <div className="relative sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Personel adı, sicil no veya değerlendirme ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/50 border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>
      </GlassCard>

      <GlassCard hover={false}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : isError ? (
          <div className="py-16 text-center text-sm text-destructive">
            {apiErrorMessage(error, "Raporlar yüklenemedi")}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {search ? "Aramanızla eşleşen rapor yok" : "Henüz rapor oluşturulmamış"}
            </p>
            {!search && (
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                Değerlendirme detayında tamamlanmış bir oturumu açıp İK onayından sonra
                &ldquo;Rapor oluştur&rdquo; ile rapor üretebilirsiniz.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Personel
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden md:table-cell">
                      Değerlendirme
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Genel Skor
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden sm:table-cell">
                      Durum
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden lg:table-cell">
                      Oluşturulma
                    </th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {reports.map((r) => {
                    const badge = STATUS_BADGE[r.status] ?? {
                      label: r.status,
                      className: "bg-muted text-muted-foreground",
                    };
                    return (
                      <tr
                        key={r.id}
                        onClick={() => router.push(`/reports/${r.id}`)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 pr-4">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                            {r.personnel.firstName} {r.personnel.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.personnel.employeeId}
                            {r.personnel.department?.name ? ` · ${r.personnel.department.name}` : ""}
                          </p>
                        </td>
                        <td className="py-3.5 pr-4 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground">
                            {r.session?.assessment?.title ?? "—"}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4">
                          {typeof r.overallScore === "number" ? (
                            <span className={cn("text-sm font-bold tabular-nums", scoreClass(r.overallScore))}>
                              {r.overallScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-3.5 pr-4 hidden sm:table-cell">
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(r.generatedAt ?? r.createdAt)}
                          </span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, r)}
                            disabled={deleteMutation.isPending}
                            title="Raporu sil"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                          >
                            {deleteMutation.isPending && deleteMutation.variables === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border/20 mt-4">
                <p className="text-xs text-muted-foreground">Toplam {total} rapor</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs tabular-nums text-muted-foreground px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}
