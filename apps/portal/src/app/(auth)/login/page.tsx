"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, AlertCircle, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, errorMessage, saveSession } from "@/lib/api";

const portalLoginSchema = z.object({
  employeeId: z.string().min(1, "Sicil numarası zorunlu"),
  password: z.string().min(1, "Şifre zorunlu"),
});

type PortalLoginInput = z.infer<typeof portalLoginSchema>;

export default function PortalLoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
    try {
      const res = await api.post("/api/auth/portal/login", data);
      const { accessToken, refreshToken, personnel } = res.data.data;
      saveSession({ accessToken, refreshToken, personnel });
      toast.success(`Hoş geldiniz, ${personnel.firstName}!`);
      router.replace("/welcome");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Sicil numarası veya şifre hatalı"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, hsl(200 13% 5%) 0%, hsl(153 40% 10%) 60%, hsl(200 10% 8%) 100%)",
      }}
    >
      {/* Dekoratif arka plan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-sm"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <span className="text-white font-bold text-2xl select-none">PH</span>
          </div>
          <h1 className="text-xl font-bold text-white">PotansiyelHaritası</h1>
          <p className="text-white/50 text-sm mt-1">Personel Değerlendirme Portalı</p>
        </div>

        {/* Form Kartı */}
        <div className="glass-surface rounded-2xl p-6 sm:p-8">
          <h2 className="text-xl font-bold text-foreground mb-1">Giriş Yap</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Değerlendirmeye başlamak için giriş yapın
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Sicil No */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Sicil Numarası
              </label>
              <input
                {...register("employeeId")}
                type="text"
                placeholder="P001"
                className="w-full h-12 rounded-xl bg-muted/50 border border-border/50 px-4 text-base
                  placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2
                  focus:ring-primary/30 transition-colors"
                autoComplete="username"
                autoFocus
              />
              {errors.employeeId && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {errors.employeeId.message}
                </p>
              )}
            </div>

            {/* Şifre */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                Şifre
              </label>
              <div className="relative">
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="w-full h-12 rounded-xl bg-muted/50 border border-border/50 px-4 pr-12 text-base
                    placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2
                    focus:ring-primary/30 transition-colors"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base
                hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Değerlendirmeye Başla
                </>
              )}
            </button>
          </form>

          <p className="text-xs text-muted-foreground/60 text-center mt-6">
            Şifrenizi bilmiyorsanız İK departmanınızla iletişime geçin
          </p>
        </div>
      </motion.div>
    </div>
  );
}
