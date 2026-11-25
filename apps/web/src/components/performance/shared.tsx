import type {
  ReviewAssignmentStatus,
  ReviewCycleStatus,
  ReviewFrequency,
} from "@/hooks/use-reviews";

export const FREQUENCY_LABEL: Record<ReviewFrequency, string> = {
  ANNUAL: "Yıllık",
  SEMI_ANNUAL: "6 aylık",
  QUARTERLY: "Çeyreklik",
  ADHOC: "Tek seferlik",
};

const CYCLE_STATUS: Record<ReviewCycleStatus, { label: string; status: string }> = {
  DRAFT: { label: "Taslak", status: "draft" },
  ACTIVE: { label: "Devam ediyor", status: "progress" },
  CLOSED: { label: "Kapandı", status: "done" },
};

const ASSIGNMENT_STATUS: Record<ReviewAssignmentStatus, { label: string; status: string }> = {
  NOT_STARTED: { label: "Başlamadı", status: "draft" },
  IN_PROGRESS: { label: "Devam ediyor", status: "progress" },
  COMPLETED: { label: "Tamamlandı", status: "done" },
  DECLINED: { label: "Reddetti", status: "cancelled" },
};

export function CycleStatusBadge({ status }: { status: ReviewCycleStatus }) {
  const s = CYCLE_STATUS[status];
  return (
    <span className="bz-status" data-status={s.status}>
      {s.label}
    </span>
  );
}

export function AssignmentStatusBadge({ status }: { status: ReviewAssignmentStatus }) {
  const s = ASSIGNMENT_STATUS[status];
  return (
    <span className="bz-status" data-status={s.status}>
      {s.label}
    </span>
  );
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime && { hour: "2-digit", minute: "2-digit" }),
  }).format(new Date(value));
}

export function personName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toLocaleUpperCase("tr");
}

export function percent(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function formatScore(v: number | null | undefined) {
  return typeof v === "number" ? v.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—";
}
