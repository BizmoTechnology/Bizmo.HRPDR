"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { AiChatDock } from "@/components/ai-chat/AiChatDock";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSED_KEY = "sidebarCollapsed";

/**
 * Bizmo B kabuğu, içe gömülü (DESIGN.md §8.1): kenar çubuğu sayfa zemininde, içerik 8px içeride
 * yuvarlak beyaz kartta, üst bar kartın içinde yapışık. 900px altında kenar çubuğu çekmeceye döner.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch {
      // Depolama yoksa açık başlar
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Tercih yalnız bu oturumda kalır
      }
      return next;
    });
  }, []);

  // Sayfa değişince mobil çekmece kapanır
  useEffect(() => setMobileOpen(false), [pathname]);

  // ⌘K / Ctrl+K komut paleti · ⌘\ / Ctrl+\ kenar çubuğu · Esc çekmeceyi kapatır (DESIGN.md §30)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        toggleCollapsed();
      } else if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleCollapsed]);

  return (
    // print: rapor yazdırılırken yalnızca sayfa içeriği basılır (tema kenar çubuğu ve üst barı gizler)
    <div className="bz-shell bz-shell--inset print:block print:p-0">
      {/* Örtü kenar çubuğundan önce gelir: ikisi de --bz-z-overlay katmanında, çekmece üstte kalır */}
      {mobileOpen ? (
        <div className="bz-scrim min-[900px]:hidden" aria-hidden="true" onClick={() => setMobileOpen(false)} />
      ) : null}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="bz-shell__main print:min-h-0 print:rounded-none print:border-0 print:shadow-none">
        <Topbar onOpenMobileNav={() => setMobileOpen(true)} onOpenPalette={() => setPaletteOpen(true)} />
        <main className="bz-shell__content px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-10 print:p-0">
          <div className="mx-auto w-full max-w-[var(--bz-content-max)]">{children}</div>
        </main>
      </div>

      <AnimatePresence>
        {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
      </AnimatePresence>
      {/* AI asistan sayfasında yüzen asistan düğmesi aynı sohbeti açacağı için gösterilmez */}
      {pathname !== "/ai-chat" ? (
        <div className="bz-no-print">
          <AiChatDock />
        </div>
      ) : null}
    </div>
  );
}
