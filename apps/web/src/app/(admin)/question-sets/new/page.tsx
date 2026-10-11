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
import { dimensionColor } from "@/lib/dimension-colors";
import {
  useCreateQuestionSet,
  useSuggestQuestionSetAi,
  type QuestionSetDetail,
} from "@/hooks/use-api";
import { DIMENSION_SHORT_LABELS } from "@ph/shared";

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

  const busy = isSubmitting || createMutation.isPending;

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
          className="bz-btn bz-btn--subtle bz-btn--sm mb-4"
        >
          <ArrowLeft />
          Geri
        </button>
        <div className="bz-page-header mb-0">
          <div className="bz-page-header__text">
            <h1 className="bz-page-header__title">Yeni soru seti</h1>
            <p className="bz-page-header__sub">
              Manuel girin veya AI ile soru havuzundan seçim yaptırın
            </p>
          </div>
        </div>
      </motion.div>

      <GlassCard hover={false}>
        <div className="mb-3 flex items-center gap-3">
          <span className="bz-icon-box" aria-hidden="true">
            <Sparkles className="text-data" />
          </span>
          <h2 className="text-[15px] font-bold text-foreground">
            AI destekli taslak
          </h2>
        </div>
        <p className="mb-4 text-[13px] text-fg2">
          Hedef rol, sektör veya değerlendirme odağını en az 20 karakter ile
          yazın. Kuruluşunuzun soru havuzundan uygun sorular seçilir (aktif AI
          yapılandırması gerekir; MOCK ile test edebilirsiniz).
        </p>
        <div className="bz-form-row">
          <label htmlFor="qs-ai-brief" className="bz-label">
            Hedef ve bağlam
          </label>
          <textarea
            id="qs-ai-brief"
            value={aiBrief}
            onChange={(e) => setAiBrief(e.target.value)}
            rows={4}
            placeholder="Örn: Üretim hattı takım liderleri için teknik problem çözme ve iletişim becerilerini ölçen bir set..."
            className="bz-field"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="bz-form-row">
            <label htmlFor="qs-ai-max" className="bz-label">
              En fazla soru sayısı
            </label>
            <input
              id="qs-ai-max"
              type="number"
              inputMode="numeric"
              min={3}
              max={50}
              value={aiMax}
              onChange={(e) =>
                setAiMax(Math.min(50, Math.max(3, Number(e.target.value) || 20)))
              }
              className="bz-field w-28 tabular-nums"
            />
          </div>
          <button
            type="button"
            onClick={() => void runAiSuggest()}
            disabled={suggestMutation.isPending}
            className="bz-btn bz-btn--soft"
          >
            {suggestMutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles />
            )}
            {suggestMutation.isPending ? "Öneri hazırlanıyor" : "Öneri oluştur"}
          </button>
        </div>
        {pickedQuestionIds.length > 0 && (
          <div className="bz-callout mt-4" data-tone="info">
            AI seçimi: <b>{pickedQuestionIds.length} soru</b> forma uygulandı;
            kaydettiğinizde sete eklenir.
          </div>
        )}
      </GlassCard>

      <GlassCard hover={false}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <h2 className="text-[15px] font-bold text-foreground">
            Soru seti bilgileri
          </h2>

          <div className="bz-form-row">
            <label htmlFor="qs-name" className="bz-label">
              Ad <span className="bz-req">*</span>
            </label>
            <input
              id="qs-name"
              {...register("name")}
              placeholder="Örn: Liderlik — Çekirdek Set v2"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "qs-name-err" : undefined}
              className="bz-field"
            />
            {errors.name && (
              <span id="qs-name-err" className="bz-error-text">
                {errors.name.message}
              </span>
            )}
          </div>

          <div className="bz-form-row">
            <label htmlFor="qs-desc" className="bz-label">
              Açıklama
            </label>
            <textarea
              id="qs-desc"
              {...register("description")}
              rows={3}
              className="bz-field"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="bz-check">
              <input type="checkbox" {...register("isActive")} />
              Aktif
            </label>
            <label className="bz-check">
              <input type="checkbox" {...register("isDefault")} />
              Varsayılan soru seti
            </label>
          </div>

          <fieldset className="bz-fieldset">
            <legend className="bz-label mb-3">Boyut ağırlıkları</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {WEIGHT_FIELDS.map(({ key, field }) => (
                <div key={key} className="bz-form-row">
                  <label
                    htmlFor={`qs-w-${field}`}
                    className="bz-label flex items-center gap-2 font-medium text-fg2"
                  >
                    <span
                      className={cn("h-2 w-2 rounded-full", dimensionColor(key).bar)}
                      aria-hidden="true"
                    />
                    {DIMENSION_SHORT_LABELS[key]}
                  </label>
                  <input
                    id={`qs-w-${field}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    {...register(field)}
                    className="bz-field tabular-nums"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2 border-t border-divider pt-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="bz-btn"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={busy}
              className="bz-btn bz-btn--primary"
            >
              {busy && <Loader2 className="animate-spin" />}
              {busy ? "Oluşturuluyor" : "Seti oluştur"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
