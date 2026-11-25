"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { BizmoIdLogo } from "@ph/ui";
import { ssoErrorMessage } from "@ph/shared";
import { cn } from "@/lib/utils";
import { bizmoIdPortalLoginUrl, fetchPortalSso, type PortalSsoInfo } from "@/lib/bizmo-id";

/**
 * Personel portalı "Bizmo.ID ile giriş" bölümü. Yalnız sunucuda BIZMO_ID_PORTAL=true ve
 * Bizmo.ID yapılandırılmışsa görünür; sicil + şifre girişi her zaman yanında kalır.
 * Bizmo.ID her girişte şifre sorar (ortak cihazda önceki kişinin oturumu kullanılamaz).
 */
export function BizmoIdPortalLogin() {
  const [info, setInfo] = useState<PortalSsoInfo | null>(null);
  const [ssoError, setSsoError] = useState<{ code: string; message: string } | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    void fetchPortalSso().then(setInfo);
    const params = new URLSearchParams(window.location.search);
    const code = params.get("sso_error");
    if (code) {
      setSsoError({ code: code.slice(0, 40), message: ssoErrorMessage(code, "portal") ?? "" });
      params.delete("sso_error");
      const rest = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    }
  }, []);

  return (
    <>
      {ssoError && (
        <div role="alert" className="bz-alert bz-alert--danger mt-5">
          <AlertCircle />
          <div>
            <p className="bz-alert__title">Bizmo.ID ile giriş yapılamadı</p>
            <p>{ssoError.message}</p>
            <p className="mt-1 text-xs opacity-80">Destek kodu: SSO-{ssoError.code}</p>
          </div>
        </div>
      )}
      {info?.enabled && (
        <div className="mt-6 space-y-2">
          <a
            href={info.available ? bizmoIdPortalLoginUrl() : undefined}
            role="button"
            aria-label="Bizmo.ID ile giriş yap"
            aria-disabled={info.available ? undefined : true}
            aria-busy={redirecting || undefined}
            onClick={() => info.available && setRedirecting(true)}
            className={cn(
              "bz-btn bz-btn--lg bz-btn--block h-11 gap-2.5",
              !info.available && "pointer-events-none opacity-60",
              redirecting && "is-loading",
            )}
          >
            <BizmoIdLogo title={null} className="h-[22px] w-auto shrink-0" />
            <span>{redirecting ? "Bizmo.ID'ye yönlendiriliyor…" : "ile giriş yap"}</span>
          </a>
          {!info.available && (
            <p className="bz-auth__notice">
              <Info />
              <span>Bizmo.ID'ye şu anda ulaşılamıyor.</span>
            </p>
          )}
          <div className="flex items-center gap-3 pt-3 text-xs text-fg3" aria-hidden="true">
            <span className="h-px flex-1 bg-divider" />
            veya sicil numarası ve şifreyle
            <span className="h-px flex-1 bg-divider" />
          </div>
        </div>
      )}
    </>
  );
}
