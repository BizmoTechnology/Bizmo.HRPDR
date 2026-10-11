import { glyphSvg, APP_HUES } from "@bizmo/theme/icons";
import { cn } from "@/lib/utils";

/** PotansiyelHaritası uygulama simgesi: Bizmo "team" glifi ve tonu (DESIGN.md §6.3) — yönetim panelindeki AppMark ile aynı */
const MARK_SVG = glyphSvg("team");

export function AppMark({ size, className }: { size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      className={cn("bz-app-icon", size === "sm" && "bz-app-icon--sm", size === "lg" && "bz-app-icon--lg", className)}
      style={{ "--h": APP_HUES.team } as React.CSSProperties}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: MARK_SVG }}
    />
  );
}
