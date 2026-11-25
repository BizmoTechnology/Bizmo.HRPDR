"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { BizmoIdLogo } from "@ph/ui";
import { cn } from "@/lib/utils";
import type { AuthModeInfo } from "@/lib/bizmo-id";

/**
 * "Bizmo.ID ile giriş" düğmesi. Bizmo.ID yapılandırılmamışsa ya da ulaşılamıyorsa düğme
 * pasif kalır ve nedeni yazılır; asla sahte bir giriş yapılmaz.
 */
export function BizmoIdButton({
  info,
  href,
}: {
  info: AuthModeInfo["bizmoId"];
  href: string;
}) {
  const [redirecting, setRedirecting] = useState(false);
  const usable = info.configured && info.available;
  const reason = !info.configured
    ? "Bizmo.ID bağlı değil."
    : !info.available
      ? "Bizmo.ID'ye şu anda ulaşılamıyor."
      : null;

  return (
    <div className="space-y-2">
      <a
        href={usable ? href : undefined}
        role="button"
        aria-disabled={usable ? undefined : true}
        aria-label="Bizmo.ID ile giriş yap"
        aria-describedby={reason ? "bizmo-id-reason" : undefined}
        aria-busy={redirecting || undefined}
        onClick={(e) => {
          if (!usable) {
            e.preventDefault();
            return;
          }
          setRedirecting(true);
        }}
        className={cn(
          "bz-btn bz-btn--lg bz-btn--block gap-2.5",
          !usable && "pointer-events-none opacity-60",
          redirecting && "is-loading",
        )}
      >
        <BizmoIdLogo title={null} className="h-[22px] w-auto shrink-0" />
        <span>{redirecting ? "Bizmo.ID'ye yönlendiriliyor…" : "ile giriş yap"}</span>
      </a>
      {reason && (
        <p id="bizmo-id-reason" className="bz-auth__notice">
          <Info />
          <span>{reason}</span>
        </p>
      )}
    </div>
  );
}
