"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Play,
  Pencil,
  Trash2,
  UserPlus,
  X,
  Loader2,
  Users,
  Search,
  Eye,
  FileQuestion,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard, PortalModal } from "@ph/ui";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { toDatetimeLocalString } from "@/lib/datetime-local";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Pagination } from "@/components/ui/Pagination";
import {
  useAssessment,
  useDeleteAssessment,
  useActivateAssessment,
  useAssignAssessment,
  useAssessmentSessions,
  usePersonnelList,
  useUpdateAssessment,
} from "@/hooks/use-api";

const SessionDetailPanel = dynamic(
  () =>
    import("./session-detail-panel").then((mod) => mod.SessionDetailPanel),
  { ssr: false },
);

/**
 * Durum → Bizmo süreç durumu rozeti (DESIGN.md §13 `.bz-status`).
 * `status` boşsa nötr rozet (arşiv: süreç dışı, sessiz).
 */
const STATUS_BADGE: Record<string, { label: string; status?: string }> = {
  DRAFT: { label: "Taslak", status: "draft" },
  ACTIVE: { label: "Aktif", status: "progress" },
  PAUSED: { label: "Duraklatıldı", status: "pending" },
  COMPLETED: { label: "Tamamlandı", status: "done" },
  ARCHIVED: { label: "Arşiv" },
};

const SESSION_STATUS: Record<string, { label: string; status: string }> = {
  NOT_STARTED: { label: "Başlamadı", status: "pending" },
  IN_PROGRESS: { label: "Devam ediyor", status: "progress" },
  PAUSED: { label: "Duraklatıldı", status: "pending" },
  COMPLETED: { label: "Tamamlandı", status: "done" },
  EXPIRED: { label: "Süresi doldu", status: "cancelled" },
};

/** Bizmo pencere yüzeyi (DESIGN.md §16): cam, 26 köşe, gölge 3 — framer-motion dönüşümüyle uyumlu */
const DIALOG_PANEL =
  "relative z-modal flex w-full flex-col overflow-hidden rounded-3xl border border-glass-border bg-popover shadow-3 backdrop-blur-xl";

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

const editSchema = z
  .object({
    title: z.string().min(2, "Başlık en az 2 karakter").max(200),
    description: z.string().max(2000).optional(),
    status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  })
  .refine(
    (d) => {
      if (d.startsAt && d.endsAt)
        return new Date(d.endsAt) > new Date(d.startsAt);
      return true;
    },
    { message: "Bitiş tarihi başlangıçtan sonra olmalı", path: ["endsAt"] },
  );

