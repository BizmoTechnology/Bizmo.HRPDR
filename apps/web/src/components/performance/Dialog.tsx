"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { PortalModal, cn } from "@ph/ui";

const PANEL =
  "relative z-modal flex w-full flex-col overflow-hidden rounded-3xl border border-glass-border bg-popover shadow-3 backdrop-blur-xl";

/**
 * Erişilebilir iletişim kutusu: Esc kapatır, açılınca ilk odaklanabilir öğeye,
 * kapanınca açan öğeye odak döner; Tab kutunun içinde kalır.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  // Ebeveyn her çizimde yeni onClose verse de odak yeniden kurulmasın
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(
        "[data-autofocus], input, select, textarea, button:not([data-dialog-close])",
      );
      el?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = [
          ...panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ];
        if (items.length === 0) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
      openerRef.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <PortalModal>
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              className="bz-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={description ? descId : undefined}
              className={cn(PANEL, "max-h-[86vh] max-w-[480px]", className)}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
                <div className="min-w-0">
                  <h3 id={titleId} className="font-display text-[19px] font-bold leading-snug text-foreground">
                    {title}
                  </h3>
                  {description && (
                    <p id={descId} className="mt-1 text-[13px] text-fg2">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  data-dialog-close
                  className="bz-icon-btn bz-icon-btn--sm -mr-2"
                  aria-label="Kapat"
                  title="Kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">{children}</div>
              {footer && (
                <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-divider px-6 py-3.5">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </PortalModal>
      )}
    </AnimatePresence>
  );
}
