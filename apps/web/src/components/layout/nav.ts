import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileQuestion,
  BarChart3,
  FileText,
  Settings,
  BrainCircuit,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { usePermissions } from "@/lib/roles";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Komut paletinde aramaya katılan ek sözcükler */
  keywords?: string[];
  /** Öğeyi yalnızca yetkili rollere göster (sunucu da ayrıca denetler) */
  requires?: "analyze" | "aiConfig";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Kenar çubuğu, iz (breadcrumb) ve komut paleti aynı listeyi kullanır (DESIGN.md §9.2: en çok 5 bölüm × 7 öğe) */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Genel",
    items: [
      { label: "Pano", href: "/dashboard", icon: LayoutDashboard, keywords: ["dashboard", "ana", "özet"] },
    ],
  },
  {
    title: "Yönetim",
    items: [
      { label: "Personel", href: "/personnel", icon: Users, keywords: ["çalışan", "ik"] },
      { label: "Değerlendirmeler", href: "/assessments", icon: ClipboardList, keywords: ["test", "oturum"] },
      { label: "Soru setleri", href: "/question-sets", icon: FileQuestion, keywords: ["soru", "set"] },
    ],
  },
  {
    title: "Analiz",
    items: [
      { label: "Analitik", href: "/analytics", icon: BarChart3, keywords: ["istatistik", "grafik"] },
      { label: "Raporlar", href: "/reports", icon: FileText, keywords: ["pdf", "çıktı"], requires: "analyze" },
      { label: "AI asistan", href: "/ai-chat", icon: Sparkles, keywords: ["sohbet", "chat", "terfi", "amir", "aday"] },
    ],
  },
  {
    title: "Sistem",
    items: [
      { label: "AI yapılandırma", href: "/ai-config", icon: BrainCircuit, keywords: ["yapay zeka", "openai", "model"], requires: "aiConfig" },
      { label: "Ayarlar", href: "/settings", icon: Settings, keywords: ["hesap", "profil", "şifre"] },
    ],
  },
];

/** Kullanıcının rolüne göre görünür bölümler; boş kalan bölüm gizlenir */
export function useVisibleNavSections(): NavSection[] {
  const { canAnalyze, canConfigureAi } = usePermissions();
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !item.requires ||
        (item.requires === "analyze" && canAnalyze) ||
        (item.requires === "aiConfig" && canConfigureAi),
    ),
  })).filter((section) => section.items.length > 0);
}

export function navIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** Bulunulan sayfanın bölümü ve öğesi; alt sayfalarda (ör. /personnel/123) üst öğe döner */
export function findNavItem(pathname: string): { section: NavSection; item: NavItem } | null {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (navIsActive(pathname, item.href)) return { section, item };
    }
  }
  return null;
}
