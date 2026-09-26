"use client";

import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, ClipboardList, FileQuestion, BarChart3,
  FileText, Settings, BrainCircuit, Building2, ChevronLeft, ChevronsLeft,
  Menu, X, ChevronRight, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/roles";
import { useAuthStore } from "@/store/auth.store";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: NavItem[];
  /** Menü öğesini yalnızca yetkili rollere göster (sunucu da ayrıca denetler) */
  requires?: "analyze" | "aiConfig";
}

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Genel",
    items: [
      { label: "Pano", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Yönetim",
    items: [
      { label: "Personel", href: "/personnel", icon: Users },
      { label: "Değerlendirmeler", href: "/assessments", icon: ClipboardList },
      { label: "Soru Setleri", href: "/question-sets", icon: FileQuestion },
    ],
  },
  {
    title: "Analiz",
    items: [
      { label: "Analitik", href: "/analytics", icon: BarChart3 },
      { label: "Raporlar", href: "/reports", icon: FileText, requires: "analyze" },
      { label: "AI Asistan", href: "/ai-chat", icon: Sparkles },
    ],
  },
  {
    title: "Sistem",
    items: [
      { label: "AI Yapılandırma", href: "/ai-config", icon: BrainCircuit, requires: "aiConfig" },
      { label: "Ayarlar", href: "/settings", icon: Settings },
    ],
  },
];

function navIsActive(pathname: string, href?: string) {
  return href ? pathname === href || pathname.startsWith(href + "/") : false;
}

function SidebarNavLink({
  item,
  collapsed,
  inMobile,
  expandedGroups,
  setExpandedGroups,
  pathname,
}: {
  item: NavItem;
  collapsed: boolean;
  inMobile: boolean;
  expandedGroups: string[];
  setExpandedGroups: Dispatch<SetStateAction<string[]>>;
  pathname: string;
}) {
  const active = navIsActive(pathname, item.href);
  const hasChildren = item.children && item.children.length > 0;
  const expanded = expandedGroups.includes(item.label);

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() =>
            setExpandedGroups((prev) =>
              expanded
                ? prev.filter((g) => g !== item.label)
                : [...prev, item.label]
            )
          }
          className={cn(
            "relative w-full flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 px-3 py-2.5",
            "text-muted-foreground hover:bg-accent hover:text-foreground",
            collapsed && !inMobile && "justify-center px-0 py-2.5"
          )}
        >
          <item.icon
            className={cn(
              "h-[18px] w-[18px] flex-shrink-0",
              active && "fill-primary/20 text-primary"
            )}
          />
          {(!collapsed || inMobile) && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  expanded && "rotate-90"
                )}
              />
            </>
          )}
        </button>
        {(!collapsed || inMobile) && (
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden ml-5 pl-3 border-l border-border/50 space-y-0.5 py-1"
              >
                {item.children!.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href!}
                    className={cn(
                      "flex items-center gap-2 rounded-lg text-[13px] font-medium px-2.5 py-2 transition-all",
                      navIsActive(pathname, child.href)
                        ? "text-primary bg-primary/5"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <child.icon className="h-3.5 w-3.5 flex-shrink-0" />
                    {child.label}
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href!}
      className={cn(
        "relative flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 px-3 py-2.5",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        collapsed && !inMobile && "justify-center px-0 py-2.5"
      )}
      title={collapsed && !inMobile ? item.label : undefined}
    >
      <item.icon
        className={cn(
          "h-[18px] w-[18px] flex-shrink-0",
          active && "fill-primary/20"
        )}
      />
      {(!collapsed || inMobile) && <span>{item.label}</span>}
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 w-[3px] h-6 bg-primary rounded-r-full"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
    </Link>
  );
}

function SidebarNavSections({
  collapsed,
  inMobile,
  expandedGroups,
  setExpandedGroups,
  pathname,
}: {
  collapsed: boolean;
  inMobile: boolean;
  expandedGroups: string[];
  setExpandedGroups: Dispatch<SetStateAction<string[]>>;
  pathname: string;
}) {
  const { canAnalyze, canConfigureAi } = usePermissions();
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !item.requires ||
        (item.requires === "analyze" && canAnalyze) ||
        (item.requires === "aiConfig" && canConfigureAi),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="py-4 px-3 space-y-3 overflow-y-auto flex-1 scrollbar-none">
      {visibleGroups.map((group) => (
        <div key={group.title}>
          {(!collapsed || inMobile) && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-3 mb-1">
              {group.title}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((navItem) => (
              <SidebarNavLink
                key={navItem.label}
                item={navItem}
                collapsed={collapsed}
                inMobile={inMobile}
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
                pathname={pathname}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function GlassSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const pathname = usePathname();
  const organizationName = useAuthStore((s) => s.user?.organization?.name);

  // Mobil menü bir bağlantıya tıklanınca (sayfa değişince) kapansın
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed");
    if (stored) setCollapsed(stored === "true");
  }, []);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebarCollapsed", String(next));
  };

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 glass-surface-static border-r border-border/50 flex-shrink-0 transition-all duration-300",
          collapsed ? "w-[68px]" : "w-[260px]"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center h-16 px-3 border-b border-border/30",
            collapsed ? "justify-center" : "gap-2.5"
          )}
        >
          <div className="h-[48px] w-[48px] rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base select-none">PH</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight truncate">
                  PotansiyelHaritası
                </p>
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground transition-colors flex-shrink-0"
                title="Menüyü daralt"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>
            </>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="absolute -right-3 top-14 h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center shadow-sm hover:bg-accent transition-colors"
              title="Menüyü genişlet"
            >
              <ChevronLeft className="h-3 w-3 rotate-180" />
            </button>
          )}
        </div>

        {/* Org Seçici */}
        {!collapsed && (
          <div className="px-3 mb-2 pt-2">
            <div className="w-full rounded-xl px-2.5 py-2.5 flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold leading-tight truncate text-foreground">
                  {organizationName ?? "Organizasyon"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Organizasyon
                </p>
              </div>
            </div>
            <div className="h-px bg-border/50 mx-0 mt-2" />
          </div>
        )}

        <SidebarNavSections
          collapsed={collapsed}
          inMobile={false}
          expandedGroups={expandedGroups}
          setExpandedGroups={setExpandedGroups}
          pathname={pathname}
        />
      </aside>

      {/* ── Mobile Trigger ── */}
      <button
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl glass-surface-static"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5 text-muted-foreground" />
      </button>

      {/* ── Mobile Overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 bottom-0 w-[280px] glass-surface-static z-50 rounded-none flex flex-col lg:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
            >
              <div className="flex items-center h-16 px-4 border-b border-border/30 gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-white font-bold text-xs">PH</span>
                </div>
                <span className="font-bold text-sm text-foreground flex-1">
                  PotansiyelHaritası
                </span>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <SidebarNavSections
                collapsed={false}
                inMobile
                expandedGroups={expandedGroups}
                setExpandedGroups={setExpandedGroups}
                pathname={pathname}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
