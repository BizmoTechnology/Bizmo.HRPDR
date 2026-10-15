"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { resetPasswordSchema } from "@ph/shared";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AuthCard } from "@/components/layout/AuthCard";

const formSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(formSchema) });

  // useSearchParams statik sayfada Suspense gerektirir; token doğrudan URL'den okunur
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token");
    setToken(t);
    if (t) setValue("token", t);
  }, [setValue]);

  const onSubmit = async ({ token: t, password }: ResetPasswordForm) => {
    try {
      await api.post("/api/auth/reset-password", { token: t, password });
      toast.success("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
      router.replace("/login");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Şifre güncellenemedi"));
    }
  };

  return (
    <AuthCard
      title="Yeni şifre belirle"
      description="En az 8 karakter, bir büyük harf ve bir rakam içermeli."
      footer={
        <Link
          href={token ? "/login" : "/forgot-password"}
          className="bz-link inline-flex items-center gap-1.5 text-[13px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {token ? "Girişe dön" : "Yeni bağlantı iste"}
        </Link>
      }
    >
      {token === null ? null : !token ? (
        <div role="alert" className="bz-alert bz-alert--danger">
          <AlertCircle aria-hidden="true" />
          <p>Sıfırlama bağlantısı geçersiz. Lütfen yeni bir bağlantı isteyin.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("token")} />
          <div className="bz-form-row">
            <label htmlFor="reset-password" className="bz-label">
              Yeni şifre
            </label>
            <input
              {...register("password")}
              id="reset-password"
              type="password"
              autoComplete="new-password"
              className="bz-field"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "reset-password-error" : undefined}
            />
            {errors.password && (
              <p id="reset-password-error" className="bz-error-text">
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="bz-form-row">
            <label htmlFor="reset-password-confirm" className="bz-label">
              Yeni şifre (tekrar)
            </label>
            <input
              {...register("confirmPassword")}
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              className="bz-field"
              aria-invalid={errors.confirmPassword ? true : undefined}
              aria-describedby={errors.confirmPassword ? "reset-password-confirm-error" : undefined}
            />
            {errors.confirmPassword && (
              <p id="reset-password-confirm-error" className="bz-error-text">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Ekrandaki tek birincil eylem */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting || undefined}
              className={cn(
                "bz-btn bz-btn--primary bz-btn--lg bz-btn--block",
                isSubmitting && "is-loading",
              )}
            >
              {isSubmitting ? "Güncelleniyor…" : "Şifreyi güncelle"}
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
