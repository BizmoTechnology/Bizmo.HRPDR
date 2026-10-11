"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { AiChatButton } from "./AiChatButton";
import { AiChatWorkArea } from "./AiChatWorkArea";

export function AiChatDock() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {!open ? (
        <AiChatButton open={open} onClick={() => setOpen((o) => !o)} />
      ) : null}

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Paneli kapat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="bz-scrim cursor-default"
              onClick={() => setOpen(false)}
            />

            {/* Bizmo çekmecesi (DESIGN.md §16): kenarlardan 8px, köşe 26, cam yüzey; sayfa bağlamı görünür kalır */}
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="ai-chat-panel-title"
              initial={{ x: "104%" }}
              animate={{ x: 0 }}
              exit={{ x: "104%" }}
              transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-2 right-2 top-2 z-modal flex w-[min(560px,calc(100vw-16px))] flex-col overflow-hidden rounded-3xl border border-glass-border bg-popover shadow-3 backdrop-blur-xl"
            >
              <span id="ai-chat-panel-title" className="sr-only">
                İK AI Asistanı sohbet paneli
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                title="Kapat (Esc)"
                className="bz-icon-btn absolute right-3 top-3 z-10"
              >
                <X />
              </button>
              <AiChatWorkArea embedded className="min-h-0 flex-1 border-0 bg-transparent" />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
