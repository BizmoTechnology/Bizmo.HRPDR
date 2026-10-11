"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, Sparkles, LogIn } from "lucide-react";
import { GlassCard } from "@ph/ui";
import { PortalHeader } from "@/components/PortalHeader";
import { getPersonnel, logout } from "@/lib/api";

export default function CompletePage() {
  const router = useRouter();
  const [personnel, setPersonnel] = useState<{ firstName: string } | null>(null);

  useEffect(() => {
    setPersonnel(getPersonnel());
    // Test bitti: ortak cihazda (kiosk/tablet) bir sonraki kişi bu oturumu kullanamasın
    void logout();
  }, []);

  return (
    <main className="bz-aurora flex min-h-dvh w-full justify-center px-4 pb-8 pt-4 sm:items-center sm:py-12">
      <motion.div
        className="w-full max-w-[440px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <PortalHeader />

        <GlassCard className="rounded-3xl p-6 text-center shadow-2 sm:p-8">
          {/* Başarı simgesi: yumuşak yeşil daire + yeşil mürekkep işaret (yeşil üstünde beyaz yok) */}
          <motion.div
            className="mb-5 flex justify-center"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="relative">
              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-soft text-brand-ink ring-1 ring-inset ring-brand/30">
                <Check className="h-9 w-9" strokeWidth={2.4} aria-hidden="true" />
              </div>
              <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border border-glass-border bg-surface text-fg2 shadow-1">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </div>
          </motion.div>

          <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">
            Tebrikler{personnel ? `, ${personnel.firstName}` : ""}!
          </h1>
          <p className="mx-auto mt-2 max-w-[38ch] text-[15px] leading-relaxed text-fg2">
            Değerlendirmeniz tamamlandı ve cevaplarınız kaydedildi.
          </p>

          {/* Sonraki adımlar (DESIGN.md §19 dikey adımlar): biten yeşil tik, sıradaki yeşil halka */}
          <ol className="bz-vsteps bz-well mt-6 px-4 py-4 text-left">
            <li className="bz-vstep" data-state="done">
              <span className="bz-vstep__marker">
                <Check aria-hidden="true" />
              </span>
              <span className="bz-vstep__title">Cevaplarınız kaydedildi</span>
              <span className="bz-vstep__desc">Değerlendirmeyi tamamladınız</span>
            </li>
            <li className="bz-vstep" data-state="current" aria-current="step">
              <span className="bz-vstep__marker">2</span>
              <span className="bz-vstep__title">İK incelemesi</span>
              <span className="bz-vstep__desc">Cevaplarınızı İK ekibi inceleyecek</span>
            </li>
            <li className="bz-vstep">
              <span className="bz-vstep__marker">3</span>
              <span className="bz-vstep__title">Kişisel potansiyel raporu</span>
              <span className="bz-vstep__desc">İnceleme sonrası hazırlanır ve İK yöneticinizle paylaşılır</span>
            </li>
          </ol>

          <p className="mt-6 text-[13px] text-fg3">
            Zaman ayırdığınız için teşekkür ederiz.{" "}
            <strong className="whitespace-nowrap font-semibold text-foreground">Bu, sizin için!</strong>
          </p>

          {/* Oturum kapatıldı; ortak cihazda sıradaki kişi buradan giriş yapar (dokunmatikte 44px) */}
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="bz-btn bz-btn--block mt-5"
          >
            <LogIn />
            Giriş ekranına dön
          </button>
        </GlassCard>
      </motion.div>
    </main>
  );
}
