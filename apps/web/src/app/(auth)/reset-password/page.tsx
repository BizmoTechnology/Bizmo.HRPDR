"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
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
    <AuthCard title="Yeni Şifre Belirle" description="En az 8 karakter, bir büyük harf ve bir rakam içermeli.">
      {token === null ? null : !token ? (
        <p className="text-sm text-destructive mb-4">
          Sıfırlama bağlantısı geçersiz. Lütfen yeni bir bağlantı isteyin.
        </p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register("token")} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Yeni şifre</label>
            <input
              {...register("password")}
              type="password"
              autoComplete="new-password"
              className={cn("form-input-base px-3.5", errors.password && "border-destructive")}
            />
            {errors.password && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.password.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Yeni şifre (tekrar)</label>
            <input
              {...register("confirmPassword")}
              type="password"
              autoComplete="new-password"
              className={cn("form-input-base px-3.5", errors.confirmPassword && "border-destructive")}
            />
            {errors.confirmPassword && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Şifreyi güncelle
          </button>
        </form>
      )}
      <Link
        href={token ? "/login" : "/forgot-password"}
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {token ? "Girişe dön" : "Yeni bağlantı iste"}
      </Link>
    </AuthCard>
  );
}
