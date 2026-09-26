"use client";

import { motion } from "framer-motion";

/** Şifre sıfırlama gibi tek kartlık kimlik doğrulama ekranları için çerçeve */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background:
          "linear-gradient(135deg, hsl(200 13% 5%) 0%, hsl(153 40% 12%) 50%, hsl(200 13% 8%) 100%)",
      }}
    >
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg shadow-primary/20">
            <span className="text-white font-bold text-lg select-none">PH</span>
          </div>
          <p className="text-white/60 text-sm">PotansiyelHaritası</p>
        </div>
        <div className="rounded-2xl bg-background/95 border border-border/50 p-6 shadow-xl">
          <h1 className="text-xl font-bold text-foreground mb-1">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mb-6">{description}</p>}
          {children}
        </div>
      </motion.div>
    </div>
  );
}
