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

  // Tema uyarısı (DESIGN.md: .bz-alert--warning); bağlantı alt çizgili mürekkep rengini temadan alır
  return (
    <div role="status" className={cn("bz-alert bz-alert--warning text-left", className)}>
      <Unplug aria-hidden="true" />
      <div className="min-w-0">
        <p className="bz-alert__title">AI entegrasyonu bağlı değil</p>
        <p>
          {feature} şu anda kullanılamıyor.{" "}
          {hint ?? (canConfigureAi ? (
            <>
              <Link href="/ai-config">AI yapılandırma</Link> sayfasından bir sağlayıcı bağlayın.
            </>
          ) : (
            "Bir yöneticiden AI entegrasyonunu bağlamasını isteyin."
          ))}
        </p>
      </div>
    </div>
  );
}
