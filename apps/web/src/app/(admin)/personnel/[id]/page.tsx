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
  Gauge,
  AlertTriangle,
  Loader2,
  X,
  UserX,
} from "lucide-react";
import { GlassCard, ScoreGauge, PortalModal } from "@ph/ui";
import { cn } from "@/lib/utils";
import { usePersonnel, useDeletePersonnel } from "@/hooks/use-api";

/** Personel durumu → Bizmo çipi (DESIGN.md §13). Pasif bir hata değildir: nötr çip. */
const STATUS_MAP: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: "Aktif", tone: "bz-chip--success" },
  INACTIVE: { label: "Pasif", tone: "" },
  ON_LEAVE: { label: "İzinli", tone: "bz-chip--warning" },
};

const SHIFT_MAP: Record<string, string> = {
  NONE: "Yok",
  MORNING: "Sabah",
  AFTERNOON: "Öğleden sonra",
  NIGHT: "Gece",
  ROTATING: "Dönüşümlü",
};

/** Oturum durumu → süreç durumu rozeti (.bz-status, DESIGN.md §13): şekil + sözcük */
const SESSION_STATUS_MAP: Record<string, { label: string; status: string }> = {
  COMPLETED: { label: "Tamamlandı", status: "done" },
  IN_PROGRESS: { label: "Devam ediyor", status: "progress" },
  NOT_STARTED: { label: "Başlamadı", status: "draft" },
  PAUSED: { label: "Duraklatıldı", status: "pending" },
  PENDING: { label: "Bekliyor", status: "pending" },
  EXPIRED: { label: "Süresi doldu", status: "cancelled" },
  CANCELLED: { label: "İptal", status: "cancelled" },
};

function DetailSkeleton() {
  return (
    <div className="w-full space-y-4" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="bz-skeleton h-[38px] w-[38px] rounded-[10px]" />
        <div className="bz-skeleton h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <div className="bz-skeleton h-6 w-56" />
          <div className="bz-skeleton h-3.5 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GlassCard hover={false}>
            <div className="bz-skeleton mb-5 h-4 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="bz-skeleton h-3 w-16" />
                  <div className="bz-skeleton h-4 w-32" />
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
        <GlassCard hover={false}>
          <div className="bz-skeleton mb-5 h-4 w-24" />
          <div className="bz-skeleton mx-auto h-28 w-28 rounded-full" />
        </GlassCard>
      </div>
    </div>
  );
}

/** Künye satırı: etiket üstte soluk, değer altta kalın (DESIGN.md §41) */
function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode | null | undefined;
}) {
  const empty = value == null || value === "";
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-[3px] h-4 w-4 flex-none text-fg3" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            "mt-0.5 text-[14px] [overflow-wrap:anywhere]",
            empty ? "text-fg3" : "font-semibold text-foreground"
          )}
        >
          {empty ? "—" : value}
        </dd>
      </div>
    </div>
  );
}

