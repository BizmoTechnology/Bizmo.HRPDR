"use client";

import { motion } from "framer-motion";
import { AppMark } from "@/components/layout/AppMark";

const EASE = [0.25, 0.46, 0.45, 0.94] as const;

/**
 * Şifre sıfırlama gibi tek kartlık giriş ekranları için çerçeve.
 * Giriş sayfasıyla aynı aile: marka bloğu (AppMark), opak kart ve alt bilgi; aurora zemin `(auth)/layout.tsx` içinde.
 */
export function AuthCard({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description?: string;
  /** Kartın altında, ayırıcı çizgiyle ayrılan bölüm (ör. "Girişe dön" bağlantısı) */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1200px] flex-col px-4 py-8 sm:px-6 lg:px-12 lg:py-10">
      <div className="flex flex-1 items-center justify-center">
        <motion.div
          className="w-full max-w-[400px]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <div className="mb-6 flex flex-col items-center text-center">
            <AppMark size="lg" />
            <p className="mt-3 font-display text-xl font-extrabold tracking-[-0.02em] text-foreground">
              PotansiyelHaritası
            </p>
            <p className="mt-0.5 text-[13px] text-fg3">Yönetim paneli</p>
          </div>

          <div className="rounded-3xl border border-glass-border bg-surface p-6 shadow-2 sm:p-8">
            <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] text-foreground">
              {title}
            </h1>
            {description && <p className="mt-1 text-[13.5px] text-fg2">{description}</p>}

            <div className="mt-6">{children}</div>

            {footer && <div className="mt-6 border-t border-divider pt-5">{footer}</div>}
          </div>
        </motion.div>
      </div>

      <p className="mt-10 text-center text-xs text-fg3">
        © 2026 PotansiyelHaritası · Tüm hakları saklıdır
      </p>
    </div>
  );
}
