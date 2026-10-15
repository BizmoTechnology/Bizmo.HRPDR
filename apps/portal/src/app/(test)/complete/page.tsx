"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, BrainCircuit, Clock, Sparkles, LogIn } from "lucide-react";
import { GlassCard } from "@ph/ui";
import { AppMark } from "@/components/AppMark";
import { getPersonnel, logout } from "@/lib/api";

export default function CompletePage() {
  const router = useRouter();
  const [personnel, setPersonnel] = useState<{ firstName: string } | null>(null);

  useEffect(() => {
    setPersonnel(getPersonnel());
    // Test bitti: ortak cihazda (kiosk/tablet) bir sonraki kişi bu oturumu kullanamasın
    void logout();
  }, []);

  const steps = [
    {
      icon: BrainCircuit,
      title: "Cevapların kaydedildi",
      sub: "Değerlendirme İK ekibi tarafından incelenecek",
    },
    {
      icon: Clock,
      title: "Sonuçlar hazırlanıyor",
      sub: "İK yöneticinle paylaşılacak",
    },
  ];

  return (
    <main className="bz-aurora flex min-h-dvh w-full justify-center px-4 py-8 sm:items-center sm:py-12">
      <motion.div
        className="w-full max-w-[440px] text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Marka */}
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <AppMark size="sm" />
          <span className="font-display text-[15px] font-extrabold tracking-[-0.01em] text-foreground">
            PotansiyelHaritası
          </span>
        </div>

        <GlassCard className="rounded-3xl p-6 shadow-2 sm:p-8">
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
            Değerlendirmen başarıyla tamamlandı. Cevapların analiz ediliyor ve
            kişisel potansiyel raporun hazırlanıyor.
          </p>

          {/* Sonraki adımlar */}
          <ul className="mt-6 space-y-2.5 text-left">
            {steps.map((step, i) => (
              <motion.li
                key={step.title}
                className="flex items-center gap-3 rounded-2xl border border-divider bg-surface-2 p-3"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.08, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                <span className="bz-icon-box">
                  <step.icon />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="text-[13px] text-fg3">{step.sub}</p>
                </div>
              </motion.li>
            ))}
          </ul>

          <p className="mt-6 text-[13px] text-fg3">
            Zaman ayırdığın için teşekkür ederiz.{" "}
            <strong className="whitespace-nowrap font-semibold text-foreground">Bu, senin için!</strong>
          </p>

          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="bz-btn bz-btn--ghost bz-btn--sm mt-5"
          >
            <LogIn />
            Giriş ekranına dön
          </button>
        </GlassCard>
      </motion.div>
    </main>
  );
}
