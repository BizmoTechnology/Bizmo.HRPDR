"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPersonnelSchema, type CreatePersonnelInput } from "@ph/shared";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { GlassCard } from "@ph/ui";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import {
  useCreatePersonnel,
  useDepartmentList,
  useTeamsByDepartment,
} from "@/hooks/use-api";

const SHIFT_OPTIONS = [
  { value: "NONE", label: "Yok" },
  { value: "MORNING", label: "Sabah" },
  { value: "AFTERNOON", label: "Öğleden sonra" },
  { value: "NIGHT", label: "Gece" },
  { value: "ROTATING", label: "Dönüşümlü" },
];

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "INACTIVE", label: "Pasif" },
  { value: "ON_LEAVE", label: "İzinli" },
];

const LANG_OPTIONS = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
];

/** Bizmo form satırı (DESIGN.md §11): etiket üstte, alan, altında hata ya da yardım metni */
function FormField({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ? `bz-form-row ${className}` : "bz-form-row"}>
      <label htmlFor={id} className="bz-label">
        {label}
        {required && <span className="bz-req">*</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="bz-error-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="bz-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Alanın hata / yardım bağlantısı */
function describe(id: string, error?: string, hint?: boolean) {
  return {
    id,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function NewPersonnelPage() {
  const router = useRouter();
  const createMutation = useCreatePersonnel();
  const { data: departments, isLoading: depsLoading } = useDepartmentList();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreatePersonnelInput>({
    resolver: zodResolver(createPersonnelSchema),
    defaultValues: {
      status: "ACTIVE",
      shift: "NONE",
      preferredLanguage: "tr",
      experienceYear: 0,
    },
  });

  const selectedDepartmentId = watch("departmentId");
  const { data: teams } = useTeamsByDepartment(selectedDepartmentId);

  const onSubmit = async (data: CreatePersonnelInput) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success("Personel başarıyla oluşturuldu");
      router.push("/personnel");
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ?? "Personel oluşturulurken hata oluştu"
      );
    }
  };

  const saving = isSubmitting || createMutation.isPending;

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

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
      >
        <GlassCard hover={false} className="p-0">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="space-y-6 p-5 sm:p-6">
              {/* Kişisel bilgiler */}
              <section>
                <SectionTitle
                  title="Kişisel bilgiler"
                  sub="Kimlik ve iletişim bilgileri"
                />
                <div className="bz-form-grid md:grid-cols-2">
                  <FormField
                    id="employeeId"
                    label="Sicil numarası"
                    error={errors.employeeId?.message}
                    required
                  >
                    <input
                      {...register("employeeId")}
                      {...describe("employeeId", errors.employeeId?.message)}
                      placeholder="Ör. PRS-001"
                      autoComplete="off"
                      className="bz-field"
                    />
                  </FormField>

                  <FormField
                    id="firstName"
                    label="Ad"
                    error={errors.firstName?.message}
                    required
                  >
                    <input
                      {...register("firstName")}
                      {...describe("firstName", errors.firstName?.message)}
                      autoComplete="given-name"
                      className="bz-field"
                    />
                  </FormField>

                  <FormField
                    id="lastName"
                    label="Soyad"
                    error={errors.lastName?.message}
                    required
                  >
                    <input
                      {...register("lastName")}
                      {...describe("lastName", errors.lastName?.message)}
                      autoComplete="family-name"
                      className="bz-field"
                    />
                  </FormField>

                  <FormField
                    id="email"
                    label="E-posta"
                    error={errors.email?.message}
                    required
                  >
                    <input
                      {...register("email")}
                      {...describe("email", errors.email?.message)}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="ornek@firma.com"
                      className="bz-field"
                    />
                  </FormField>

                  <FormField id="phone" label="Telefon" error={errors.phone?.message}>
                    <input
                      {...register("phone")}
                      {...describe("phone", errors.phone?.message)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+90 5XX XXX XX XX"
                      className="bz-field"
                    />
                  </FormField>

                  <FormField
                    id="birthDate"
                    label="Doğum tarihi"
                    error={errors.birthDate?.message}
                  >
                    <Controller
                      name="birthDate"
                      control={control}
                      render={({ field }) => (
                        <DateTimePicker
                          id="birthDate"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="Doğum tarihi ve saat"
                        />
                      )}
                    />
                  </FormField>
                </div>
              </section>

              {/* İş bilgileri */}
              <section className="border-t border-divider pt-6">
                <SectionTitle
                  title="İş bilgileri"
                  sub="Görev, birim ve çalışma düzeni"
                />
                <div className="bz-form-grid md:grid-cols-2">
                  <FormField
                    id="position"
                    label="Pozisyon"
                    error={errors.position?.message}
                    required
                  >
                    <input
                      {...register("position")}
                      {...describe("position", errors.position?.message)}
                      placeholder="Ör. CNC operatörü"
                      className="bz-field"
                    />
                  </FormField>

                  <FormField
                    id="experienceYear"
                    label="Deneyim (yıl)"
                    error={errors.experienceYear?.message}
                    hint="Toplam iş deneyimi, tam yıl olarak"
                  >
                    <input
                      {...register("experienceYear", { valueAsNumber: true })}
                      {...describe(
                        "experienceYear",
                        errors.experienceYear?.message,
                        true
                      )}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder="0"
                      className="bz-field tabular-nums"
                    />
                  </FormField>

                  <FormField
                    id="departmentId"
                    label="Departman"
                    error={errors.departmentId?.message}
                  >
                    <select
                      {...register("departmentId")}
                      {...describe("departmentId", errors.departmentId?.message)}
                      className="bz-field"
                      disabled={depsLoading}
                    >
                      <option value="">Departman seçin</option>
                      {departments?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    id="teamId"
                    label="Takım"
                    error={errors.teamId?.message}
                  >
                    <select
                      {...register("teamId")}
                      {...describe("teamId", errors.teamId?.message)}
                      className="bz-field"
                      disabled={!selectedDepartmentId}
                    >
                      <option value="">
                        {selectedDepartmentId
                          ? "Takım seçin"
                          : "Önce departman seçin"}
                      </option>
                      {teams?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField id="status" label="Durum" error={errors.status?.message}>
                    <select
                      {...register("status")}
                      {...describe("status", errors.status?.message)}
                      className="bz-field"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField id="shift" label="Vardiya" error={errors.shift?.message}>
                    <select
                      {...register("shift")}
                      {...describe("shift", errors.shift?.message)}
                      className="bz-field"
                    >
                      {SHIFT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    id="preferredLanguage"
                    label="Tercih edilen dil"
                    error={errors.preferredLanguage?.message}
                  >
                    <select
                      {...register("preferredLanguage")}
                      {...describe(
                        "preferredLanguage",
                        errors.preferredLanguage?.message
                      )}
                      className="bz-field"
                    >
                      {LANG_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField
                    id="hireDate"
                    label="İşe giriş tarihi"
                    error={errors.hireDate?.message}
                  >
                    <Controller
                      name="hireDate"
                      control={control}
                      render={({ field }) => (
                        <DateTimePicker
                          id="hireDate"
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          placeholder="İşe giriş tarihi ve saat"
                        />
                      )}
                    />
                  </FormField>
                </div>
              </section>

              {/* Ek bilgiler */}
              <section className="border-t border-divider pt-6">
                <SectionTitle title="Ek bilgiler" />
                <FormField
                  id="notes"
                  label="Notlar"
                  error={errors.notes?.message}
                  hint="İsteğe bağlı. Sertifika, yetki veya vardiya tercihleri gibi bilgiler."
                >
                  <textarea
                    {...register("notes")}
                    {...describe("notes", errors.notes?.message, true)}
                    rows={3}
                    placeholder="Personel hakkında ek notlar"
                    className="bz-field"
                  />
                </FormField>
              </section>
            </div>

            {/* Eylemler: ikincil solda, birincil sağda */}
            <div className="flex flex-col-reverse gap-2 border-t border-divider px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              <Link href="/personnel" className="bz-btn">
                Vazgeç
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="bz-btn bz-btn--primary"
              >
                {createMutation.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Save />
                )}
                {createMutation.isPending ? "Kaydediliyor" : "Personeli kaydet"}
              </button>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}
