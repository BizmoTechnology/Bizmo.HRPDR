"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, BrainCircuit, Clock, Sparkles, LogIn } from "lucide-react";
import { GlassCard } from "@ph/ui";
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(200 13% 5%) 0%, hsl(153 40% 10%) 60%, hsl(200 10% 8%) 100%)",
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        className="relative w-full max-w-sm text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Success Animation */}
        <motion.div
          className="flex justify-center mb-6"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
        >
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/30">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <motion.div
              className="absolute -top-1 -right-1"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: "spring", stiffness: 300, damping: 15 }}
            >
              <div className="h-7 w-7 rounded-full bg-accent-green flex items-center justify-center shadow-lg">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
            </motion.div>
          </div>
        </motion.div>

        <GlassCard className="rounded-2xl">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Tebrikler{personnel ? `, ${personnel.firstName}` : ""}!
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              Değerlendirmen başarıyla tamamlandı. Cevapların analiz ediliyor ve
              kişisel potansiyel raporun hazırlanıyor.
            </p>

            <div className="space-y-3 mb-6">
              <motion.div
                className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <div className="h-8 w-8 rounded-lg bg-accent-purple/10 flex items-center justify-center flex-shrink-0">
                  <BrainCircuit className="h-4 w-4 text-accent-purple" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">
                    Cevapların Kaydedildi
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Değerlendirme İK ekibi tarafından incelenecek
                  </p>
                </div>
              </motion.div>

              <motion.div
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.65, duration: 0.4 }}
              >
                <div className="h-8 w-8 rounded-lg bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-accent-orange" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">
                    Sonuçlar Hazırlanıyor
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    İK yöneticinle paylaşılacak
                  </p>
                </div>
              </motion.div>
            </div>

            <p className="text-xs text-muted-foreground">
              Zaman ayırdığın için teşekkür ederiz.{" "}
              <span className="text-primary font-medium">Bu, senin için!</span>
            </p>

            <button
              onClick={() => router.replace("/login")}
              className="mt-5 inline-flex items-center gap-1.5 text-xs text-primary hover:underline underline-offset-4"
            >
              <LogIn className="h-3.5 w-3.5" />
              Giriş ekranına dön
            </button>
          </motion.div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
