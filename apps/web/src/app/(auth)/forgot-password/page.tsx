"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { forgotPasswordSchema } from "@ph/shared";
import type { z } from "zod";
import { api, apiErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AuthCard } from "@/components/layout/AuthCard";

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      await api.post("/api/auth/forgot-password", data);
      setSent(true);
    } catch (err) {
      toast.error(apiErrorMessage(err, "İstek gönderilemedi. Lütfen tekrar deneyin."));
    }
  };

  return (
    <AuthCard
      title="Şifremi unuttum"
      description={sent ? undefined : "Hesabınıza kayıtlı e-posta adresini girin; sıfırlama bağlantısı gönderelim."}
      footer={
        <Link href="/login" className="bz-link inline-flex items-center gap-1.5 text-[13px]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Girişe dön
        </Link>
      }
    >
      {sent ? (
        <div role="status" className="bz-alert bz-alert--success">
          <MailCheck aria-hidden="true" />
          <p>
            Bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Bağlantı 60 dakika
            geçerlidir.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="bz-form-row">
            <label htmlFor="forgot-email" className="bz-label">
              E-posta
            </label>
            <input
              {...register("email")}
              id="forgot-email"
              type="email"
              autoComplete="email"
              placeholder="ornek@sirket.com"
              className="bz-field"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "forgot-email-error" : undefined}
            />
            {errors.email && (
              <p id="forgot-email-error" className="bz-error-text">
                {errors.email.message}
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
              {isSubmitting ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}
