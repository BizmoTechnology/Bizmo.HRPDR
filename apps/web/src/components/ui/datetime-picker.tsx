"use client";

import * as React from "react";
import { format } from "date-fns";
import { tr as trLocale } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  parseDatetimeLocalString,
  timePartFromDatetimeLocal,
  toDatetimeLocalString,
} from "@/lib/datetime-local";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DateTimePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  error?: boolean;
}

export function DateTimePicker({
  value = "",
  onChange,
  placeholder = "Tarih ve saat seçin",
  disabled,
  id,
  className,
  error,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(
    () => parseDatetimeLocalString(value),
    [value],
  );

  const timeValue = React.useMemo(
    () => timePartFromDatetimeLocal(value),
    [value],
  );

  const label = React.useMemo(() => {
    if (!selectedDate) return null;
    return format(selectedDate, "d MMMM yyyy HH:mm", { locale: trLocale });
  }, [selectedDate]);

  const onSelectDay = (day: Date | undefined) => {
    if (!day) {
      onChange("");
      return;
    }
    const prev = parseDatetimeLocalString(value);
    const h = prev?.getHours() ?? 0;
    const m = prev?.getMinutes() ?? 0;
    const merged = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      h,
      m,
      0,
      0,
    );
    onChange(toDatetimeLocalString(merged));
  };

  // Saat ve dakika ayrı seçilir: tarayıcının yerel saat alanı kullanılmaz (DESIGN.md §11, §19.2)
  const [hourPart = "00", minutePart = "00"] = (timeValue || "00:00").split(":");
  const minuteOptions = React.useMemo(() => {
    const steps = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
    return steps.includes(minutePart) ? steps : [...steps, minutePart].sort();
  }, [minutePart]);

  const onTimeChange = (hh: number, mm: number) => {
    const base =
      parseDatetimeLocalString(value) ??
      new Date(new Date().setHours(0, 0, 0, 0));
    const merged = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      Number.isFinite(hh) ? hh : 0,
      Number.isFinite(mm) ? mm : 0,
      0,
      0,
    );
    onChange(toDatetimeLocalString(merged));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          // Bizmo tarih tetiği (.bz-picker): yüzey + kenar + çok hafif gölge, köşe 10, solda takvim ikonu
          className={cn(
            "h-[42px] w-full justify-start gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm font-normal shadow-sm hover:bg-card hover:border-border-strong active:scale-100 data-[state=open]:border-ring data-[state=open]:shadow-[0_0_0_3px_var(--bz-accent-soft)]",
            !label && "text-muted-foreground",
            error && "border-danger shadow-[0_0_0_3px_var(--bz-danger-soft)]",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          {label ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={onSelectDay}
          autoFocus
          defaultMonth={selectedDate ?? new Date()}
        />
        <div className="flex items-center gap-2 border-t border-divider p-3">
          <Clock className="size-4 shrink-0 text-muted-foreground" />
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            Saat
          </span>
          <select
            aria-label="Saat"
            value={hourPart}
            onChange={(e) => onTimeChange(Number(e.target.value), Number(minutePart))}
            className="bz-field bz-field--sm w-[72px] tabular-nums"
          >
            {Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <span className="text-sm font-semibold text-muted-foreground">:</span>
          <select
            aria-label="Dakika"
            value={minutePart}
            onChange={(e) => onTimeChange(Number(hourPart), Number(e.target.value))}
            className="bz-field bz-field--sm w-[72px] tabular-nums"
          >
            {minuteOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