type EditFormValues = z.infer<typeof editSchema>;

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const { data: assessment, isLoading } = useAssessment(id);

  const deleteMutation = useDeleteAssessment();
  const activateMutation = useActivateAssessment();
  const assignMutation = useAssignAssessment();
  const updateMutation = useUpdateAssessment();

  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string[]>([]);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [sessionPage, setSessionPage] = useState(1);

  const { data: sessionsData, isLoading: sessionsLoading } =
    useAssessmentSessions(id, { page: sessionPage, pageSize: 10 });
  const sessions = sessionsData?.items ?? [];
  const sessionsMeta = {
    total: sessionsData?.total ?? 0,
    page: sessionsData?.page ?? 1,
    pageSize: sessionsData?.pageSize ?? 10,
  };

  const { data: personnelData } = usePersonnelList({
    search: personnelSearch || undefined,
    pageSize: 50,
  });
  const personnelList = personnelData?.items ?? [];

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Değerlendirme silindi");
      setDeleteOpen(false);
      router.push("/assessments");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Silme işlemi başarısız"));
    }
  };

  const handleActivate = async () => {
    try {
      await activateMutation.mutateAsync(id);
      toast.success("Değerlendirme aktifleştirildi");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Aktifleştirme başarısız"));
    }
  };

  const handleAssign = async () => {
    if (selectedPersonnel.length === 0) return;
    try {
      const result = (await assignMutation.mutateAsync({
        id,
        data: { personnelIds: selectedPersonnel },
      })) as { createdCount?: number; skippedCount?: number } | undefined;
      const created = result?.createdCount ?? selectedPersonnel.length;
      const skipped = result?.skippedCount ?? 0;
      toast.success(
        skipped > 0
          ? `${created} personel atandı, ${skipped} personel zaten atanmıştı`
          : `${created} personel atandı`,
      );
      setAssignOpen(false);
      setSelectedPersonnel([]);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Atama başarısız"));
    }
  };

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEditForm,
    control: editControl,
    formState: { errors: editErrors },
  } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "DRAFT",
      startsAt: "",
      endsAt: "",
    },
  });

  useEffect(() => {
    if (searchParams.get("edit") === "true") {
      setEditOpen(true);
      router.replace(`/assessments/${id}`, { scroll: false });
    }
  }, [searchParams, router, id]);

  useEffect(() => {
    if (!assessment || !editOpen) return;
    resetEditForm({
      title: assessment.title,
      description: assessment.description ?? "",
      status: assessment.status as EditFormValues["status"],
      startsAt: assessment.startsAt
        ? toDatetimeLocalString(new Date(assessment.startsAt))
        : "",
      endsAt: assessment.endsAt
        ? toDatetimeLocalString(new Date(assessment.endsAt))
        : "",
    });
  }, [assessment, editOpen, resetEditForm]);

  const onEditSave = async (values: EditFormValues) => {
    try {
      await updateMutation.mutateAsync({
        id,
        data: {
          title: values.title,
          // Boş bırakılan alanlar temizlenir (null)
          description: values.description?.trim() || null,
          status: values.status,
          startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : null,
          endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
        },
      });
      toast.success("Değerlendirme güncellendi");
      setEditOpen(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Güncelleme başarısız"));
    }
  };

  const togglePersonnel = (pid: string) => {
    setSelectedPersonnel((prev) =>
      prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid],
    );
  };

  if (isLoading) {
    return (
      <div className="w-full space-y-6" aria-busy="true">
        <div className="bz-skeleton h-8 w-64" />
        <div className="bz-skeleton h-32 rounded-2xl" />
        <div className="bz-skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="bz-empty py-24">
        <span className="bz-icon-box">
          <FileQuestion />
        </span>
        <p className="bz-empty__title">Değerlendirme bulunamadı</p>
        <p className="bz-empty__text">
          Kayıt silinmiş ya da bağlantı hatalı olabilir.
        </p>
        <button
          type="button"
          onClick={() => router.push("/assessments")}
          className="bz-btn bz-btn--soft"
        >
          Listeye dön
        </button>
      </div>
    );
  }

  const badge = STATUS_BADGE[assessment.status] ?? STATUS_BADGE.DRAFT!;
  const isDraft = assessment.status === "DRAFT";

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          onClick={() => router.push("/assessments")}
          className="bz-btn bz-btn--subtle bz-btn--sm mb-4"
        >
          <ArrowLeft />
          Değerlendirmeler
        </button>

        <div className="bz-page-header mb-0">
          <div className="bz-page-header__text">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="bz-page-header__title">{assessment.title}</h1>
              <span
                className="bz-status"
                data-status={badge.status}
                data-size="lg"
              >
                {badge.label}
              </span>
            </div>
          </div>

          <div className="bz-page-header__actions">
            {isDraft && (
              <button
                type="button"
                onClick={handleActivate}
                disabled={activateMutation.isPending}
                className="bz-btn bz-btn--primary"
              >
                {activateMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                Aktifleştir
              </button>
            )}
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              className={cn("bz-btn", !isDraft && "bz-btn--primary")}
            >
              <UserPlus />
              Personel ata
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="bz-btn"
            >
              <Pencil />
              Düzenle
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleteMutation.isPending}
              className="bz-icon-btn text-danger-ink hover:bg-danger-soft hover:text-danger-ink"
              aria-label="Değerlendirmeyi sil"
              title="Değerlendirmeyi sil"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Info */}
      <GlassCard hover={false}>
        <dl className="bz-desc-list">
          <div>
            <dt>Soru seti</dt>
            <dd>{assessment.questionSet?.name ?? "—"}</dd>
          </div>
          <div>
            <dt>Başlangıç</dt>
            <dd className="tabular-nums">{formatDate(assessment.startsAt)}</dd>
          </div>
          <div>
            <dt>Bitiş</dt>
            <dd className="tabular-nums">{formatDate(assessment.endsAt)}</dd>
          </div>
          <div>
            <dt>Oluşturulma</dt>
            <dd className="tabular-nums">{formatDate(assessment.createdAt)}</dd>
          </div>
        </dl>
        {assessment.description && (
          <p className="mt-4 border-t border-divider pt-4 text-sm text-fg2">
            {assessment.description}
          </p>
        )}
      </GlassCard>

      {/* Sessions */}
      <section aria-labelledby="sessions-title">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="sessions-title" className="text-[17px] font-bold text-foreground">
            Oturumlar
          </h2>
          <span className="bz-badge bz-badge--neutral">{sessionsMeta.total}</span>
        </div>

        {sessionsLoading ? (
          <div className="bz-card space-y-3 p-5" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bz-skeleton h-11 rounded-xl" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="bz-card">
            <div className="bz-empty">
              <span className="bz-icon-box">
                <Users />
              </span>
              <p className="bz-empty__title">Henüz oturum bulunmuyor</p>
              <p className="bz-empty__text">
                Personel atayarak oturumları başlatın.
              </p>
              <button
                type="button"
                onClick={() => setAssignOpen(true)}
                className="bz-btn bz-btn--soft"
              >
                <UserPlus />
                Personel ata
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="bz-table-wrap">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th scope="col">Personel</th>
                    <th scope="col">Durum</th>
                    <th scope="col" className="is-num hidden md:table-cell">
                      Puan
                    </th>
                    <th scope="col" className="hidden lg:table-cell">
                      Başlangıç
                    </th>
                    <th scope="col" className="hidden lg:table-cell">
                      Bitiş
                    </th>
                    <th scope="col" className="w-24">
                      <span className="sr-only">Eylemler</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any) => {
                    const sBadge =
                      SESSION_STATUS[s.status] ?? SESSION_STATUS.NOT_STARTED!;
                    const scoreVals =
                      s.dimensionScores &&
                      typeof s.dimensionScores === "object"
                        ? Object.values(s.dimensionScores as Record<string, unknown>).filter(
                            (v): v is number => typeof v === "number",
                          )
                        : [];
                    const avgScore =
                      scoreVals.length > 0
                        ? scoreVals.reduce((a, b) => a + b, 0) /
                          scoreVals.length
                        : null;
                    return (
                      <tr
                        key={s.id}
                        className="cursor-pointer"
                        aria-selected={selectedSessionId === s.id || undefined}
                        onClick={() => setSelectedSessionId(s.id)}
                      >
                        <td>
                          <div className="bz-cell-user">
                            <span className="bz-avatar bz-avatar--sm" aria-hidden="true">
                              {(
                                (s.personnel?.firstName?.[0] ?? "") +
                                (s.personnel?.lastName?.[0] ?? "")
                              ).toLocaleUpperCase("tr-TR")}
                            </span>
                            <span className="truncate font-semibold text-foreground">
                              {s.personnel?.firstName} {s.personnel?.lastName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="bz-status" data-status={sBadge.status}>
                            {sBadge.label}
                          </span>
                        </td>
                        <td className="is-num hidden md:table-cell">
                          {avgScore !== null ? (
                            <span
                              className={cn(
                                "font-semibold",
                                avgScore >= 7
                                  ? "text-success-ink"
                                  : avgScore >= 4
                                    ? "text-warning-ink"
                                    : "text-danger-ink",
                              )}
                            >
                              {avgScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="is-muted">—</span>
                          )}
                        </td>
                        <td className="hidden tabular-nums text-fg2 lg:table-cell">
                          {s.startedAt ? (
                            formatDate(s.startedAt)
                          ) : (
                            <span className="is-muted">—</span>
                          )}
                        </td>
                        <td className="hidden tabular-nums text-fg2 lg:table-cell">
                          {s.completedAt ? (
                            formatDate(s.completedAt)
                          ) : (
                            <span className="is-muted">—</span>
                          )}
                        </td>
                        <td>
                          <div className="bz-cell-actions">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSessionId(s.id);
                              }}
                              className="bz-btn bz-btn--ghost bz-btn--sm"
                            >
                              <Eye />
                              Detay
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              className="mt-2"
              page={sessionPage}
              pageSize={sessionsMeta.pageSize}
              total={sessionsMeta.total}
              onPageChange={setSessionPage}
            />
          </>
        )}
      </section>

      {/* Personel ata — viewport ortasında (body portal) */}
      <AnimatePresence>
        {assignOpen && (
          <PortalModal key="assign">
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                className="bz-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAssignOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-dialog-title"
                aria-describedby="assign-dialog-desc"
                className={cn(DIALOG_PANEL, "max-h-[86vh] max-w-[480px]")}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
                  <div>
                    <h3
                      id="assign-dialog-title"
                      className="font-display text-[19px] font-bold leading-snug text-foreground"
                    >
                      Personel ata
                    </h3>
                    <p id="assign-dialog-desc" className="mt-1 text-[13px] text-fg2">
                      Bu değerlendirmeye katılacak personeli seçin.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAssignOpen(false)}
                    className="bz-icon-btn bz-icon-btn--sm -mr-2"
                    aria-label="Kapat"
                    title="Kapat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="shrink-0 px-6 pb-2">
                  <div className="bz-input-group">
                    <span className="bz-input-prefix">
                      <Search className="h-4 w-4" />
                    </span>
                    <input
                      type="search"
                      placeholder="Personel ara"
                      aria-label="Personel ara"
                      value={personnelSearch}
                      onChange={(e) => setPersonnelSearch(e.target.value)}
                      className="bz-field bz-field--sm"
                    />
                  </div>
                  <p className="mt-2 h-4 text-xs text-muted-foreground" aria-live="polite">
                    {selectedPersonnel.length > 0 && (
                      <>
                        <b>{selectedPersonnel.length}</b> personel seçildi
                      </>
                    )}
                  </p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
                  {personnelList.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Personel bulunamadı
                    </p>
                  ) : (
                    <ul className="space-y-0.5">
                      {personnelList.map((p: {
                        id: string;
                        firstName: string;
                        lastName: string;
                        position: string;
                        department?: { name?: string } | null;
                      }) => {
                        const selected = selectedPersonnel.includes(p.id);
                        return (
                          <li key={p.id}>
                            <label
                              className={cn(
                                "bz-check flex min-h-[52px] w-full rounded-xl px-3 py-2 transition-colors",
                                selected ? "bg-brand-soft" : "hover:bg-hover",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => togglePersonnel(p.id)}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold text-foreground">
                                  {p.firstName} {p.lastName}
                                </span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {p.position} · {p.department?.name ?? "—"}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t border-divider px-6 py-3.5">
                  <button
                    type="button"
                    onClick={() => setAssignOpen(false)}
                    className="bz-btn"
                  >
                    İptal
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAssign()}
                    disabled={
                      selectedPersonnel.length === 0 || assignMutation.isPending
                    }
                    className="bz-btn bz-btn--primary"
                  >
                    {assignMutation.isPending && (
                      <Loader2 className="animate-spin" />
                    )}
                    Ata ({selectedPersonnel.length})
                  </button>
                </div>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Oturum detay paneli */}
      <AnimatePresence>
        {selectedSessionId && (
          <PortalModal key="session-detail">
            <SessionDetailPanel
              sessionId={selectedSessionId}
              onClose={() => setSelectedSessionId(null)}
            />
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Değerlendirmeyi sil — yıkıcı onay (DESIGN.md §16) */}
      <AnimatePresence>
        {deleteOpen && (
          <PortalModal key="delete">
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                className="bz-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-dialog-title"
                aria-describedby="delete-dialog-desc"
                className={cn(DIALOG_PANEL, "max-w-[400px]")}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-6 pb-5 pt-5">
                  <h3
                    id="delete-dialog-title"
                    className="font-display text-[19px] font-bold leading-snug text-foreground"
                  >
                    Değerlendirme silinsin mi?
                  </h3>
                  <p id="delete-dialog-desc" className="mt-1 text-[13px] text-fg2">
                    <b>{assessment.title}</b> kalıcı olarak silinir. Bu işlem
                    geri alınamaz.
                  </p>
                </div>
                <div className="flex justify-end gap-2 border-t border-divider px-6 py-3.5">
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(false)}
                    className="bz-btn"
                    autoFocus
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleteMutation.isPending}
                    className="bz-btn bz-btn--danger-solid"
                  >
                    {deleteMutation.isPending && (
                      <Loader2 className="animate-spin" />
                    )}
                    Sil
                  </button>
                </div>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Değerlendirmeyi düzenle */}
      <AnimatePresence>
        {editOpen && assessment && (
          <PortalModal key="edit">
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                className="bz-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-dialog-title"
                className={cn(DIALOG_PANEL, "max-h-[90vh] max-w-[520px]")}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-3 pt-5">
                  <h3
                    id="edit-dialog-title"
                    className="font-display text-[19px] font-bold leading-snug text-foreground"
                  >
                    Değerlendirmeyi düzenle
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="bz-icon-btn bz-icon-btn--sm -mr-2"
                    aria-label="Kapat"
                    title="Kapat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form
                  className="flex min-h-0 flex-1 flex-col"
                  onSubmit={handleEditSubmit(onEditSave)}
                >
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5 pt-1">
                    <div className="bz-form-row">
                      <label className="bz-label" htmlFor="edit-title">
                        Başlık <span className="bz-req">*</span>
                      </label>
                      <input
                        id="edit-title"
                        {...registerEdit("title")}
                        className="bz-field"
                        aria-invalid={editErrors.title ? true : undefined}
                        aria-describedby={editErrors.title ? "edit-title-error" : undefined}
                      />
                      {editErrors.title && (
                        <p id="edit-title-error" className="bz-error-text">
                          {editErrors.title.message}
                        </p>
                      )}
                    </div>

                    <div className="bz-form-row">
                      <label className="bz-label" htmlFor="edit-description">
                        Açıklama
                      </label>
                      <textarea
                        id="edit-description"
                        {...registerEdit("description")}
                        rows={3}
                        className="bz-field"
                      />
                    </div>

                    <div className="bz-form-row">
                      <label className="bz-label" htmlFor="edit-status">
                        Durum
                      </label>
                      <select
                        id="edit-status"
                        {...registerEdit("status")}
                        className="bz-field"
                      >
                        <option value="DRAFT">Taslak</option>
                        <option value="ACTIVE">Aktif</option>
                        <option value="PAUSED">Duraklatıldı</option>
                        <option value="COMPLETED">Tamamlandı</option>
                        <option value="ARCHIVED">Arşiv</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="bz-form-row">
                        <label className="bz-label" htmlFor="edit-starts-at">
                          Başlangıç
                        </label>
                        <Controller
                          name="startsAt"
                          control={editControl}
                          render={({ field }) => (
                            <DateTimePicker
                              id="edit-starts-at"
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Başlangıç seçin"
                            />
                          )}
                        />
                      </div>
                      <div className="bz-form-row">
                        <label className="bz-label" htmlFor="edit-ends-at">
                          Bitiş
                        </label>
                        <Controller
                          name="endsAt"
                          control={editControl}
                          render={({ field }) => (
                            <DateTimePicker
                              id="edit-ends-at"
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Bitiş seçin"
                              error={Boolean(editErrors.endsAt)}
                            />
                          )}
                        />
                        {editErrors.endsAt && (
                          <p className="bz-error-text">{editErrors.endsAt.message}</p>
                        )}
                      </div>
                    </div>

                    <p className="bz-callout">
                      Soru seti bu ekrandan değiştirilemez; gerekirse yeni bir
                      değerlendirme oluşturun.
                    </p>
                  </div>

                  <div className="flex shrink-0 justify-end gap-2 border-t border-divider px-6 py-3.5">
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      className="bz-btn"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="bz-btn bz-btn--primary"
                    >
                      {updateMutation.isPending && (
                        <Loader2 className="animate-spin" />
                      )}
                      Değişiklikleri kaydet
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>
    </div>
  );
}
