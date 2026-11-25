"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle,
  Archive,
  Calendar as CalendarIcon,
  Loader2,
  RotateCcw,
  UserMinus,
  X,
} from "lucide-react";
import { PortalModal } from "@ph/ui";
import {
  TERMINATION_REASONS,
  TERMINATION_REASON_LABELS,
  terminatePersonnelSchema,
  type TerminationReason,
} from "@ph/shared";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReactivatePersonnel, useTerminatePersonnel } from "@/hooks/use-personnel-history";

/* ─── Ortak pencere çerçevesi (DESIGN.md §16) ─── */

export function DialogFrame({
  role = "dialog",
  labelledBy,
  describedBy,
  onClose,
  children,
  as = "div",
  onSubmit,
}: {
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  children: ReactNode;
  as?: "div" | "form";
  onSubmit?: (e: React.FormEvent) => void;
}) {
  const Comp = as === "form" ? motion.form : motion.div;
  return (
    <PortalModal>
      <motion.div
        className="bz-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed inset-0 z-modal flex items-center justify-center p-3">
        <Comp
          role={role}
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          onSubmit={onSubmit}
          noValidate={as === "form" ? true : undefined}
          className="pointer-events-auto relative max-h-[calc(100dvh-24px)] w-full max-w-[520px] overflow-y-auto rounded-3xl border border-glass-border bg-popover p-6 shadow-3 backdrop-blur-xl"
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.2 }}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") onClose();
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="bz-icon-btn bz-icon-btn--sm absolute right-4 top-4"
            aria-label="Kapat"
            title="Kapat"
          >
            <X />
          </button>
          {children}
        </Comp>
      </div>
    </PortalModal>
  );
}

/* ─── Yalnız tarih seçici (saat yok): "YYYY-MM-DD" ─── */

