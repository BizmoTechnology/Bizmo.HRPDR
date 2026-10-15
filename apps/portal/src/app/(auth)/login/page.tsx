"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Eye, EyeOff, AlertCircle, LogIn, KeyRound, MonitorSmartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppMark } from "@/components/AppMark";
import { api, errorMessage, saveSession } from "@/lib/api";
import { cn } from "@/lib/utils";

const portalLoginSchema = z.object({
  employeeId: z.string().min(1, "Sicil numarası zorunlu"),
  password: z.string().min(1, "Şifre zorunlu"),
});

type PortalLoginInput = z.infer<typeof portalLoginSchema>;

export default function PortalLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<PortalLoginInput>({
    resolver: zodResolver(portalLoginSchema),
  });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expired")) {
      toast.info("Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.");
    }
  }, []);

  const onSubmit = async (data: PortalLoginInput) => {
    setIsLoading(true);
    setFormError(null);
    try {
      const res = await api.post("/api/auth/portal/login", data);
      const { accessToken, refreshToken, personnel } = res.data.data;
      saveSession({ accessToken, refreshToken, personnel });
      toast.success(`Hoş geldiniz, ${personnel.firstName}!`);
      router.replace("/welcome");
    } catch (err: unknown) {
      // Giriş hatası kart içinde kalıcı uyarı olarak gösterilir (DESIGN.md §39: durumlar .bz-alert ile)
      setFormError(errorMessage(err, "Sicil numarası veya şifre hatalı"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="bz-aurora flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10">
      <motion.div
        className="w-full max-w-[400px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Marka */}
        <div className="mb-6 flex flex-col items-center text-center">
          <AppMark size="lg" />
          <p className="mt-3 font-display text-xl font-extrabold tracking-[-0.02em] text-foreground">
            PotansiyelHaritası
          </p>
          <p className="mt-0.5 text-[13px] text-fg3">Personel değerlendirme portalı</p>
        </div>

        {/* Giriş kartı */}
        <div className="rounded-3xl border border-glass-border bg-surface p-6 shadow-2 sm:p-8">
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-foreground">
            Giriş yapın
          </h1>
          <p className="mt-1 text-[13.5px] text-fg2">
            Değerlendirmeye başlamak için sicil numaranız ve şifrenizle giriş yapın.
          </p>

          {formError && (
            <div role="alert" className="bz-alert bz-alert--danger mt-5">
              <AlertCircle />
              <div>
                <p className="bz-alert__title">Giriş yapılamadı</p>
                <p>{formError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {/* Sicil no */}
            <div className="bz-form-row">
              <label htmlFor="portal-employee-id" className="bz-label">
                Sicil numarası
              </label>
              <input
                {...register("employeeId")}
                id="portal-employee-id"
                type="text"
                placeholder="Örn. P001"
                className="bz-field h-11 text-base sm:text-sm"
                autoComplete="username"
                autoCapitalize="characters"
                autoFocus
                aria-invalid={errors.employeeId ? true : undefined}
                aria-describedby={errors.employeeId ? "portal-employee-id-error" : undefined}
              />
              {errors.employeeId && (
                <p id="portal-employee-id-error" className="bz-error-text">
                  {errors.employeeId.message}
                </p>
              )}
            </div>

            {/* Şifre */}
            <div className="bz-form-row">
              <label htmlFor="portal-password" className="bz-label">
                Şifre
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  id="portal-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="bz-field h-11 pr-12 text-base sm:text-sm"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  aria-describedby={errors.password ? "portal-password-error" : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="bz-icon-btn bz-icon-btn--sm absolute inset-y-0 right-1.5 my-auto"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  title={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && (
                <p id="portal-password-error" className="bz-error-text">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Ekrandaki tek birincil eylem */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading || undefined}
                className={cn(
                  "bz-btn bz-btn--primary bz-btn--lg bz-btn--block",
                  isLoading && "is-loading",
                )}
              >
                {isLoading ? (
                  "Giriş yapılıyor…"
                ) : (
                  <>
                    <LogIn />
                    Değerlendirmeye başla
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3 border-t border-divider pt-5">
            <p className="bz-auth__notice">
              <KeyRound />
              <span>Şifrenizi bilmiyorsanız İK departmanınızla iletişime geçin.</span>
            </p>
            <p className="bz-auth__notice">
              <MonitorSmartphone />
              <span>
                Ortak bir cihaz kullanıyorsanız değerlendirme bitince sekmeyi kapatın.
              </span>
            </p>
          </div>
        </div>
      </motion.div>
    </main>
  );
}
