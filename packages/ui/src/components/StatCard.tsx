"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { GlassCard } from "./GlassCard";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  className?: string;
}

const DELTA_CLASS = {
  positive: "bz-stat__delta bz-stat__delta--up",
  negative: "bz-stat__delta bz-stat__delta--down",
  neutral: "bz-stat__delta bz-stat__delta--flat",
} as const;

const DELTA_MARK = { positive: "▲", negative: "▼", neutral: "■" } as const;

/** KPI kartı (DESIGN.md §18): etiket → değer (Manrope 28/800, tabular) → değişim (ok + metin + dönem) */
export const StatCard = ({
  title,
  value,
  subtitle,
  change,
  changeType = "neutral",
  icon: Icon,
  className,
}: StatCardProps) => (
  <GlassCard className={cn("flex flex-col gap-3", className)}>
    <div className="flex items-start justify-between gap-3">
      <span className="text-[13px] font-semibold text-fg2">{title}</span>
      <span className="bz-icon-box" aria-hidden="true">
        <Icon />
      </span>
    </div>
    <div>
      <p className="bz-stat__value tabular-nums text-foreground">{value}</p>
      {(change || subtitle) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {change && (
            <span className={DELTA_CLASS[changeType]}>
              <span aria-hidden="true" className="text-[0.75em]">
                {DELTA_MARK[changeType]}
              </span>
              {change}
            </span>
          )}
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      )}
    </div>
  </GlassCard>
);
