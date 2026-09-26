"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Bell,
  Search,
  Sun,
  Moon,
  LogOut,
  User,
  ChevronDown,
  LayoutDashboard,
  Users,
  ClipboardList,
  FileQuestion,
  BarChart3,
  FileText,
  Settings,
  BrainCircuit,
  CornerDownLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { usePermissions } from "@/lib/roles";
import { ROLE_LABELS } from "@ph/shared";
import {
  useNotificationList,
  useMarkNotificationRead,
} from "@/hooks/use-api";

type QuickNavItem = {
  label: string;
  href: string;
  group: string;
  icon: React.ElementType;
  keywords?: string[];
  requires?: "analyze" | "aiConfig";
};

const QUICK_NAV: QuickNavItem[] = [
  {
    label: "Pano",
    href: "/dashboard",
    group: "Genel",
    icon: LayoutDashboard,
    keywords: ["dashboard", "ana", "özet"],
  },
  {
    label: "Personel",
    href: "/personnel",
    group: "Yönetim",
    icon: Users,
    keywords: ["çalışan", "ik"],
  },
  {
    label: "Değerlendirmeler",
    href: "/assessments",
    group: "Yönetim",
    icon: ClipboardList,
    keywords: ["test", "oturum"],
  },
  {
    label: "Soru Setleri",
    href: "/question-sets",
    group: "Yönetim",
    icon: FileQuestion,
    keywords: ["soru", "set"],
  },
  {
    label: "Analitik",
    href: "/analytics",
    group: "Analiz",
    icon: BarChart3,
    keywords: ["istatistik", "grafik"],
  },
  {
    label: "Raporlar",
    href: "/reports",
    group: "Analiz",
    icon: FileText,
    keywords: ["pdf", "çıktı"],
    requires: "analyze",
  },
  {
    label: "AI Asistan",
    href: "/ai-chat",
    group: "Analiz",
    icon: Sparkles,
    keywords: ["sohbet", "chat", "terfi", "amir", "aday"],
  },
  {
    label: "AI Yapılandırma",
    href: "/ai-config",
    group: "Sistem",
    icon: BrainCircuit,
    keywords: ["yapay zeka", "openai", "model"],
    requires: "aiConfig",
  },
  {
    label: "Ayarlar",
    href: "/settings",
    group: "Sistem",
    icon: Settings,
    keywords: ["hesap", "profil", "şifre"],
  },
];

function useIsMac() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(
      typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent),
    );
  }, []);
  return mac;
}

