"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import type { CreatePersonnelInput } from "@ph/shared";
import { apiErrorMessage } from "@/lib/api";
import { useCreatePersonnel } from "@/hooks/use-api";
import { PersonnelForm } from "@/components/personnel/PersonnelForm";

export default function NewPersonnelPage() {
  const router = useRouter();
  const createMutation = useCreatePersonnel();

  const onSubmit = async (data: CreatePersonnelInput) => {
    try {
      const created = await createMutation.mutateAsync(data);
      toast.success("Personel başarıyla oluşturuldu");
      router.push(created?.id ? `/personnel/${created.id}` : "/personnel");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Personel oluşturulurken hata oluştu"));
    }
  };

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
          href="/personnel"
          className="bz-icon-btn"
          aria-label="Personel listesine dön"
          title="Personel listesine dön"
        >
          <ArrowLeft />
        </Link>
        <div className="bz-page-header__text">
          <h1 className="bz-page-header__title">Yeni personel</h1>
          <p className="bz-page-header__sub">Yeni personel kaydı oluşturun</p>
        </div>
      </motion.div>

      {/* Form: oluşturma ve düzenleme ortak bileşeni */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <PersonnelForm
          mode="create"
          onSubmit={onSubmit}
          isPending={createMutation.isPending}
          cancelHref="/personnel"
        />
      </motion.div>
    </div>
  );
}
