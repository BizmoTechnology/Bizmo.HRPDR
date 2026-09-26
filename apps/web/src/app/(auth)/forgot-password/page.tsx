"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
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
      title="Şifremi Unuttum"
      description={sent ? undefined : "Hesabınıza kayıtlı e-posta adresini girin; sıfırlama bağlantısı gönderelim."}
    >
      {sent ? (
        <div className="text-center py-2">
          <MailCheck className="h-10 w-10 text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-6">
            Bu e-posta adresi kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Bağlantı 60 dakika
            geçerlidir.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">E-posta</label>
            <input
              {...register("email")}
              type="email"
              autoComplete="email"
              placeholder="ornek@sirket.com"
              className={cn("form-input-base px-3.5", errors.email && "border-destructive")}
            />
            {errors.email && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.email.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sıfırlama bağlantısı gönder
          </button>
        </form>
      )}
      <Link
        href="/login"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Girişe dön
      </Link>
    </AuthCard>
  );
}
