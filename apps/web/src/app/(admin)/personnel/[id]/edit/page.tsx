"use client";

import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Users } from "lucide-react";
import type { CreatePersonnelInput } from "@ph/shared";
import { apiErrorMessage } from "@/lib/api";
import { toDatetimeLocalString } from "@/lib/datetime-local";
import { usePersonnel, useUpdatePersonnel } from "@/hooks/use-api";
import { PersonnelForm } from "@/components/personnel/PersonnelForm";

function toLocalInput(value: string | null | undefined) {
  return value ? toDatetimeLocalString(new Date(value)) : null;
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

  if (isLoading) {
    return (
      <div className="space-y-6 w-full max-w-4xl mx-auto">
        <div className="h-8 w-48 bg-muted/40 rounded-xl animate-pulse" />
        <div className="h-96 bg-muted/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Users className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Personel bulunamadı</p>
        <Link href="/personnel" className="mt-4 text-sm text-primary hover:underline">
          Personel listesine dön
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          href={`/personnel/${id}`}
          className="h-9 w-9 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Personeli Düzenle</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {person.firstName} {person.lastName} · Sicil {person.employeeId}
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        <PersonnelForm
          mode="edit"
          defaultValues={{
            employeeId: person.employeeId,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            phone: person.phone,
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
