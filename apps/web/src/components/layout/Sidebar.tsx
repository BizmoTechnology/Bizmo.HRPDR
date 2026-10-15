"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { ROLE_LABELS } from "@ph/shared";
import { AppMark } from "./AppMark";
import { navIsActive, useVisibleNavSections } from "./nav";

function initialsOf(name?: string | null) {
  if (!name) return "PH";
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toLocaleUpperCase("tr-TR") || "PH";
}

/**
 * Bizmo kenar çubuğu (DESIGN.md §9.2): içe gömülü kabukta zeminsiz; açık 264px, ray 72px,
 * 900px altında çekmece. Etkin öğe kabartılmış hap + yeşil ikon.
 */
export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const orgName = user?.organization?.name ?? "Organizasyon";
  const sections = useVisibleNavSections();

  return (
    <aside
      id="app-sidebar"
      className="bz-sidebar"
      data-collapsed={collapsed ? "true" : "false"}
      data-mobile-open={mobileOpen ? "true" : "false"}
      aria-label="Ana menü"
    >
      <div className="bz-sidebar__header">
        <AppMark />
        <span className="bz-sidebar__brand">PotansiyelHaritası</span>
        {/* Masaüstü: daralt · mobil çekmece: kapat */}
        <button
          type="button"
          className="bz-icon-btn bz-icon-btn--sm bz-sidebar__toggle bz-sidebar__hide-collapsed max-[899px]:hidden"
          onClick={onToggleCollapsed}
          aria-label="Kenar çubuğunu daralt"
          title="Kenar çubuğunu daralt (Ctrl+\)"
        >
          <PanelLeftClose />
        </button>
        <button
          type="button"
          className="bz-icon-btn bz-icon-btn--sm ml-auto min-[900px]:hidden"
          onClick={onCloseMobile}
          aria-label="Menüyü kapat"
        >
          <X />
        </button>
      </div>

      {/* Tek organizasyon: seçici değil, bilgi kartı */}
      <div className="bz-org-switch bz-sidebar__hide-collapsed cursor-default" title={orgName}>
        <span className="bz-avatar bz-avatar--sm" aria-hidden="true">
          {initialsOf(orgName)}
        </span>
        <span className="bz-org-switch__text">
          <span>{orgName}</span>
          <span>Organizasyon</span>
        </span>
      </div>

      <div className="bz-sidebar__scroll">
        {sections.map((section) => (
          <nav key={section.title} className="bz-sidebar__section" aria-label={section.title}>
            <div className="bz-sidebar__section-title">{section.title}</div>
            <div className="bz-sidebar__nav">
              {section.items.map((item) => {
                const active = navIsActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="bz-nav-item"
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={onCloseMobile}
                  >
                    <Icon aria-hidden="true" />
                    <span className="bz-nav-item__label">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>
        ))}
      </div>

      <div className="bz-sidebar__footer">
        {collapsed ? (
          <button
            type="button"
            className="bz-nav-item max-[899px]:hidden"
            onClick={onToggleCollapsed}
            aria-label="Kenar çubuğunu genişlet"
            title="Kenar çubuğunu genişlet (Ctrl+\)"
          >
            <PanelLeftOpen aria-hidden="true" />
          </button>
        ) : null}
        <Link
          href="/settings"
          className="bz-sidebar__user"
          title={collapsed ? user?.name ?? "Profil" : undefined}
          onClick={onCloseMobile}
        >
          <span className="bz-avatar" aria-hidden="true">
            {initialsOf(user?.name)}
          </span>
          <span className="bz-sidebar__user-text">
            <span>{user?.name ?? "Kullanıcı"}</span>
            <span>{user ? ROLE_LABELS[user.role] : ""}</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
