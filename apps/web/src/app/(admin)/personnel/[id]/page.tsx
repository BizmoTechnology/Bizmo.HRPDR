"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Users,
  Clock,
  Calendar,
  FileText,
  AlertTriangle,
  Loader2,
  X,
  KeyRound,
} from "lucide-react";
import { GlassCard, ScoreGauge, PortalModal } from "@ph/ui";
import { cn } from "@/lib/utils";
import { apiErrorMessage } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import {
  usePersonnel,
  useDeletePersonnel,
  useSetPortalPassword,
} from "@/hooks/use-api";

const STATUS_MAP: Record<string, { label: string; class: string }> = {
  ACTIVE: { label: "Aktif", class: "text-accent-green bg-accent-green/10" },
  INACTIVE: { label: "Pasif", class: "text-accent-red bg-accent-red/10" },
  ON_LEAVE: {
    label: "İzinli",
    class: "text-accent-orange bg-accent-orange/10",
  },
};

const SHIFT_MAP: Record<string, string> = {
  NONE: "Yok",
  MORNING: "Sabah",
  AFTERNOON: "Öğleden Sonra",
  NIGHT: "Gece",
  ROTATING: "Dönüşümlü",
};

const SESSION_STATUS_MAP: Record<string, { label: string; class: string }> = {
  COMPLETED: {
    label: "Tamamlandı",
    class: "text-accent-green bg-accent-green/10",
  },
  IN_PROGRESS: {
    label: "Devam Ediyor",
    class: "text-primary bg-primary/10",
  },
  NOT_STARTED: {
    label: "Başlamadı",
    class: "text-accent-orange bg-accent-orange/10",
  },
  PAUSED: {
    label: "Duraklatıldı",
    class: "text-accent-orange bg-accent-orange/10",
  },
  EXPIRED: {
    label: "Süresi Doldu",
    class: "text-accent-red bg-accent-red/10",
  },
};

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-lg bg-muted/40", className)} />
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-4">
        <SkeletonBlock className="h-9 w-9 rounded-xl" />
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-48" />
          <SkeletonBlock className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <GlassCard hover={false}>
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <SkeletonBlock className="h-3 w-16" />
                  <SkeletonBlock className="h-5 w-32" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
        <GlassCard hover={false}>
          <SkeletonBlock className="h-24 w-24 mx-auto rounded-full" />
        </GlassCard>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}

