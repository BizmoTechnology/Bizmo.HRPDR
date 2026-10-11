"use client";

import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiChatButton({
  onClick,
  open,
}: {
  onClick: () => void;
  open: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? "Sohbet panelini kapat" : "İK AI Asistanını aç"}
      className={cn(
        // Yüzen eylem (DESIGN.md §10 .bz-fab): yeşil zemin + lacivert ikon, yeşil gölge yalnız birincil eylemde
        "fixed bottom-6 right-6 z-sticky flex h-[52px] w-[52px] items-center justify-center rounded-full",
        "bg-primary text-primary-foreground shadow-green transition-[background-color,transform] duration-150",
        "hover:bg-brand-strong active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      )}
    >
      <MessageCircle className="h-6 w-6" strokeWidth={1.8} />
    </button>
  );
}
