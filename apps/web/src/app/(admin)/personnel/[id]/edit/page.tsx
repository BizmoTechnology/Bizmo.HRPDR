"use client";

import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, UserX } from "lucide-react";
import { formatTrMobile, type CreatePersonnelInput } from "@ph/shared";
import { GlassCard } from "@ph/ui";
import { apiErrorMessage } from "@/lib/api";
import { toDatetimeLocalString } from "@/lib/datetime-local";
import { usePersonnel, useUpdatePersonnel } from "@/hooks/use-api";
import { PersonnelForm } from "@/components/personnel/PersonnelForm";

function toLocalInput(value: string | null | undefined) {
  return value ? toDatetimeLocalString(new Date(value)) : null;
}

/** Yükleniyor: başlık + form kartı şeklinde iskelet (DESIGN.md §17) */
function EditSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl" aria-busy="true">
      <div className="bz-page-header">
        <div className="bz-skeleton h-[38px] w-[38px] rounded-[10px]" />
        <div className="bz-page-header__text space-y-2">
          <div className="bz-skeleton h-7 w-56" />
          <div className="bz-skeleton h-3.5 w-40" />
        </div>
      </div>
      <GlassCard hover={false}>
        <div className="bz-skeleton mb-2 h-4 w-36" />
        <div className="bz-skeleton mb-5 h-3.5 w-52" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="bz-skeleton h-3.5 w-24" />
              <div className="bz-skeleton h-[42px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

export default function EditPersonnelPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: person, isLoading } = usePersonnel(id);
  const updateMutation = useUpdatePersonnel();

  const onSubmit = async (data: CreatePersonnelInput) => {
    try {
      // Boş portal şifresi "değiştirme" anlamına gelir
      const { portalPassword, ...rest } = data;
      await updateMutation.mutateAsync({
        id,
        data: { ...rest, ...(portalPassword ? { portalPassword } : {}) },
      });
      toast.success("Personel bilgileri güncellendi");
      router.push(`/personnel/${id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Personel güncellenirken hata oluştu"));
    }
  };

  if (isLoading) return <EditSkeleton />;

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

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Başlık */}
      <motion.div
        className="bz-page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          href={`/personnel/${id}`}
          className="bz-icon-btn"
          aria-label="Personel detayına dön"
          title="Personel detayına dön"
        >
          <ArrowLeft />
        </Link>
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Personeli düzenle</h1>
          <p className="bz-page-header__sub">
            {person.firstName} {person.lastName} · Sicil no{" "}
            <span className="font-mono text-[12.5px] font-semibold text-fg2">
              {person.employeeId}
            </span>
          </p>
        </div>
      </motion.div>

      {/* Form: oluşturma ve düzenleme ortak bileşeni */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <PersonnelForm
          mode="edit"
          defaultValues={{
            employeeId: person.employeeId,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone ? formatTrMobile(person.phone) : null,
            position: person.position,
            experienceYear: person.experienceYear,
            status: person.status,
            shift: person.shift as CreatePersonnelInput["shift"],
            preferredLanguage: person.preferredLanguage,
            departmentId: person.department?.id ?? null,
            teamId: person.team?.id ?? null,
            hireDate: toLocalInput(person.hireDate),
            birthDate: toLocalInput(person.birthDate),
            notes: person.notes,
          }}
          onSubmit={onSubmit}
          isPending={updateMutation.isPending}
          cancelHref={`/personnel/${id}`}
        />
      </motion.div>
    </div>
  );
}
