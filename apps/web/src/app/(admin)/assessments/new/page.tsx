"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@ph/ui";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { useCreateAssessment, useQuestionSetList } from "@/hooks/use-api";

const schema = z
  .object({
    title: z
      .string()
      .min(2, "Başlık en az 2 karakter olmalı")
      .max(200, "Başlık çok uzun"),
    description: z.string().max(2000).optional(),
    questionSetId: z.string().min(1, "Soru seti seçilmelidir"),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  })
  .refine(
    (d) => {
      if (d.startsAt && d.endsAt) return new Date(d.endsAt) > new Date(d.startsAt);
      return true;
    },
    { message: "Bitiş tarihi başlangıçtan sonra olmalı", path: ["endsAt"] },
  );

type FormValues = z.infer<typeof schema>;

export default function NewAssessmentPage() {
  const router = useRouter();
  const createMutation = useCreateAssessment();
  const { data: qsData, isLoading: qsLoading } = useQuestionSetList();
  const questionSets = qsData ?? [];

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      questionSetId: "",
      startsAt: "",
      endsAt: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await createMutation.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        questionSetId: values.questionSetId,
        startsAt: values.startsAt ? new Date(values.startsAt).toISOString() : undefined,
        endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : undefined,
      });
      toast.success("Değerlendirme oluşturuldu");
      router.push("/assessments");
    } catch {
      toast.error("Bir hata oluştu, lütfen tekrar deneyin");
    }
  };

  const submitting = isSubmitting || createMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Header */}
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
        <div className="bz-page-header">
          <div className="bz-page-header__text">
            <h1 className="bz-page-header__title">Yeni değerlendirme</h1>
            <p className="bz-page-header__sub">
              Değerlendirme bilgilerini girerek oluşturun
            </p>
          </div>
        </div>
      </motion.div>

      <GlassCard hover={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Title */}
            <div className="bz-form-row">
              <label className="bz-label" htmlFor="assessment-title">
                Başlık <span className="bz-req">*</span>
              </label>
              <input
                id="assessment-title"
                {...register("title")}
                placeholder="Ör. 2026 güz dönemi potansiyel değerlendirmesi"
                className="bz-field"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "assessment-title-error" : undefined}
              />
              {errors.title && (
                <p id="assessment-title-error" className="bz-error-text">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="bz-form-row">
              <label className="bz-label" htmlFor="assessment-description">
                Açıklama{" "}
                <span className="font-normal text-muted-foreground">
                  (isteğe bağlı)
                </span>
              </label>
              <textarea
                id="assessment-description"
                {...register("description")}
                rows={3}
                placeholder="Değerlendirmenin amacı ve kapsamı"
                className="bz-field"
              />
            </div>

            {/* Question Set */}
            <div className="bz-form-row">
              <label className="bz-label" htmlFor="assessment-question-set">
                Soru seti <span className="bz-req">*</span>
              </label>
              <select
                id="assessment-question-set"
                {...register("questionSetId")}
                className="bz-field"
                disabled={qsLoading}
                aria-invalid={errors.questionSetId ? true : undefined}
                aria-describedby={
                  errors.questionSetId ? "assessment-question-set-error" : undefined
                }
              >
                <option value="">
                  {qsLoading ? "Yükleniyor..." : "Soru seti seçin"}
                </option>
                {questionSets.map((qs: any) => (
                  <option key={qs.id} value={qs.id}>
                    {qs.name} (v{qs.version})
                  </option>
                ))}
              </select>
              {errors.questionSetId && (
                <p id="assessment-question-set-error" className="bz-error-text">
                  {errors.questionSetId.message}
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="bz-form-row">
                <label className="bz-label" htmlFor="assessment-starts-at">
                  Başlangıç tarihi
                </label>
                <Controller
                  name="startsAt"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker
                      id="assessment-starts-at"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Başlangıç seçin"
                    />
                  )}
                />
              </div>
              <div className="bz-form-row">
                <label className="bz-label" htmlFor="assessment-ends-at">
                  Bitiş tarihi
                </label>
                <Controller
                  name="endsAt"
                  control={control}
                  render={({ field }) => (
                    <DateTimePicker
                      id="assessment-ends-at"
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Bitiş seçin"
                      error={Boolean(errors.endsAt)}
                    />
                  )}
                />
                {errors.endsAt && (
                  <p className="bz-error-text">{errors.endsAt.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-6 flex justify-end gap-2 border-t border-divider pt-5">
            <button
              type="button"
              onClick={() => router.back()}
              className="bz-btn"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bz-btn bz-btn--primary"
            >
              {submitting && <Loader2 className="animate-spin" />}
              {submitting ? "Oluşturuluyor" : "Oluştur"}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
