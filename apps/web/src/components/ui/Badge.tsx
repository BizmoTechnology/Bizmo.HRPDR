import { cn } from "@ph/ui";
import type { ReactNode } from "react";

/** Durum çipi (DESIGN.md §13 .bz-chip): 22px hap, 11/600; renk tek başına anlam taşımaz — metin her zaman var */
const variantStyles = {
  success: "bz-chip--success",
  warning: "bz-chip--warning",
  error: "bz-chip--danger",
  info: "bz-chip--info",
  ai: "bz-chip--info",
  neutral: "",
} as const;

type BadgeVariant = keyof typeof variantStyles;

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return <span className={cn("bz-chip", variantStyles[variant], className)}>{children}</span>;
}
