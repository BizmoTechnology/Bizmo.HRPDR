"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CareerPlanStatus,
  CareerStepStatus,
  CareerStepType,
  Readiness,
} from "@/hooks/use-career-plans";

export const STEP_TYPE_LABEL: Record<CareerStepType, string> = {
  TRAINING: "Eğitim",
  MENTORING: "Mentorluk",
  PROJECT: "Proje",
  ROLE: "Rol değişikliği",
  OTHER: "Diğer",
};

export const STEP_TYPE_OPTIONS = (Object.keys(STEP_TYPE_LABEL) as CareerStepType[]).map((value) => ({
  value,
  label: STEP_TYPE_LABEL[value],
}));

export const STEP_STATUS_LABEL: Record<CareerStepStatus, string> = {
  TODO: "Yapılacak",
  IN_PROGRESS: "Sürüyor",
  DONE: "Tamamlandı",
};

/** Plan durumu → süreç rozeti (.bz-status, DESIGN.md §13): şekil + sözcük */
export const PLAN_STATUS: Record<CareerPlanStatus, { label: string; status: string }> = {
  DRAFT: { label: "Taslak", status: "draft" },
  APPROVED: { label: "Onaylandı", status: "approved" },
  ARCHIVED: { label: "Arşivlendi", status: "cancelled" },
};

export const READINESS: Record<Readiness, { label: string; tone: string }> = {
  READY: { label: "Terfiye hazır", tone: "bz-chip--success" },
  DEVELOPING: { label: "Gelişiyor", tone: "bz-chip--warning" },
  NOT_READY: { label: "Henüz hazır değil", tone: "" },
};

export const HORIZON_OPTIONS = [6, 12, 18, 24, 36];

/** Adım durumu → .bz-vstep[data-state] */
export function stepState(status: CareerStepStatus): "done" | "current" | undefined {
  if (status === "DONE") return "done";
  if (status === "IN_PROGRESS") return "current";
  return undefined;
}

export function StepMarker({ status, index }: { status: CareerStepStatus; index: number }) {
  return (
    <span className="bz-vstep__marker" aria-hidden="true">
      {status === "DONE" ? <Check /> : index + 1}
    </span>
  );
}

export function PlanStatusBadge({ status }: { status: CareerPlanStatus }) {
  const s = PLAN_STATUS[status];
  return (
    <span className="bz-status" data-status={s.status}>
      {s.label}
    </span>
  );
}

/** Adım durumu seçimi: segment kontrolü (DESIGN.md §12, aria-pressed) */
export function StepStatusToggle({
  value,
  onChange,
  label,
  disabled,
  className,
}: {
  value: CareerStepStatus;
  onChange: (status: CareerStepStatus) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("bz-segmented w-full sm:w-auto", className)}>
      {(Object.keys(STEP_STATUS_LABEL) as CareerStepStatus[]).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          disabled={disabled}
          onClick={() => value !== s && onChange(s)}
          className="min-w-0 flex-1 justify-center whitespace-nowrap !px-1.5 text-[12px] sm:flex-none sm:!px-3 sm:text-[13px]"
        >
          {STEP_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export function newStepId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
