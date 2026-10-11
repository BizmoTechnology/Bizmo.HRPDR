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
    // Bizmo giriş kalıbı (DESIGN.md §39 `.bz-auth`): tek kart, marka kartın içinde, tek birincil eylem
    <main className="bz-auth bz-aurora">
      <motion.div
        className="bz-auth__card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="bz-auth__brand">
          <AppMark size="sm" />
          <span className="min-w-0">
            PotansiyelHaritası
            <span className="mt-1 block font-sans text-xs font-medium text-fg3">
              Personel değerlendirme portalı
            </span>
          </span>
        </div>

        <h1 className="bz-auth__title">Giriş yapın</h1>
        <p className="bz-auth__sub">
          Değerlendirmeye başlamak için sicil numaranız ve şifrenizle giriş yapın.
        </p>

        {formError && (
          <div role="alert" className="bz-alert bz-alert--danger">
            <AlertCircle aria-hidden="true" />
            <div>
              <p className="bz-alert__title">Giriş yapılamadı</p>
              <p>{formError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          {/* Sicil no — 16px yazı: iOS odakta sayfayı yakınlaştırmasın */}
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
              enterKeyHint="next"
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
                enterKeyHint="go"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "portal-password-error" : undefined}
              />
              {/* Dokunmatikte 44px (DESIGN.md §30): --sm değil, varsayılan boyut */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="bz-icon-btn absolute inset-y-0 right-0.5 my-auto"
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
          <button
            type="submit"
            disabled={isLoading}
            aria-busy={isLoading || undefined}
            className={cn(
              "bz-btn bz-btn--primary bz-btn--lg bz-btn--block mt-1",
              isLoading && "is-loading",
            )}
          >
            {isLoading ? (
              "Giriş yapılıyor…"
            ) : (
              <>
                <LogIn />
                Giriş yap
              </>
            )}
          </button>
        </form>

        <div className="grid gap-2.5 border-t border-divider pt-4">
          <p className="bz-auth__notice">
            <KeyRound aria-hidden="true" />
            <span>Şifrenizi bilmiyorsanız İK departmanınızla iletişime geçin.</span>
          </p>
          <p className="bz-auth__notice">
            <MonitorSmartphone aria-hidden="true" />
            <span>Ortak bir cihaz kullanıyorsanız değerlendirme bitince oturumu kapatın.</span>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
