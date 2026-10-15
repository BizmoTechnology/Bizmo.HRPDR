"use client";

import type { ReactNode } from "react";
import { cn } from "@ph/ui";

export interface Column<T = unknown> {
  key: string;
  label: string;
  render?: (value: unknown, row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <div className="bz-skeleton h-4 w-3/4" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Veri bulunamadı",
  onRowClick,
  className,
}: DataTableProps<T>) {
  // Bizmo veri tablosu (DESIGN.md §26): yapışkan 40px başlık, 40px satır, yalnız satır çizgisi
  return (
    <div className={cn("bz-table-wrap", className)}>
      <table className="bz-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))}

          {!isLoading && data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}

          {!isLoading &&
            data.map((row, idx) => (
              <tr
                key={(row["id"] as string) ?? idx}
                onClick={() => onRowClick?.(row)}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render
                      ? col.render(row[col.key], row)
                      : (row[col.key] as ReactNode) ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