export function GlassTopbar() {
  const isMac = useIsMac();
  const [darkMode, setDarkMode] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQ, setPaletteQ] = useState("");
  const [paletteIndex, setPaletteIndex] = useState(0);
  const paletteInputRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const router = useRouter();

  const queryClient = useQueryClient();
  const notifParams = useMemo(() => ({ pageSize: 8 }), []);
  const { data: notifBundle, isLoading: notifLoading } = useNotificationList(
    notifParams,
    { select: (data) => ({ previewItems: data.items }) },
  );
  // Okunmamış sayısı yalnızca önizlemedeki 8 kayıttan değil, sunucudaki toplamdan gelir
  const unreadParams = useMemo(() => ({ unreadOnly: true, pageSize: 1 }), []);
  const { data: unreadTotal } = useNotificationList(unreadParams, {
    select: (data) => data.total,
    refetchInterval: 60_000,
  });
  const markRead = useMarkNotificationRead();

  const notifPreview = notifBundle?.previewItems;
  const unreadCount = unreadTotal ?? 0;

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored === "dark" || (!stored && prefersDark);
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "theme" || e.newValue == null) return;
      const isDark = e.newValue === "dark";
      setDarkMode(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { canAnalyze, canConfigureAi } = usePermissions();
  const filteredNav = useMemo(() => {
    const allowed = QUICK_NAV.filter(
      (item) =>
        !item.requires ||
        (item.requires === "analyze" && canAnalyze) ||
        (item.requires === "aiConfig" && canConfigureAi),
    );
    const q = paletteQ.trim().toLowerCase();
    if (!q) return allowed;
    return allowed.filter((item) => {
      const hay = [
        item.label,
        item.href,
        item.group,
        ...(item.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [paletteQ, canAnalyze, canConfigureAi]);

  useEffect(() => {
    setPaletteIndex(0);
  }, [paletteQ, paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    const t = window.setTimeout(() => paletteInputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [paletteOpen]);

  const openPalette = useCallback(() => {
    setPaletteQ("");
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteQ("");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteQ("");
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setPaletteQ("");
        setNotifOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPaletteIndex((i) =>
        filteredNav.length ? (i + 1) % filteredNav.length : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPaletteIndex((i) =>
        filteredNav.length
          ? (i - 1 + filteredNav.length) % filteredNav.length
          : 0,
      );
    } else if (e.key === "Enter" && filteredNav[paletteIndex]) {
      e.preventDefault();
      const item = filteredNav[paletteIndex]!;
      router.push(item.href);
      closePalette();
    }
  };

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Hata olsa bile local'i temizle
    }
    clearAuth();
    // Sonraki kullanıcı önbellekteki verileri görmesin
    queryClient.clear();
    toast.success("Oturumunuz kapatıldı");
    router.replace("/login");
  };

  const initials = user
    ? `${user.name.split(" ")[0]?.[0] ?? ""}${user.name.split(" ")[1]?.[0] ?? ""}`.toUpperCase()
    : "PH";

  const shortcutLabel = isMac ? "⌘K" : "Ctrl+K";

  return (
    <>
      <header className="glass-surface-static sticky top-0 z-50 border-b border-border/50 h-14 sm:h-16 px-2 sm:px-4 md:px-6 flex items-center gap-2">
        <div className="w-10 lg:hidden" />

        <button
          type="button"
          onClick={openPalette}
          className="hidden md:flex items-center gap-3 flex-1 max-w-md mx-auto h-9 px-3.5 rounded-xl bg-muted/50 border border-border/40 hover:border-border hover:bg-muted/80 transition-all cursor-pointer group"
        >
          <Search className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          <span className="text-sm text-muted-foreground/60 flex-1 text-left">
            Sayfa veya özellik ara…
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            {shortcutLabel}
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={openPalette}
            className="md:hidden p-2 rounded-xl hover:bg-accent transition-colors"
            aria-label="Ara"
          >
            <Search className="h-4 w-4 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={toggleDark}
            className="p-2 sm:p-2.5 rounded-xl hover:bg-accent transition-colors active:scale-95"
            aria-label={darkMode ? "Açık temaya geç" : "Koyu temaya geç"}
          >
            {darkMode ? (
              <Sun className="h-4 sm:h-[18px] w-4 sm:w-[18px] text-muted-foreground" />
            ) : (
              <Moon className="h-4 sm:h-[18px] w-4 sm:w-[18px] text-muted-foreground" />
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserMenuOpen(false);
              }}
              className="relative p-2 sm:p-2.5 rounded-xl hover:bg-accent transition-colors"
              aria-label="Bildirimler"
            >
              <Bell className="h-4 sm:h-[18px] w-4 sm:w-[18px] text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-3.5 sm:h-4 min-w-3.5 sm:min-w-4 px-0.5 rounded-full bg-destructive ring-2 ring-background flex items-center justify-center">
                  <span className="text-[8px] sm:text-[9px] font-bold text-destructive-foreground tabular-nums leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                </span>
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <motion.div
                    className="absolute right-0 top-full mt-2 w-[min(100vw-1rem,20rem)] sm:w-80 rounded-xl border border-border/50 shadow-lg bg-popover text-popover-foreground z-50 overflow-hidden"
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="px-3 py-2.5 border-b border-border/30 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">Bildirimler</span>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifOpen(false);
                          router.push("/settings#bildirimler");
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Tümü
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : (notifPreview ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8 px-3">
                          Bildirim yok
                        </p>
                      ) : (
                        (notifPreview ?? []).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => {
                              if (!n.readAt) {
                                markRead.mutate(n.id);
                              }
                              setNotifOpen(false);
                              router.push("/settings#bildirimler");
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 border-b border-border/20 last:border-0 hover:bg-accent/80 transition-colors",
                              !n.readAt && "bg-primary/5",
                            )}
                          >
                            <p
                              className={cn(
                                "text-sm line-clamp-1",
                                n.readAt
                                  ? "text-muted-foreground"
                                  : "font-medium text-foreground",
                              )}
                            >
                              {n.title}
                            </p>
                            {n.body ? (
                              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                {n.body}
                              </p>
                            ) : null}
                            <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                              {new Date(n.createdAt).toLocaleString("tr-TR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-accent transition-colors"
            >
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-primary/10 ring-1 ring-border/30 flex items-center justify-center">
                <span className="text-[10px] sm:text-xs font-semibold text-primary">
                  {initials}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "hidden sm:block h-3.5 w-3.5 text-muted-foreground transition-transform",
                  userMenuOpen && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <motion.div
                    className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border/50 shadow-lg bg-popover text-popover-foreground z-50 overflow-hidden"
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="px-4 py-3 border-b border-border/30">
                      <p className="text-sm font-semibold truncate">
                        {user?.name ?? "Kullanıcı"}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user ? ROLE_LABELS[user.role] : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 truncate">
                        {user?.email}
                      </p>
                      {user?.organization?.name ? (
                        <p className="text-[11px] text-muted-foreground/70 truncate mt-1">
                          {user.organization.name}
                        </p>
                      ) : null}
                    </div>
                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/settings");
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-accent transition-colors"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        Profil ve ayarlar
                      </button>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Çıkış Yap
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {paletteOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-[60] bg-foreground/25 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePalette}
            />
            <motion.div
              className="fixed left-1/2 top-[max(4rem,15vh)] z-[70] w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 rounded-2xl border border-border/50 bg-popover shadow-2xl overflow-hidden"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              role="dialog"
              aria-modal="true"
              aria-label="Hızlı gezinme"
            >
              <div className="flex items-center gap-2 px-3 border-b border-border/40">
                <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <input
                  ref={paletteInputRef}
                  value={paletteQ}
                  onChange={(e) => setPaletteQ(e.target.value)}
                  onKeyDown={onPaletteKeyDown}
                  placeholder="Sayfa ara…"
                  className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                />
                <span className="text-[10px] text-muted-foreground hidden sm:inline pr-1">
                  Esc
                </span>
              </div>
              <ul className="max-h-72 overflow-y-auto py-1">
                {filteredNav.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-muted-foreground text-center">
                    Sonuç yok
                  </li>
                ) : (
                  filteredNav.map((item, i) => {
                    const Icon = item.icon;
                    const active = i === paletteIndex;
                    return (
                      <li key={item.href}>
                        <button
                          type="button"
                          onClick={() => {
                            router.push(item.href);
                            closePalette();
                          }}
                          onMouseEnter={() => setPaletteIndex(i)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                            active
                              ? "bg-accent text-foreground"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0 opacity-80" />
                          <span className="flex-1 min-w-0 truncate">
                            {item.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground/70 truncate max-w-[5rem] sm:max-w-[7rem]">
                            {item.group}
                          </span>
                          {active && (
                            <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="px-3 py-2 border-t border-border/40 text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                <span>
                  <kbd className="px-1 rounded bg-muted/80 font-mono">↑</kbd>{" "}
                  <kbd className="px-1 rounded bg-muted/80 font-mono">↓</kbd>{" "}
                  seç
                </span>
                <span>
                  <kbd className="px-1 rounded bg-muted/80 font-mono">
                    Enter
                  </kbd>{" "}
                  git
                </span>
                <span>
                  <kbd className="px-1 rounded bg-muted/80 font-mono">Esc</kbd>{" "}
                  kapat
                </span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
