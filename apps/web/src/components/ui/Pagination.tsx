"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@ph/ui";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-1 py-2",
        className,
      )}
    >
      <span className="text-[13px] text-muted-foreground tabular-nums">
        {total === 0 ? "Sonuç bulunamadı" : `${start}–${end} / ${total} sonuç`}
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
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
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="bz-icon-btn bz-icon-btn--sm disabled:pointer-events-none disabled:opacity-40"
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
