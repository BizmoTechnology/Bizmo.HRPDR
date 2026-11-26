"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, saveSession } from "@/lib/api";
import { exchangePortalCode } from "@/lib/bizmo-id";

/**
 * Bizmo.ID dönüşü (personel portalı): devir kodu (#code=…) aynı tarayıcıdan portal
 * oturumuyla değiştirilir.
 */
export default function PortalBizmoIdCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      router.replace("/login?sso_error=INVALID_FLOW");
      return;
    }

    exchangePortalCode(code)
      .then(({ accessToken, refreshToken, personnel }) => {
        saveSession({ accessToken, refreshToken, personnel });
        toast.success(`Hoş geldiniz, ${personnel.firstName}!`);
        router.replace("/home");
      })
      .catch((err: unknown) => setError(errorMessage(err, "Bizmo.ID ile giriş tamamlanamadı.")));
  }, [router]);

  return (
    <main className="bz-aurora flex min-h-dvh w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px] rounded-3xl border border-glass-border bg-surface p-6 text-center shadow-2 sm:p-8">
        {error ? (
          <>
            <div role="alert" className="bz-alert bz-alert--danger text-left">
              <AlertCircle />
              <div>
                <p className="bz-alert__title">Giriş yapılamadı</p>
                <p>{error}</p>
              </div>
            </div>
            <a href="/login" className="bz-btn bz-btn--primary bz-btn--block mt-5">
              Giriş ekranına dön
            </a>
          </>
        ) : (
          <div role="status" className="flex flex-col items-center gap-3 py-4 text-fg2">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Bizmo.ID ile giriş tamamlanıyor…</p>
          </div>
        )}
      </div>
    </main>
  );
}
