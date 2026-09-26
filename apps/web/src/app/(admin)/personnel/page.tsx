"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  UserX,
} from "lucide-react";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import {
  usePersonnelList,
  useDepartmentList,
  type PersonnelListParams,
} from "@/hooks/use-api";

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  ACTIVE: {
    label: "Aktif",
    class: "text-accent-green bg-accent-green/10",
  },
  INACTIVE: {
    label: "Pasif",
    class: "text-accent-red bg-accent-red/10",
  },
  ON_LEAVE: {
    label: "İzinli",
    class: "text-accent-orange bg-accent-orange/10",
  },
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-muted/40", className)} />
  );
}

function TableRowSkeleton() {
  return (
    <tr>
      <td className="py-3 pr-4"><SkeletonBlock className="h-4 w-16" /></td>
      <td className="py-3 pr-4"><SkeletonBlock className="h-4 w-32" /></td>
      <td className="py-3 pr-4"><SkeletonBlock className="h-4 w-40" /></td>
      <td className="py-3 pr-4"><SkeletonBlock className="h-4 w-24" /></td>
      <td className="py-3 pr-4"><SkeletonBlock className="h-4 w-20" /></td>
      <td className="py-3 pr-4"><SkeletonBlock className="h-5 w-14 rounded-full" /></td>
      <td className="py-3"><SkeletonBlock className="h-4 w-8" /></td>
    </tr>
  );
}

export default function PersonnelPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const params: PersonnelListParams = useMemo(
    () => ({
      page: Number(searchParams.get("page")) || 1,
      pageSize: 20,
      search: searchParams.get("search") || undefined,
      status: searchParams.get("status") || undefined,
      departmentId: searchParams.get("departmentId") || undefined,
    }),
    [searchParams]
  );

  const { data, isLoading } = usePersonnelList(params);
  const { data: departments } = useDepartmentList();

  const updateFilter = useCallback(
    (key: string, value: string) => {
      // Gecikmeli arama çağrısı eski bir render'dan gelebilir; güncel URL'den okunur
      // (aksi halde arada değiştirilen departman/durum filtresi geri alınır)
      const sp = new URLSearchParams(window.location.search);
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      if (key !== "page") sp.delete("page");
      router.replace(`/personnel?${sp.toString()}`);
    },
    [router]
  );
  const hasActiveFilters = !!(params.search || params.status || params.departmentId);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const currentPage = data?.page ?? 1;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Personel Yönetimi
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data ? `${data.total} personel kayıtlı` : "Yükleniyor..."}
          </p>
        </div>
        <Link
          href="/personnel/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Yeni Personel
        </Link>
      </motion.div>

      {/* Filters */}
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <GlassCard className="flex flex-col md:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ad, soyad veya sicil no ile ara..."
                defaultValue={params.search ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (searchDebounceRef.current) {
                    clearTimeout(searchDebounceRef.current);
                  }
                  searchDebounceRef.current = setTimeout(() => {
                    updateFilter("search", v);
                    searchDebounceRef.current = null;
                  }, 400);
                }}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted/40 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Department filter */}
            <select
              value={params.departmentId ?? ""}
              onChange={(e) => updateFilter("departmentId", e.target.value)}
              className="h-10 px-3 rounded-xl bg-muted/40 border border-border/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
            >
              <option value="">Tüm Departmanlar</option>
              {departments?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            {/* Status filter */}
            <select
              value={params.status ?? ""}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="h-10 px-3 rounded-xl bg-muted/40 border border-border/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[140px]"
            >
              <option value="">Tüm Durumlar</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Pasif</option>
              <option value="ON_LEAVE">İzinli</option>
            </select>
          </GlassCard>
        </motion.div>
      </motion.div>

      {/* Table */}
      <motion.div variants={container} initial="hidden" animate="show">
        <motion.div variants={item}>
          <GlassCard hover={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Sicil No
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Ad Soyad
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      E-posta
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Pozisyon
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Departman
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Durum
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3">
                      Deneyim
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRowSkeleton key={i} />
                    ))
                  ) : !data?.items?.length ? (
                    <tr>
                      <td colSpan={7} className="py-16">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <UserX className="h-10 w-10 mb-3 opacity-40" />
                          <p className="text-sm font-medium">
                            {hasActiveFilters
                              ? "Filtrelerle eşleşen personel bulunamadı"
                              : "Henüz personel eklenmemiş"}
                          </p>
                          <p className="text-xs mt-1">
                            {hasActiveFilters
                              ? "Arama veya filtreleri değiştirmeyi deneyin"
                              : "Yeni personel eklemek için yukarıdaki butonu kullanın"}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.items.map((p) => {
                      const statusInfo = STATUS_LABELS[p.status] ?? {
                        label: p.status,
                        class: "text-muted-foreground bg-muted",
                      };
                      return (
                        <tr
                          key={p.id}
                          onClick={() => router.push(`/personnel/${p.id}`)}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                        >
                          <td className="py-3 pr-4">
                            <span className="text-sm font-mono text-muted-foreground">
                              {p.employeeId}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-primary">
                                  {p.firstName[0]}
                                  {p.lastName[0]}
                                </span>
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {p.firstName} {p.lastName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-muted-foreground">
                              {p.email}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-muted-foreground">
                              {p.position}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="text-sm text-muted-foreground">
                              {p.department?.name ?? "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={cn(
                                "text-xs font-semibold px-2 py-1 rounded-full",
                                statusInfo.class
                              )}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className="text-sm tabular-nums text-muted-foreground">
                              {p.experienceYear} yıl
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/20">
                <p className="text-xs text-muted-foreground">
                  Sayfa {currentPage} / {totalPages} — Toplam {data?.total}{" "}
                  kayıt
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage <= 1}
                    onClick={() =>
                      updateFilter("page", String(currentPage - 1))
                    }
                    className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={currentPage >= totalPages}
                    onClick={() =>
                      updateFilter("page", String(currentPage + 1))
                    }
                    className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </div>
  );
}