export default function PersonnelDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading } = usePersonnel(id);
  const deleteMutation = useDeletePersonnel();
  const setPortalPassword = useSetPortalPassword();
  const { canManage, canAnalyze } = usePermissions();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPortalDialog, setShowPortalDialog] = useState(false);
  const [portalPassword, setPortalPasswordValue] = useState("");

  const handleSetPortalPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (portalPassword.length < 6) {
      toast.error("Portal şifresi en az 6 karakter olmalı");
      return;
    }
    try {
      await setPortalPassword.mutateAsync({ id, password: portalPassword });
      toast.success("Portal şifresi güncellendi");
      setShowPortalDialog(false);
      setPortalPasswordValue("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Portal şifresi güncellenemedi"));
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Personel başarıyla silindi");
      router.push("/personnel");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Personel silinirken hata oluştu"));
    }
  };

  if (isLoading) return <DetailSkeleton />;

  if (!person) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Users className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Personel bulunamadı</p>
        <Link
          href="/personnel"
          className="mt-4 text-sm text-primary hover:underline"
        >
          Personel listesine dön
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[person.status] ?? {
    label: person.status,
    class: "text-muted-foreground bg-muted",
  };

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/personnel"
            className="h-9 w-9 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                {person.firstName} {person.lastName}
              </h1>
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-1 rounded-full",
                  statusInfo.class
                )}
              >
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sicil No: {person.employeeId}
            </p>
          </div>
        </div>

        {canManage && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPortalDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/40 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            title={person.hasPortalPassword ? "Portal şifresini sıfırla" : "Portal şifresi belirle"}
          >
            <KeyRound className="h-4 w-4" />
            {person.hasPortalPassword ? "Portal Şifresini Sıfırla" : "Portal Şifresi Belirle"}
          </button>
          <Link
            href={`/personnel/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/40 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
          >
            <Pencil className="h-4 w-4" />
            Düzenle
          </Link>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-destructive/10 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
        </div>
        )}
      </motion.div>

      {!person.hasPortalPassword && (
        <div className="flex items-start gap-2 rounded-xl border border-accent-orange/30 bg-accent-orange/5 px-4 py-3 text-sm text-accent-orange">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Bu personelin portal şifresi yok; atanan değerlendirmelere giriş yapamaz.
            {canManage && " “Portal Şifresi Belirle” ile şifre oluşturun."}
          </span>
        </div>
      )}

      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        {/* Bilgiler (2/3) */}
        <div className="lg:col-span-2">
          <GlassCard hover={false} className="h-full">
            <h2 className="text-base font-semibold text-foreground mb-4">
              Kişisel &amp; İş Bilgileri
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoRow icon={Mail} label="E-posta" value={person.email} />
              <InfoRow
                icon={Phone}
                label="Telefon"
                value={person.phone ?? "—"}
              />
              <InfoRow
                icon={Briefcase}
                label="Pozisyon"
                value={person.position}
              />
              <InfoRow
                icon={Building2}
                label="Departman"
                value={person.department?.name ?? "—"}
              />
              <InfoRow
                icon={Users}
                label="Takım"
                value={person.team?.name ?? "—"}
              />
              <InfoRow
                icon={Clock}
                label="Vardiya"
                value={SHIFT_MAP[person.shift] ?? person.shift}
              />
              <InfoRow
                icon={Briefcase}
                label="Deneyim"
                value={`${person.experienceYear} yıl`}
              />
              <InfoRow
                icon={Calendar}
                label="İşe Giriş"
                value={
                  person.hireDate
                    ? format(new Date(person.hireDate), "dd MMMM yyyy", {
                        locale: tr,
                      })
                    : "—"
                }
              />
            </div>

            {person.notes && (
              <div className="mt-4 pt-4 border-t border-border/20">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Notlar</p>
                    <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
                      {person.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Skor (1/3) */}
        <GlassCard hover={false} className="flex flex-col items-center justify-center gap-4">
          <h2 className="text-base font-semibold text-foreground">
            Genel Skor
          </h2>
          {person.avgScore != null ? (
            <ScoreGauge
              score={person.avgScore}
              size="lg"
              label="Ortalama Potansiyel"
            />
          ) : (
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <p className="text-sm">Henüz değerlendirme yok</p>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Son Değerlendirmeler */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2 }}
      >
        <GlassCard hover={false}>
          <h2 className="text-base font-semibold text-foreground mb-4">
            Değerlendirmeler
          </h2>

          {!person.sessions?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">Henüz değerlendirme atanmamış</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Değerlendirme
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Durum
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3 pr-4">
                      Skor
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground uppercase pb-3">
                      Tarih
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {person.sessions.map((s) => {
                    const sessionStatus = SESSION_STATUS_MAP[s.status] ?? {
                      label: s.status,
                      class: "text-muted-foreground bg-muted",
                    };
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 pr-4">
                          <Link
                            href={`/assessments/${s.assessment.id}`}
                            className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                          >
                            {s.assessment.title}
                          </Link>
                          {s.reportId && canAnalyze && (
                            <Link
                              href={`/reports/${s.reportId}`}
                              className="ml-2 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <FileText className="h-3 w-3" />
                              Rapor
                            </Link>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "text-xs font-semibold px-2 py-1 rounded-full",
                              sessionStatus.class
                            )}
                          >
                            {sessionStatus.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          {s.avgScore != null ? (
                            <>
                              <span
                                className={cn(
                                  "text-sm font-bold tabular-nums",
                                  s.avgScore >= 8
                                    ? "text-accent-green"
                                    : s.avgScore >= 6
                                      ? "text-accent-orange"
                                      : "text-accent-red"
                                )}
                              >
                                {s.avgScore.toFixed(1)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                /10
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </td>
                        <td className="py-3">
                          <span className="text-xs text-muted-foreground">
                            {s.completedAt
                              ? format(
                                  new Date(s.completedAt),
                                  "dd MMM yyyy",
                                  { locale: tr }
                                )
                              : format(
                                  new Date(s.createdAt),
                                  "dd MMM yyyy",
                                  { locale: tr }
                                )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Portal Şifresi */}
      <AnimatePresence>
        {showPortalDialog && (
          <PortalModal>
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowPortalDialog(false)}
              />
              <motion.form
                onSubmit={handleSetPortalPassword}
                className="relative glass-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Portal Şifresi</h3>
                  <button
                    type="button"
                    onClick={() => setShowPortalDialog(false)}
                    className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {person.firstName} {person.lastName} portala sicil numarası (
                  <span className="font-medium text-foreground">{person.employeeId}</span>) ve bu
                  şifreyle giriş yapar. Mevcut portal oturumları sonlandırılır.
                </p>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={portalPassword}
                  onChange={(e) => setPortalPasswordValue(e.target.value)}
                  placeholder="En az 6 karakter"
                  className="w-full h-10 px-3 rounded-xl bg-muted/40 border border-border/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPortalDialog(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/40"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={setPortalPassword.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {setPortalPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Kaydet
                  </button>
                </div>
              </motion.form>
            </motion.div>
          </PortalModal>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <PortalModal>
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowDeleteDialog(false)}
              />
              <motion.div
                className="relative glass-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="absolute top-4 right-4 h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Personeli Sil
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Bu işlem geri alınamaz
                    </p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mb-6">
                  <strong className="text-foreground">
                    {person.firstName} {person.lastName}
                  </strong>{" "}
                  adlı personeli silmek istediğinizden emin misiniz? Tüm
                  değerlendirme verileri de silinecektir.
                </p>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowDeleteDialog(false)}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Evet, Sil
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </PortalModal>
        )}
      </AnimatePresence>
    </div>
  );
}
