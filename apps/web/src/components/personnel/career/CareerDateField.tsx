"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** "2027-02-01" → yerel gün (saat dilimi kaymasız) */
export function parseIsoDay(value: string | null): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function toIsoDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function formatIsoDay(value: string | null, pattern = "d MMM yyyy"): string | null {
  const d = parseIsoDay(value);
  return d ? format(d, pattern, { locale: tr }) : null;
}

/**
 * Yalnız tarih seçici (DESIGN.md §19.2: yerel tarih alanı yerine tetik + açılır takvim).
 * Değer YYYY-AA-GG ya da null.
 */
export function CareerDateField({
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Ekran okuyucu adı, ör. "1. adımın hedef tarihi" */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIsoDay(value), [value]);
  const text = formatIsoDay(value);

  return (
    <div className={cn("relative flex min-w-0 items-center", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={text ? `${label}: ${text}` : `${label}: seçilmedi`}
            className={cn(
              "bz-picker h-9 w-full min-w-0 justify-start gap-2 text-[13px]",
              !text && "text-muted-foreground",
              value && "pr-8",
            )}
          >
            <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{text ?? "Hedef tarih"}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => {
              onChange(d ? toIsoDay(d) : null);
              setOpen(false);
            }}
            autoFocus
            defaultMonth={selected ?? new Date()}
          />
        </PopoverContent>
      </Popover>
      {value && !disabled && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`${label}: tarihi temizle`}
          title="Tarihi temizle"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