function toDateOnly(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateOnly(v: string): Date | undefined {
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  error,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  min?: Date;
  max?: Date;
  error?: boolean;
  describedBy?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDateOnly(value);
  const disabled = [
    ...(min ? [{ before: min }] : []),
    ...(max ? [{ after: max }] : []),
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-describedby={describedBy}
          aria-invalid={error || undefined}
          className={cn(
            "h-[42px] w-full justify-start gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm font-normal shadow-sm hover:border-border-strong hover:bg-card active:scale-100 data-[state=open]:border-ring data-[state=open]:shadow-[0_0_0_3px_var(--bz-accent-soft)]",
            !selected && "text-muted-foreground",
            error && "border-danger shadow-[0_0_0_3px_var(--bz-danger-soft)]",
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          {selected ? format(selected, "d MMMM yyyy", { locale: tr }) : "Tarih seçin"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(toDateOnly(d));
            setOpen(false);
          }}
          disabled={disabled}
          autoFocus
          defaultMonth={selected ?? new Date()}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ─── İşten çıkar ─── */

export function TerminateDialog({
  personnelId,
  fullName,
  hireDate,
  openSessionCount,
  onClose,
}: {
  personnelId: string;
  fullName: string;
  hireDate: string | null;
  /** Kapanacak (EXPIRED olacak) açık HR/PDR oturumu sayısı */
  openSessionCount: number;
  onClose: () => void;
}) {
  const uid = useId();
  const terminate = useTerminatePersonnel();
  const [date, setDate] = useState(() => toDateOnly(new Date()));
  const [reason, setReason] = useState<TerminationReason | "">("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Partial<Record<"date" | "reason" | "note", string>>>({});

  const minDate = useMemo(() => (hireDate ? new Date(hireDate) : undefined), [hireDate]);
  const today = useMemo(() => new Date(), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = terminatePersonnelSchema.safeParse({ date, reason, note });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    try {
      const res = await terminate.mutateAsync({ id: personnelId, data: parsed.data });
      toast.success(
        res.expiredSessions > 0
          ? `${fullName} işten çıkarıldı · ${res.expiredSessions} açık test kapatıldı`
          : `${fullName} işten çıkarıldı`,
      );
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Personel işten çıkarılamadı"));
    }
  };

  return (
    <DialogFrame
      as="form"
      onSubmit={submit}
      labelledBy={`${uid}-title`}
      describedBy={`${uid}-desc`}
      onClose={onClose}
    >
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-danger-soft text-danger-ink">
          <UserMinus className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id={`${uid}-title`}
            className="font-display text-[19px] font-bold leading-snug text-foreground"
          >
            İşten çıkar
          </h2>
          <p id={`${uid}-desc`} className="mt-1 text-[13px] leading-relaxed text-fg2">
            <strong>{fullName}</strong> “Ayrılanlar” listesine taşınır. Portal erişimi hemen
            kapanır
            {openSessionCount > 0 && (
              <>
                , açık <strong className="tabular-nums">{openSessionCount}</strong> test süresi
                dolmuş sayılır
              </>
            )}
            . Tamamlanmış testler, analizler ve raporlar korunur; kayıt salt okunur olur.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="bz-form-row">
          <label htmlFor={`${uid}-date`} className="bz-label">
            Ayrılış tarihi <span className="bz-req">*</span>
          </label>
          <DatePicker
            id={`${uid}-date`}
            value={date}
            onChange={(v) => {
              setDate(v);
              setErrors((e) => ({ ...e, date: undefined }));
            }}
            min={minDate}
            max={today}
            error={!!errors.date}
            describedBy={errors.date ? `${uid}-date-err` : undefined}
          />
          {errors.date && (
            <span id={`${uid}-date-err`} className="bz-error-text">
              {errors.date}
            </span>
          )}
        </div>

        <div className="bz-form-row">
          <label htmlFor={`${uid}-reason`} className="bz-label">
            Ayrılış nedeni <span className="bz-req">*</span>
          </label>
          <select
            id={`${uid}-reason`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value as TerminationReason | "");
              setErrors((prev) => ({ ...prev, reason: undefined }));
            }}
            aria-invalid={!!errors.reason || undefined}
            aria-describedby={errors.reason ? `${uid}-reason-err` : undefined}
            className="bz-field"
          >
            <option value="">Neden seçin</option>
            {TERMINATION_REASONS.map((r) => (
              <option key={r} value={r}>
                {TERMINATION_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          {errors.reason && (
            <span id={`${uid}-reason-err`} className="bz-error-text">
              {errors.reason}
            </span>
          )}
        </div>

        <div className="bz-form-row">
          <label htmlFor={`${uid}-note`} className="bz-label">
            Not
          </label>
          <textarea
            id={`${uid}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Devir teslim, çıkış görüşmesi gibi bilgiler (isteğe bağlı)"
            aria-describedby={`${uid}-note-hint`}
            className="bz-field min-h-[84px] py-2.5"
          />
          <span id={`${uid}-note-hint`} className="bz-hint">
            Not yalnız panel kullanıcılarına görünür; personelle paylaşılmaz.
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className="bz-btn">
          Vazgeç
        </button>
        <button
          type="submit"
          disabled={terminate.isPending}
          className="bz-btn bz-btn--danger-solid"
        >
          {terminate.isPending ? <Loader2 className="animate-spin" /> : <UserMinus />}
          {terminate.isPending ? "İşleniyor" : "İşten çıkar"}
        </button>
      </div>
    </DialogFrame>
  );
}

/* ─── Yeniden etkinleştir ─── */

export function ReactivateDialog({
  personnelId,
  fullName,
  onClose,
}: {
  personnelId: string;
  fullName: string;
  onClose: () => void;
}) {
  const uid = useId();
  const reactivate = useReactivatePersonnel();

  const confirm = async () => {
    try {
      await reactivate.mutateAsync(personnelId);
      toast.success(`${fullName} yeniden etkinleştirildi`);
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Personel yeniden etkinleştirilemedi"));
    }
  };

  return (
    <DialogFrame
      role="alertdialog"
      labelledBy={`${uid}-title`}
      describedBy={`${uid}-desc`}
      onClose={onClose}
    >
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <RotateCcw className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id={`${uid}-title`}
            className="font-display text-[19px] font-bold leading-snug text-foreground"
          >
            Yeniden etkinleştirilsin mi?
          </h2>
          <p id={`${uid}-desc`} className="mt-1 text-[13px] leading-relaxed text-fg2">
            <strong>{fullName}</strong> aktif personele döner ve portala yeniden giriş
            yapabilir. Ayrılış tarihi ve nedeni kayıttan silinir. Süresi dolmuş testler geri
            açılmaz; gerekirse yeni değerlendirme atayın.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus onClick={onClose} className="bz-btn">
          Vazgeç
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={reactivate.isPending}
          className="bz-btn bz-btn--primary"
        >
          {reactivate.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
          {reactivate.isPending ? "İşleniyor" : "Yeniden etkinleştir"}
        </button>
      </div>
    </DialogFrame>
  );
}

/* ─── Arşivle (soft delete) ─── */

export function ArchiveDialog({
  fullName,
  pending,
  onConfirm,
  onClose,
}: {
  fullName: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const uid = useId();
  return (
    <DialogFrame
      role="alertdialog"
      labelledBy={`${uid}-title`}
      describedBy={`${uid}-desc`}
      onClose={onClose}
    >
      <div className="flex items-start gap-3 pr-8">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-danger-soft text-danger-ink">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2
            id={`${uid}-title`}
            className="font-display text-[19px] font-bold leading-snug text-foreground"
          >
            Personel arşivlensin mi?
          </h2>
          <p id={`${uid}-desc`} className="mt-1 text-[13px] leading-relaxed text-fg2">
            <strong>{fullName}</strong> arşivlenir: personel listelerinden ve atamalardan
            kaldırılır, portal erişimi kapanır. Değerlendirme geçmişi ve raporlar silinmez;
            kayıt yöneticilerin “Arşiv” görünümünde kalır. İşten ayrılan biri için
            “İşten çıkar” eylemini kullanın.
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus onClick={onClose} className="bz-btn">
          Vazgeç
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className="bz-btn bz-btn--danger-solid"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Archive />}
          {pending ? "Arşivleniyor" : "Arşivle"}
        </button>
      </div>
    </DialogFrame>
  );
}
