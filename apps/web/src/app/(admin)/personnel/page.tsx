"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Search, UserX, SearchX } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import {
  usePersonnelList,
  useDepartmentList,
  type PersonnelListParams,
} from "@/hooks/use-api";

/** Personel durumu → Bizmo çipi (DESIGN.md §13). Pasif bir hata değildir: nötr çip. */
const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Aktif", tone: "bz-chip--success" },
  INACTIVE: { label: "Pasif", tone: "" },
  ON_LEAVE: { label: "İzinli", tone: "bz-chip--warning" },
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

function TableRowSkeleton() {
  return (
    <tr>
      <td><div className="bz-skeleton h-3.5 w-20" /></td>
      <td>
        <div className="bz-cell-user">
          <div className="bz-skeleton h-6 w-6 rounded-md" />
          <div className="bz-skeleton h-3.5 w-32" />
        </div>
      </td>
      <td><div className="bz-skeleton h-3.5 w-44" /></td>
      <td><div className="bz-skeleton h-3.5 w-28" /></td>
      <td><div className="bz-skeleton h-3.5 w-24" /></td>
      <td><div className="bz-skeleton h-[22px] w-14 rounded-full" /></td>
      <td className="is-num"><div className="bz-skeleton ml-auto h-3.5 w-10" /></td>
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
      const sp = new URLSearchParams(searchParams.toString());
      if (value) {
        sp.set(key, value);
      } else {
        sp.delete(key);
      }
      if (key !== "page") sp.delete("page");
      router.push(`/personnel?${sp.toString()}`);
    },
    [router, searchParams]
  );

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const currentPage = data?.page ?? 1;
  const hasFilters = !!(params.search || params.status || params.departmentId);
  const isEmpty = !isLoading && !data?.items?.length;

  return (
    <div className="w-full space-y-4">
      {/* Başlık */}
      <motion.div
        className="bz-page-header mb-2"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Personel yönetimi</h1>
          <p className="bz-page-header__sub tabular-nums">
            {data ? `${data.total} personel kayıtlı` : "Yükleniyor..."}
          </p>
        </div>
        <div className="bz-page-header__actions">
          <Link href="/personnel/new" className="bz-btn bz-btn--primary">
            <Plus />
            Yeni personel
          </Link>
        </div>
      </motion.div>

      <motion.div
        className="space-y-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Araç çubuğu: arama + süzgeçler (DESIGN.md §26.3) */}
        <motion.div
          variants={item}
          className="bz-toolbar grid grid-cols-2 md:flex"
          role="search"
        >
          <div className="bz-input-group col-span-2 md:max-w-[380px] md:flex-1">
            <span className="bz-input-prefix">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              aria-label="Personel ara"
              placeholder="Ad, soyad veya sicil no ile ara"
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
              className="bz-field bz-field--sm"
            />
          </div>

          <select
            aria-label="Departman"
            value={params.departmentId ?? ""}
            onChange={(e) => updateFilter("departmentId", e.target.value)}
            className="bz-field bz-field--sm min-w-0 md:w-[200px]"
          >
            <option value="">Tüm departmanlar</option>
            {departments?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Durum"
            value={params.status ?? ""}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="bz-field bz-field--sm min-w-0 md:w-[160px]"
          >
            <option value="">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Pasif</option>
            <option value="ON_LEAVE">İzinli</option>
          </select>
        </motion.div>

        {/* Liste */}
        <motion.div variants={item}>
          {isEmpty ? (
            <div className="bz-card">
              {hasFilters ? (
                <div className="bz-empty">
                  <SearchX className="h-8 w-8 text-fg3" aria-hidden="true" />
                  <p className="bz-empty__title">Eşleşen personel yok</p>
                  <p className="bz-empty__text">
                    Arama veya süzgeçlerle eşleşen bir kayıt bulunamadı.
                    Süzgeçleri temizleyip tekrar deneyin.
                  </p>
                  <button
                    type="button"
                    className="bz-btn bz-btn--soft"
                    onClick={() => router.push("/personnel")}
                  >
                    Süzgeçleri temizle
                  </button>
                </div>
              ) : (
                <div className="bz-empty">
                  <UserX className="h-8 w-8 text-fg3" aria-hidden="true" />
                  <p className="bz-empty__title">Henüz personel eklenmemiş</p>
                  <p className="bz-empty__text">
                    Eklediğiniz personel burada listelenir.
                  </p>
                  <Link href="/personnel/new" className="bz-btn bz-btn--soft">
                    <Plus />
                    Personel ekle
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Telefon: kart üzerinde liste satırları (DESIGN.md §26.1) */}
              <ul className="bz-card bz-list p-1.5 md:hidden" aria-busy={isLoading || undefined}>
                {isLoading || !data
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <li key={i} className="bz-list-item border-b-0 px-2.5">
                        <div className="bz-skeleton h-8 w-8 rounded-[10px]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="bz-skeleton h-3.5 w-32" />
                          <div className="bz-skeleton h-3 w-44" />
                        </div>
                      </li>
                    ))
                  : data.items.map((p) => {
                      const statusInfo = STATUS_LABELS[p.status] ?? {
                        label: p.status,
                        tone: "",
                      };
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/personnel/${p.id}`}
                            className="bz-list-item bz-list-item--interactive"
                          >
                            <span className="bz-avatar" aria-hidden="true">
                              {p.firstName[0]}
                              {p.lastName[0]}
                            </span>
                            <span className="bz-list-item__main">
                              <span className="bz-list-item__title block text-foreground">
                                {p.firstName} {p.lastName}
                              </span>
                              <span className="bz-list-item__sub block">
                                {p.position} · {p.department?.name ?? "—"}
                              </span>
                            </span>
                            <span className="bz-list-item__end">
                              <span className={`bz-chip ${statusInfo.tone}`}>
                                {statusInfo.label}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
              </ul>

              {/* Masaüstü: tablo */}
              <div className="bz-table-wrap hidden md:block">
                <table className="bz-table">
                  <thead>
                    <tr>
                      <th>Sicil no</th>
                      <th>Ad soyad</th>
                      <th>E-posta</th>
                      <th>Pozisyon</th>
                      <th>Departman</th>
                      <th>Durum</th>
                      <th className="is-num">Deneyim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading || !data
                      ? Array.from({ length: 8 }).map((_, i) => (
                          <TableRowSkeleton key={i} />
                        ))
                      : data.items.map((p) => {
                          const statusInfo = STATUS_LABELS[p.status] ?? {
                            label: p.status,
                            tone: "",
                          };
                          return (
                            <tr
                              key={p.id}
                              onClick={() => router.push(`/personnel/${p.id}`)}
                              className="cursor-pointer"
                            >
                              <td className="font-mono text-[12.5px] text-fg2 tabular-nums">
                                {p.employeeId}
                              </td>
                              <td>
                                <div className="bz-cell-user">
                                  <span
                                    className="bz-avatar bz-avatar--sm"
                                    aria-hidden="true"
                                  >
                                    {p.firstName[0]}
                                    {p.lastName[0]}
                                  </span>
                                  <Link
                                    href={`/personnel/${p.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="truncate font-semibold text-foreground hover:underline focus-visible:underline"
                                  >
                                    {p.firstName} {p.lastName}
                                  </Link>
                                </div>
                              </td>
                              <td className="text-fg2">{p.email}</td>
                              <td>{p.position}</td>
                              <td className={p.department ? undefined : "is-muted"}>
                                {p.department?.name ?? "—"}
                              </td>
                              <td>
                                <span className={`bz-chip ${statusInfo.tone}`}>
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="is-num">
                                {p.experienceYear}{" "}
                                <span className="text-fg3">yıl</span>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Sayfalama */}
          {totalPages > 1 && data && (
            <Pagination
              className="mt-2"
              page={currentPage}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(p) => updateFilter("page", String(p))}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
