"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, BrainCircuit, Cog, Target, BarChart3, AlertCircle, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@ph/shared";
import { api, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";
import { cn } from "@/lib/utils";
import { AppMark } from "@/components/layout/AppMark";

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setFormError(null);
    try {
      const res = await api.post("/api/auth/login", data);
      const { accessToken, user } = res.data.data;
      setAccessToken(accessToken);
      setAuth(user, accessToken);
      toast.success(`Hoş geldiniz, ${user.name}!`);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Giriş başarısız. Bilgilerinizi kontrol edin.";
      // Giriş hatası kart içinde kalıcı uyarı olarak gösterilir (DESIGN.md §39: durumlar .bz-alert ile)
      setFormError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: BrainCircuit,
      title: "AI destekli analiz",
      desc: "Claude, GPT ve Gemini ile derin potansiyel değerlendirmesi",
    },
    {
      icon: Target,
      title: "5 boyutlu ölçüm",
      desc: "Mantıksal düşünce, liderlik, sosyal zekâ ve kariyer uyumu",
    },
    {
      icon: BarChart3,
      title: "Gerçek zamanlı analitik",
      desc: "Departman ve takım bazlı karşılaştırmalı raporlar",
    },
    {
      icon: Cog,
      title: "CNC ve üretim odaklı",
      desc: "Talaşlı imalat sektörüne özel değerlendirme sistemi",
    },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col px-4 py-8 sm:px-6 lg:px-12 lg:py-10">
      <div className="grid flex-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_400px] xl:gap-20">
        {/* ── Tanıtım (geniş ekran) ── */}
        <motion.section
          className="hidden lg:block"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="flex items-center gap-3.5">
            <AppMark size="lg" />
            <div>
              <p className="font-display text-xl font-extrabold leading-tight tracking-[-0.02em] text-foreground">
                PotansiyelHaritası
              </p>
              <p className="mt-0.5 text-[13px] text-fg3">v1.1 · Yönetim paneli</p>
            </div>
          </div>

          <h1 className="mt-12 max-w-[560px] font-display text-[40px] font-extrabold leading-[1.08] tracking-[-0.025em] text-foreground">
            Personelin gizli potansiyelini keşfedin
          </h1>
          <p className="mt-4 max-w-[54ch] text-[17px] leading-[1.7] text-fg2">
            AI destekli değerlendirme sistemi ile mavi yaka personelinin
            liderlik kapasitesini, kariyer yönelimini ve büyüme potansiyelini
            objektif olarak ölçün.
          </p>

          <ul className="mt-10 grid max-w-[640px] grid-cols-2 gap-x-8 gap-y-6 border-t border-divider pt-8">
            {features.map((f, i) => (
              <motion.li
                key={f.title}
                className="flex gap-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.3, ease: EASE }}
              >
                <span className="bz-icon-box">
                  <f.icon />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{f.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-fg3">{f.desc}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        {/* ── Giriş kartı ── */}
        <motion.div
          className="mx-auto w-full max-w-[400px]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.35, ease: EASE }}
        >
          {/* Dar ekranda marka kartın üstünde */}
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <AppMark size="lg" />
            <p className="mt-3 font-display text-xl font-extrabold tracking-[-0.02em] text-foreground">
              PotansiyelHaritası
            </p>
            <p className="mt-0.5 text-[13px] text-fg3">Yönetim paneli</p>
          </div>

          <div className="rounded-3xl border border-glass-border bg-surface p-6 shadow-2 sm:p-8">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-foreground">
              Hoş geldiniz
            </h2>
            <p className="mt-1 text-[13.5px] text-fg2">Yönetim paneline giriş yapın.</p>

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
              {/* E-posta */}
              <div className="bz-form-row">
                <label htmlFor="login-email" className="bz-label">
                  E-posta
                </label>
                <input
                  {...register("email")}
                  id="login-email"
                  type="email"
                  placeholder="ornek@sirket.com.tr"
                  className="bz-field"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "login-email-error" : undefined}
                />
                {errors.email && (
                  <p id="login-email-error" className="bz-error-text">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Şifre */}
              <div className="bz-form-row">
                <label htmlFor="login-password" className="bz-label">
                  Şifre
                </label>
                <div className="relative">
                  <input
                    {...register("password")}
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    className="bz-field pr-12"
                    autoComplete="current-password"
                    aria-invalid={errors.password ? true : undefined}
                    aria-describedby={errors.password ? "login-password-error" : undefined}
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
                  <p id="login-password-error" className="bz-error-text">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Beni hatırla + Şifremi unuttum */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="bz-check text-[13px] text-fg2">
                  <input {...register("rememberMe")} type="checkbox" />
                  Beni hatırla
                </label>
                <a href="/forgot-password" className="bz-link text-[13px]">
                  Şifremi unuttum
                </a>
              </div>

              {/* Giriş: ekrandaki tek birincil eylem */}
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
                  {isLoading ? "Giriş yapılıyor…" : "Giriş yap"}
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-3 border-t border-divider pt-5">
              <p className="bz-auth__notice">
                <UserRound />
                <span>
                  Bu giriş ekranı yalnızca yöneticiler içindir. Personel girişi
                  için{" "}
                  <a
                    href={
                      process.env["NEXT_PUBLIC_PORTAL_URL"] ??
                      "http://localhost:3002"
                    }
                    className="bz-link"
                  >
                    personel portalını
                  </a>{" "}
                  kullanın.
                </span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <p className="mt-10 text-center text-xs text-fg3 lg:text-left">
        © 2026 PotansiyelHaritası · Tüm hakları saklıdır
      </p>
    </div>
  );
}
