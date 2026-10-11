"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, LogOut, Menu, Moon, Search, Sun, User } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@ph/ui";
import { ROLE_LABELS } from "@ph/shared";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth.store";
import { api } from "@/lib/api";
import { useNotificationList, useMarkNotificationRead } from "@/hooks/use-api";
import { findNavItem } from "./nav";

const SUB_PAGE_LABELS: Record<string, string> = { new: "Yeni" };

function useBreadcrumbs() {
  const pathname = usePathname();
  return useMemo(() => {
    const found = findNavItem(pathname);
    if (!found) return [] as { label: string; href?: string }[];
    const crumbs: { label: string; href?: string }[] = [
      { label: found.section.title },
      { label: found.item.label, href: found.item.href },
    ];
    const rest = pathname.slice(found.item.href.length).split("/").filter(Boolean);
    if (rest.length > 0) crumbs.push({ label: SUB_PAGE_LABELS[rest[0]!] ?? "Ayrıntı" });
    return crumbs;
  }, [pathname]);
}

function useIsMac() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return mac;
}

const menuMotion = {
  initial: { opacity: 0, y: -4, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.16, ease: [0.25, 0.46, 0.45, 0.94] },
} as const;

/** Bizmo üst bar (DESIGN.md §9.1): menü düğmesi · iz | arama (komut paleti) | tema, bildirim, avatar */
export function Topbar({
  onOpenMobileNav,
  onOpenPalette,
}: {
  onOpenMobileNav: () => void;
  onOpenPalette: () => void;
}) {
  const isMac = useIsMac();
  const router = useRouter();
  const crumbs = useBreadcrumbs();
  const { resolved, setTheme } = useTheme();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const notifParams = useMemo(() => ({ pageSize: 8 }), []);
  const { data: notifBundle, isLoading: notifLoading } = useNotificationList(notifParams, {
    select: (data) => ({
      previewItems: data.items,
      unreadCount: data.items.reduce((acc, n) => acc + (n.readAt ? 0 : 1), 0),
    }),
  });
  const markRead = useMarkNotificationRead();
  const notifPreview = notifBundle?.previewItems ?? [];
  const unreadCount = notifBundle?.unreadCount ?? 0;

  useEffect(() => {
    if (!userMenuOpen && !notifOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userMenuOpen, notifOpen]);

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Hata olsa bile yerel oturumu temizle
    }
    clearAuth();
    toast.success("Oturumunuz kapatıldı");
    router.push("/login");
  };

  const initials = user
    ? `${user.name.split(" ")[0]?.[0] ?? ""}${user.name.split(" ")[1]?.[0] ?? ""}`.toLocaleUpperCase("tr-TR")
    : "PH";
  const dark = resolved === "dark";

  return (
    <header className="bz-topbar">
      <div className="bz-topbar__start">
        <button
          type="button"
          className="bz-icon-btn min-[900px]:hidden"
          onClick={onOpenMobileNav}
          aria-label="Menüyü aç"
          aria-controls="app-sidebar"
        >
          <Menu />
        </button>
        <span className="bz-topbar__sep min-[900px]:hidden" aria-hidden="true" />
        {crumbs.length > 0 ? (
          <nav aria-label="Konum" className="min-w-0">
            <ol className="bz-breadcrumbs">
              {crumbs.map((c, i) => {
                const last = i === crumbs.length - 1;
                return (
                  <li key={`${c.label}-${i}`} aria-current={last ? "page" : undefined}>
                    {c.href && !last ? <Link href={c.href}>{c.label}</Link> : c.label}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
      </div>

      <div className="bz-topbar__center">
        <button type="button" className="bz-search w-full cursor-pointer text-left" onClick={onOpenPalette}>
          <Search className="h-4 w-4 flex-none" aria-hidden="true" />
          <span className="flex-1 truncate text-[13.5px]">Sayfa veya özellik arayın</span>
          <kbd className="bz-kbd">{isMac ? "⌘K" : "Ctrl K"}</kbd>
        </button>
      </div>

      <div className="bz-topbar__end">
        <button
          type="button"
          className="bz-icon-btn topbar-search-icon"
          onClick={onOpenPalette}
          aria-label="Ara"
          title="Ara"
        >
          <Search />
        </button>

        <button
          type="button"
          className="bz-icon-btn"
          onClick={() => setTheme(dark ? "light" : "dark")}
          aria-label={dark ? "Açık temaya geç" : "Koyu temaya geç"}
          title={dark ? "Açık tema" : "Koyu tema"}
        >
          {dark ? <Sun /> : <Moon />}
        </button>

        <div className="relative">
          <button
            type="button"
            className="bz-icon-btn"
            onClick={() => {
              setNotifOpen((v) => !v);
              setUserMenuOpen(false);
            }}
            aria-expanded={notifOpen}
            aria-haspopup="menu"
            aria-label={unreadCount > 0 ? `Bildirimler, ${unreadCount} okunmamış` : "Bildirimler"}
            title="Bildirimler"
          >
            <Bell />
            {unreadCount > 0 ? (
              <span className="bz-badge bz-badge--anchor" aria-hidden="true">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </button>

          <AnimatePresence>
            {notifOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <motion.div
                  {...menuMotion}
                  className="bz-menu absolute right-0 top-full mt-2 w-[min(calc(100vw-1rem),22rem)] origin-top-right p-0"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-divider px-4 py-3">
                    <span className="font-display text-[15px] font-bold">Bildirimler</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        router.push("/settings#bildirimler");
                      }}
                      className="bz-btn bz-btn--ghost bz-btn--sm"
                    >
                      Tümü
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-1.5">
                    {notifLoading ? (
                      <div className="flex justify-center py-8">
                        <span className="bz-spinner" aria-label="Yükleniyor" />
                      </div>
                    ) : notifPreview.length === 0 ? (
                      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                        Bildirim yok. Yeni bildirimler burada görünür.
                      </p>
                    ) : (
                      notifPreview.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            if (!n.readAt) markRead.mutate(n.id);
                            setNotifOpen(false);
                            router.push("/settings#bildirimler");
                          }}
                          className="bz-menu-item items-start gap-3 cursor-pointer"
                        >
                          <span
                            className={cn("bz-dot mt-1.5", !n.readAt ? "bz-dot--success" : "opacity-40")}
                            aria-label={n.readAt ? undefined : "Okunmadı"}
                          />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate", !n.readAt && "font-semibold")}>{n.title}</span>
                            {n.body ? (
                              <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                            ) : null}
                            <span className="mt-1 block text-[11px] text-muted-foreground tabular-nums">
                              {new Date(n.createdAt).toLocaleString("tr-TR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button
            type="button"
            className="rounded-full"
            onClick={() => {
              setUserMenuOpen((v) => !v);
              setNotifOpen(false);
            }}
            aria-expanded={userMenuOpen}
            aria-haspopup="menu"
            aria-label="Kullanıcı menüsü"
          >
            <span className="bz-avatar">{initials}</span>
          </button>

          <AnimatePresence>
            {userMenuOpen ? (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <motion.div
                  {...menuMotion}
                  role="menu"
                  className="bz-menu absolute right-0 top-full mt-2 w-60 origin-top-right"
                >
                  <div className="px-2.5 pb-2 pt-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">{user?.name ?? "Kullanıcı"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user ? ROLE_LABELS[user.role] : ""}
                      {user?.organization?.name ? ` · ${user.organization.name}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                  <div className="bz-menu-sep" />
                  <button
                    type="button"
                    role="menuitem"
                    className="bz-menu-item cursor-pointer"
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push("/settings");
                    }}
                  >
                    <User />
                    Profil ve ayarlar
                  </button>
                  <div className="bz-menu-sep" />
                  <button
                    type="button"
                    role="menuitem"
                    className="bz-menu-item bz-menu-item--danger cursor-pointer"
                    onClick={handleLogout}
                  >
                    <LogOut />
                    Çıkış yap
                  </button>
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
