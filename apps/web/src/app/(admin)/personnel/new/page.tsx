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
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <motion.div
        className="flex items-center gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          href="/personnel"
          className="h-9 w-9 rounded-xl bg-muted/40 flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Yeni Personel</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Yeni personel kaydı oluşturun
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
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
