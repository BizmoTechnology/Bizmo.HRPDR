"use client";

import { memo } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  /** Tıklanabilir kartta üzerine gelince gölge 2 + 1px yükselme (.bz-card--interactive); yalnız onClick varsa uygulanır */
  hover?: boolean;
  /** Mount entrance animation (default off — use parent stagger or set true for hero cards). */
  animate?: boolean;
  children: React.ReactNode;
}

export const GlassCard = memo(function GlassCard({
  className,
  hover = true,
  animate = false,
  children,
  ...props
}: GlassCardProps) {
  const entrance =
    animate === true
      ? {
          initial: { opacity: 0, y: 8 } as const,
          animate: { opacity: 1, y: 0 } as const,
          transition: {
            duration: 0.35,
            ease: [0.25, 0.46, 0.45, 0.94] as const,
          },
        }
      : { initial: false as const };

  // Bizmo içerik kartı (DESIGN.md §14): opak yüzey, 16 köşe, cam kenar, gölge 1, 20px iç boşluk.
  // Cam yalnız kabuk ve yüzen katmanlardadır; içerik kartı opaktır.
  const interactive = hover && typeof props.onClick === "function";

  return (
    <motion.div
      className={cn("bz-card p-5", interactive && "bz-card--interactive", className)}
      {...entrance}
      {...props}
    >
      {children}
    </motion.div>
  );
});
