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
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Users,
  Search,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { GlassCard, PortalModal } from "@ph/ui";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { toDatetimeLocalString } from "@/lib/datetime-local";
import { DateTimePicker } from "@/components/ui/datetime-picker";
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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Taslak", className: "bg-muted text-muted-foreground" },
  ACTIVE: { label: "Aktif", className: "bg-accent-green/10 text-accent-green" },
  PAUSED: { label: "Duraklatıldı", className: "bg-amber-500/10 text-amber-500" },
  COMPLETED: { label: "Tamamlandı", className: "bg-sky-500/10 text-sky-500" },
  ARCHIVED: { label: "Arşiv", className: "bg-muted text-muted-foreground" },
};

const SESSION_STATUS: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "Başlamadı", className: "bg-muted text-muted-foreground" },
  IN_PROGRESS: { label: "Devam Ediyor", className: "bg-amber-500/10 text-amber-500" },
  PAUSED: { label: "Duraklatıldı", className: "bg-amber-500/10 text-amber-500" },
  COMPLETED: { label: "Tamamlandı", className: "bg-accent-green/10 text-accent-green" },
  EXPIRED: { label: "Süresi Doldu", className: "bg-destructive/10 text-destructive" },
};

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
  const sessionTotalPages =
    Math.ceil(sessionsMeta.total / sessionsMeta.pageSize) || 1;

  const { data: personnelData } = usePersonnelList({
    search: personnelSearch || undefined,
    pageSize: 50,
  });
  const personnelList = personnelData?.items ?? [];

  const handleDelete = async () => {
    if (!confirm("Bu değerlendirmeyi silmek istediğinizden emin misiniz?"))
      return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Değerlendirme silindi");
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
      <div className="space-y-6 w-full">
        <div className="h-8 w-48 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-40 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-64 bg-muted/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-sm text-muted-foreground">
          Değerlendirme bulunamadı
        </p>
        <button
          onClick={() => router.push("/assessments")}
          className="mt-3 text-sm text-primary hover:underline"
        >
          Listeye dön
        </button>
      </div>
    );
  }

  const badge = STATUS_BADGE[assessment.status] ?? STATUS_BADGE.DRAFT ?? { label: "Taslak", className: "bg-muted text-muted-foreground" };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={() => router.push("/assessments")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Değerlendirmeler
        </button>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
              {assessment.title}
            </h1>
            <span
              className={cn(
                "inline-flex px-2.5 py-0.5 rounded-md text-[11px] font-semibold",
                badge.className,
              )}
            >
              {badge.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {assessment.status === "DRAFT" && (
              <button
                onClick={handleActivate}
                disabled={activateMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent-green/10 text-accent-green text-sm font-medium hover:bg-accent-green/20 transition-colors disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Aktifleştir
              </button>
            )}
            <button
              onClick={() => setAssignOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Personel Ata
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Düzenle
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Sil
            </button>
          </div>
        </div>
      </motion.div>

      {/* Info */}
      <GlassCard hover={false}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Soru Seti
            </p>
            <p className="text-sm font-semibold text-foreground">
              {assessment.questionSet?.name ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Başlangıç
            </p>
            <p className="text-sm text-foreground">
              {formatDate(assessment.startsAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Bitiş
            </p>
            <p className="text-sm text-foreground">
              {formatDate(assessment.endsAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">
              Oluşturulma
            </p>
            <p className="text-sm text-foreground">
              {formatDate(assessment.createdAt)}
            </p>
          </div>
        </div>
        {assessment.description && (
          <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-border/20">
            {assessment.description}
          </p>
        )}
      </GlassCard>

      {/* Sessions */}
      <GlassCard hover={false}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">
              Oturumlar
            </h2>
            <span className="text-xs text-muted-foreground">
              ({sessionsMeta.total})
            </span>
          </div>
        </div>

        {sessionsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-muted/40 animate-pulse"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              Henüz oturum bulunmuyor
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Personel atayarak oturumları başlatın
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Personel
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Durum
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden md:table-cell">
                      Puan
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4 hidden lg:table-cell">
                      Başlangıç
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 hidden lg:table-cell">
                      Bitiş
                    </th>
                    <th className="pb-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {sessions.map((s: any) => {
                    const sBadge =
                      SESSION_STATUS[s.status] ?? SESSION_STATUS.NOT_STARTED ?? { label: "Bekliyor", className: "bg-muted text-muted-foreground" };
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
                        className="hover:bg-muted/30 transition-colors cursor-pointer"
                        onClick={() => setSelectedSessionId(s.id)}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[10px] font-bold text-primary">
                                {(
                                  (s.personnel?.firstName?.[0] ?? "") +
                                  (s.personnel?.lastName?.[0] ?? "")
                                ).toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {s.personnel?.firstName} {s.personnel?.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold",
                              sBadge.className,
                            )}
                          >
                            {sBadge.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 hidden md:table-cell">
                          {avgScore !== null ? (
                            <span
                              className={cn(
                                "text-sm font-bold tabular-nums",
                                avgScore >= 7
                                  ? "text-accent-green"
                                  : avgScore >= 4
                                    ? "text-amber-500"
                                    : "text-destructive",
                              )}
                            >
                              {avgScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(s.startedAt)}
                          </span>
                        </td>
                        <td className="py-3 hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(s.completedAt)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSessionId(s.id);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Eye className="h-3 w-3" />
                            Detay
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {sessionTotalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border/20 mt-4">
                <p className="text-xs text-muted-foreground">
                  Toplam {sessionsMeta.total} oturum
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setSessionPage((p) => Math.max(1, p - 1))
                    }
                    disabled={sessionPage <= 1}
                    className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs tabular-nums text-muted-foreground px-2">
                    {sessionPage} / {sessionTotalPages}
                  </span>
                  <button
                    onClick={() =>
                      setSessionPage((p) =>
                        Math.min(sessionTotalPages, p + 1),
                      )
                    }
                    disabled={sessionPage >= sessionTotalPages}
                    className="p-1.5 rounded-lg hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </GlassCard>

      {/* Personel ata — viewport ortasında (body portal) */}
      <AnimatePresence>
        {assignOpen && (
          <PortalModal key="assign">
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setAssignOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="assign-dialog-title"
                className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/50 bg-popover shadow-xl"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
                <h3 id="assign-dialog-title" className="text-base font-semibold text-foreground">
                  Personel Ata
                </h3>
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 pt-4 pb-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Personel ara..."
                    value={personnelSearch}
                    onChange={(e) => setPersonnelSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-muted/50 border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
                  />
                </div>
                {selectedPersonnel.length > 0 && (
                  <p className="text-xs text-primary mt-2">
                    {selectedPersonnel.length} personel seçildi
                  </p>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-2 space-y-1">
                {personnelList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Personel bulunamadı
                  </p>
                ) : (
                  personnelList.map((p: {
                    id: string;
                    firstName: string;
                    lastName: string;
                    position: string;
                    department?: { name?: string } | null;
                  }) => {
                    const selected = selectedPersonnel.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePersonnel(p.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors",
                          selected ? "bg-primary/10" : "hover:bg-muted/40",
                        )}
                      >
                        <div
                          className={cn(
                            "h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                            selected ? "border-primary bg-primary" : "border-border/60",
                          )}
                        >
                          {selected && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {p.firstName} {p.lastName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {p.position} · {p.department?.name ?? "—"}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end gap-2 px-5 py-4 border-t border-border/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handleAssign()}
                  disabled={
                    selectedPersonnel.length === 0 || assignMutation.isPending
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {assignMutation.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Ata ({selectedPersonnel.length})
                </button>
              </div>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Oturum Detay Paneli */}
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

      {/* Değerlendirme düzenle */}
      <AnimatePresence>
        {editOpen && assessment && (
          <PortalModal key="edit">
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
              <motion.div
                className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditOpen(false)}
              />
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-dialog-title"
                className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/50 bg-popover p-6 shadow-xl"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 id="edit-dialog-title" className="text-lg font-semibold text-foreground">
                    Değerlendirmeyi Düzenle
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <form
                  className="space-y-4"
                  onSubmit={handleEditSubmit(onEditSave)}
                >
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Başlık <span className="text-destructive">*</span>
                    </label>
                    <input
                      {...registerEdit("title")}
                      className={cn(
                        "w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30",
                        editErrors.title && "border-destructive/60",
                      )}
                    />
                    {editErrors.title && (
                      <p className="text-xs text-destructive mt-1">{editErrors.title.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Açıklama
                    </label>
                    <textarea
                      {...registerEdit("description")}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Durum
                    </label>
                    <select
                      {...registerEdit("status")}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="DRAFT">Taslak</option>
                      <option value="ACTIVE">Aktif</option>
                      <option value="PAUSED">Duraklatıldı</option>
                      <option value="COMPLETED">Tamamlandı</option>
                      <option value="ARCHIVED">Arşiv</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Başlangıç
                      </label>
                      <Controller
                        name="startsAt"
                        control={editControl}
                        render={({ field }) => (
                          <DateTimePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Başlangıç seçin"
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">
                        Bitiş
                      </label>
                      <Controller
                        name="endsAt"
                        control={editControl}
                        render={({ field }) => (
                          <DateTimePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Bitiş seçin"
                            error={Boolean(editErrors.endsAt)}
                          />
                        )}
                      />
                      {editErrors.endsAt && (
                        <p className="text-xs text-destructive mt-1">{editErrors.endsAt.message}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground rounded-xl bg-muted/30 px-3 py-2">
                    Soru seti bu ekrandan değiştirilemez; gerekirse yeni bir değerlendirme oluşturun.
                  </p>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditOpen(false)}
                      className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                    >
                      {updateMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Kaydet
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
