"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { cn } from "@/lib/utils";
import {
  useCreateQuestionSet,
  useSuggestQuestionSetAi,
  useAiStatus,
  type QuestionSetDetail,
} from "@/hooks/use-api";
import { DIMENSION_SHORT_LABELS } from "@ph/shared";
import { AiNotConnectedNotice } from "@/components/ai/AiNotConnectedNotice";

const WEIGHT_FIELDS = [
  { key: "LOGICAL_ALGORITHMIC", field: "weightLogical" as const },
  { key: "LEADERSHIP", field: "weightLeadership" as const },
  { key: "SOCIAL_INTELLIGENCE", field: "weightSocial" as const },
  { key: "GROWTH_POTENTIAL", field: "weightGrowth" as const },
  { key: "DOMAIN_ALIGNMENT", field: "weightDomain" as const },
];

const formSchema = z.object({
  name: z.string().min(1, "Ad gerekli").max(300),
  description: z.string().max(2000).optional(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  weightLogical: z.coerce.number().min(0),
  weightLeadership: z.coerce.number().min(0),
  weightSocial: z.coerce.number().min(0),
  weightGrowth: z.coerce.number().min(0),
  weightDomain: z.coerce.number().min(0),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewQuestionSetPage() {
  const router = useRouter();
  const createMutation = useCreateQuestionSet();
  const suggestMutation = useSuggestQuestionSetAi();
  const { data: aiStatus } = useAiStatus();
  const aiConnected = aiStatus?.connected !== false;

  const [aiBrief, setAiBrief] = useState("");
  const [aiMax, setAiMax] = useState(20);
  const [pickedQuestionIds, setPickedQuestionIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      isDefault: false,
      weightLogical: 20,
      weightLeadership: 20,
      weightSocial: 20,
      weightGrowth: 20,
      weightDomain: 20,
    },
  });

  const runAiSuggest = async () => {
    const trimmed = aiBrief.trim();
    if (trimmed.length < 20) {
      toast.error("AI için en az 20 karakterlik bir hedef / bağlam yazın.");
      return;
    }
    try {
      const result = await suggestMutation.mutateAsync({
        brief: trimmed,
        maxQuestions: aiMax,
      });
      reset({
        name: result.name,
        description: result.description ?? "",
        isActive: true,
        isDefault: false,
        weightLogical: result.weightLogical,
        weightLeadership: result.weightLeadership,
        weightSocial: result.weightSocial,
        weightGrowth: result.weightGrowth,
        weightDomain: result.weightDomain,
      });
      setPickedQuestionIds(result.questionIds ?? []);
      toast.success(
        `AI taslağı hazır (${result.questionIds?.length ?? 0} soru seçildi). Kaydet ile oluşturun.`,
      );
    } catch (e: unknown) {
      const ax = e as {
        response?: { data?: { message?: string } };
      };
      toast.error(ax.response?.data?.message ?? "AI önerisi alınamadı");
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const items = pickedQuestionIds.map((questionId, i) => ({
        questionId,
        order: i + 1,
        isRequired: true as const,
      }));
      const created = (await createMutation.mutateAsync({
        name: values.name,
        description: values.description?.trim() || undefined,
        isActive: values.isActive,
        isDefault: values.isDefault,
        weightLogical: values.weightLogical,
        weightLeadership: values.weightLeadership,
        weightSocial: values.weightSocial,
        weightGrowth: values.weightGrowth,
        weightDomain: values.weightDomain,
        items,
      })) as QuestionSetDetail;
      toast.success("Soru seti oluşturuldu");
      router.push(`/question-sets/${created.id}`);
    } catch {
      toast.error("Oluşturma başarısız");
    }
  };

  const inputCls =
    "w-full px-3 py-2.5 rounded-xl bg-muted/50 border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Geri
        </button>
        <h1 className="text-2xl font-bold text-foreground">
          Yeni Soru Seti
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manuel girin veya AI ile soru havuzundan seçim yaptırın
        </p>
      </motion.div>

      <GlassCard hover={false}>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">
            AI destekli taslak
          </h2>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Hedef rol, sektör veya değerlendirme odağını en az 20 karakter ile
          yazın. Kuruluşunuzun soru havuzundan uygun sorular seçilir (aktif AI
          entegrasyonu gerekir).
        </p>
        {!aiConnected && (
          <AiNotConnectedNotice feature="AI destekli taslak" className="mb-3" />
        )}
        <textarea
          value={aiBrief}
          onChange={(e) => setAiBrief(e.target.value)}
          rows={4}
          placeholder="Örn: Üretim hattı takım liderleri için teknik problem çözme ve iletişim becerilerini ölçen bir set..."
          className={cn(inputCls, "resize-none")}
        />
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              En fazla soru sayısı
            </label>
            <input
              type="number"
              min={3}
              max={50}
              value={aiMax}
              onChange={(e) =>
                setAiMax(Math.min(50, Math.max(3, Number(e.target.value) || 20)))
              }
              className={cn(inputCls, "w-28 tabular-nums")}
            />
          </div>
          <button
            type="button"
            onClick={() => void runAiSuggest()}
            disabled={suggestMutation.isPending || !aiConnected}
            className="inline-flex items-center gap-2 rounded-xl bg-primary/15 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/25 disabled:opacity-50"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Öneri oluştur
          </button>
        </div>
        {pickedQuestionIds.length > 0 && (
          <p className="mt-3 text-xs text-primary">
            AI seçimi: {pickedQuestionIds.length} soru forma uygulandı (kaydedince
            sete eklenir).
          </p>
        )}
      </GlassCard>

      <GlassCard hover={false}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <h2 className="text-base font-semibold text-foreground">
            Soru seti bilgileri
          </h2>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Ad <span className="text-destructive">*</span>
            </label>
            <input
              {...register("name")}
              placeholder="Örn: Liderlik — Çekirdek Set v2"
              className={cn(inputCls, errors.name && "border-destructive/50")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Açıklama
            </label>
            <textarea
              {...register("description")}
              rows={3}
              className={cn(inputCls, "resize-none")}
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                {...register("isActive")}
                className="rounded border-border text-primary focus:ring-primary/30"
              />
              Aktif
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                {...register("isDefault")}
                className="rounded border-border text-primary focus:ring-primary/30"
              />
              Varsayılan soru seti
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">
              Boyut ağırlıkları
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {WEIGHT_FIELDS.map(({ key, field }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {DIMENSION_SHORT_LABELS[key]}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    {...register(field)}
                    className={cn(inputCls, "tabular-nums")}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border/20 pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(isSubmitting || createMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Oluştur
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