export default function PersonnelDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading } = usePersonnel(id);
  const deleteMutation = useDeletePersonnel();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Personel başarıyla silindi");
      router.push("/personnel");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Personel silinirken hata oluştu"
      );
    }
  };

  if (isLoading) return <DetailSkeleton />;

  if (!person) {
    return (
      <div className="bz-card">
        <div className="bz-empty py-16">
          <UserX className="h-8 w-8 text-fg3" aria-hidden="true" />
          <p className="bz-empty__title">Personel bulunamadı</p>
          <p className="bz-empty__text">
            Kayıt silinmiş ya da bağlantı hatalı olabilir.
          </p>
          <Link href="/personnel" className="bz-btn">
            <ArrowLeft />
            Personel listesine dön
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_MAP[person.status] ?? {
    label: person.status,
    tone: "",
  };
  const fullName = `${person.firstName} ${person.lastName}`;

  return (
    <div className="bz-record w-full">
      {/* Kayıt başlığı: kimlik + durum + kayıt eylemleri (DESIGN.md §41) */}
      <motion.div
        className="bz-record__head"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/personnel"
            className="bz-icon-btn"
            aria-label="Personel listesine dön"
            title="Personel listesine dön"
          >
            <ArrowLeft />
          </Link>
          <span className="bz-avatar bz-avatar--lg" aria-hidden="true">
            {person.firstName[0]}
            {person.lastName[0]}
          </span>
          <div className="bz-record__heading gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="bz-record__title">{fullName}</h1>
              <span className={cn("bz-chip", statusInfo.tone)}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              Sicil no{" "}
              <span className="font-mono text-[12.5px] font-semibold text-fg2">
                {person.employeeId}
              </span>
            </p>
          </div>
        </div>

        <div className="bz-record__actions">
          <Link
            href={`/personnel/${id}/edit`}
            className="bz-btn bz-record__edit"
            title="Düzenle"
          >
            <Pencil />
            <span>Düzenle</span>
          </Link>
          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            className="bz-btn bz-btn--danger"
            title="Sil"
          >
            <Trash2 />
            <span>Sil</span>
          </button>
        </div>
      </motion.div>

      <motion.div
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        {/* Bilgiler (2/3) */}
        <div className="min-w-0 lg:col-span-2">
          <GlassCard hover={false} className="h-full">
            <h2 className="mb-4 text-[15px] font-bold text-foreground">
              Kişisel ve iş bilgileri
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              <InfoRow icon={Mail} label="E-posta" value={person.email} />
              <InfoRow icon={Phone} label="Telefon" value={person.phone} />
              <InfoRow icon={Briefcase} label="Pozisyon" value={person.position} />
              <InfoRow
                icon={Building2}
                label="Departman"
                value={person.department?.name}
              />
              <InfoRow icon={Users} label="Takım" value={person.team?.name} />
              <InfoRow
                icon={Clock}
                label="Vardiya"
                value={SHIFT_MAP[person.shift] ?? person.shift}
              />
              <InfoRow
                icon={Briefcase}
                label="Deneyim"
                value={
                  <span className="tabular-nums">
                    {person.experienceYear} yıl
                  </span>
                }
              />
              <InfoRow
                icon={Calendar}
                label="İşe giriş"
                value={
                  person.hireDate ? (
                    <span className="tabular-nums">
                      {format(new Date(person.hireDate), "dd MMMM yyyy", {
                        locale: tr,
                      })}
                    </span>
                  ) : null
                }
              />
            </dl>

            {person.notes && (
              <div className="mt-5 border-t border-divider pt-4">
                <div className="flex items-start gap-2.5">
                  <FileText
                    className="mt-[3px] h-4 w-4 flex-none text-fg3"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-muted-foreground">
                      Notlar
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
                      {person.notes}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Skor (1/3) */}
        <GlassCard hover={false} className="flex flex-col">
          <h2 className="text-[15px] font-bold text-foreground">Genel skor</h2>
          {person.avgScore != null ? (
            <div className="flex flex-1 items-center justify-center py-4">
              <ScoreGauge
                score={person.avgScore}
                size="lg"
                label="Ortalama potansiyel"
              />
            </div>
          ) : (
            <div className="bz-empty flex-1 justify-center px-2 py-8">
              <Gauge className="h-7 w-7 text-fg3" aria-hidden="true" />
              <p className="bz-empty__title text-[15px]">Henüz değerlendirme yok</p>
              <p className="bz-empty__text">
                İlk değerlendirme tamamlandığında ortalama skor burada görünür.
              </p>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Değerlendirmeler */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.16 }}
      >
        <GlassCard hover={false} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
            <h2 className="text-[15px] font-bold text-foreground">
              Değerlendirmeler
            </h2>
            {!!person.sessions?.length && (
              <span className="text-[12px] text-muted-foreground tabular-nums">
                {person.sessions.length} kayıt
              </span>
            )}
          </div>

          {!person.sessions?.length ? (
            <div className="bz-empty border-t border-divider py-12">
              <FileText className="h-7 w-7 text-fg3" aria-hidden="true" />
              <p className="bz-empty__title text-[15px]">
                Henüz değerlendirme atanmamış
              </p>
              <p className="bz-empty__text">
                Bu personele atanan değerlendirmeler burada listelenir.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-divider">
              <table className="bz-table">
                <thead>
                  <tr>
                    <th>Değerlendirme</th>
                    <th>Durum</th>
                    <th className="is-num">Skor</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {person.sessions.map((s) => {
                    const sessionStatus = SESSION_STATUS_MAP[s.status];
                    return (
                      <tr key={s.id}>
                        <td className="font-medium text-foreground">
                          {s.assessment.title}
                        </td>
                        <td>
                          {sessionStatus ? (
                            <span
                              className="bz-status"
                              data-status={sessionStatus.status}
                            >
                              {sessionStatus.label}
                            </span>
                          ) : (
                            <span className="bz-chip">{s.status}</span>
                          )}
                        </td>
                        <td className="is-num">
                          {s.avgScore != null ? (
                            <>
                              <span
                                className={cn(
                                  "font-semibold",
                                  s.avgScore >= 8
                                    ? "text-success-ink"
                                    : s.avgScore >= 6
                                      ? "text-warning-ink"
                                      : "text-danger-ink"
                                )}
                              >
                                {s.avgScore.toFixed(1)}
                              </span>
                              <span className="text-[12px] text-fg3"> /10</span>
                            </>
                          ) : (
                            <span className="text-fg3">—</span>
                          )}
                        </td>
                        <td className="text-fg2 tabular-nums">
                          {format(
                            new Date(s.completedAt ?? s.createdAt),
                            "dd MMM yyyy",
                            { locale: tr }
                          )}
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

      {/* Silme onayı: yıkıcı onay penceresi (DESIGN.md §16) */}
      <AnimatePresence>
        {showDeleteDialog && (
          <PortalModal>
            <motion.div
              className="bz-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowDeleteDialog(false)}
              aria-hidden="true"
            />
            <div className="pointer-events-none fixed inset-0 z-modal flex items-center justify-center p-3">
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="delete-personnel-title"
                aria-describedby="delete-personnel-desc"
                className="pointer-events-auto relative w-full max-w-[480px] rounded-3xl border border-glass-border bg-popover p-6 shadow-3 backdrop-blur-xl"
                initial={{ opacity: 0, scale: 0.98, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 8 }}
                transition={{ duration: 0.2 }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowDeleteDialog(false);
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowDeleteDialog(false)}
                  className="bz-icon-btn bz-icon-btn--sm absolute right-4 top-4"
                  aria-label="Kapat"
                  title="Kapat"
                >
                  <X />
                </button>

                <div className="flex items-start gap-3 pr-8">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-danger-soft text-danger-ink">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="delete-personnel-title"
                      className="font-display text-[19px] font-bold leading-snug text-foreground"
                    >
                      Personel silinsin mi?
                    </h2>
                    <p
                      id="delete-personnel-desc"
                      className="mt-1 text-[13px] leading-relaxed text-fg2"
                    >
                      <strong>{fullName}</strong> ve bu kişiye ait tüm
                      değerlendirme verileri kalıcı olarak silinecek. Bu işlem
                      geri alınamaz.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setShowDeleteDialog(false)}
                    className="bz-btn"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="bz-btn bz-btn--danger-solid"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                    {deleteMutation.isPending ? "Siliniyor" : "Sil"}
                  </button>
                </div>
              </motion.div>
            </div>
          </PortalModal>
        )}
      </AnimatePresence>
    </div>
  );
}
