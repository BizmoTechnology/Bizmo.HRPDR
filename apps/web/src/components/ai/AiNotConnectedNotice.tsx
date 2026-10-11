"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Unplug } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/roles";

/**
 * AI entegrasyonu bağlı değilken AI gerektiren her özellikte gösterilir.
 * Sahte (mock) sonuç üretilmez; yönetici AI Yapılandırma sayfasına yönlendirilir.
 */
export function AiNotConnectedNotice({
  feature,
  hint,
  className,
}: {
  /** Kullanılamayan özellik, ör. "AI analizi" */
  feature: string;
  /** Varsayılan yönlendirme cümlesinin yerine (ör. yapılandırma sayfasının kendisinde) */
  hint?: ReactNode;
  className?: string;
}) {
  const { canConfigureAi } = usePermissions();

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left",
        className,
      )}
    >
      <Unplug className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground">AI entegrasyonu bağlı değil</p>
        <p className="text-xs text-muted-foreground">
          {feature} şu anda kullanılamıyor.{" "}
          {hint ?? (canConfigureAi ? (
            <>
              <Link href="/ai-config" className="font-medium text-primary hover:underline">
                AI Yapılandırma
              </Link>{" "}
              sayfasından bir sağlayıcı bağlayın.
            </>
          ) : (
            "Bir yöneticiden AI entegrasyonunu bağlamasını isteyin."
          ))}
        </p>
      </div>
    </div>
  );
}
