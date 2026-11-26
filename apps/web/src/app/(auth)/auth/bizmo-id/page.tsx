"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, apiErrorMessage, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth.store";

/**
 * Bizmo.ID dönüşü: sunucu doğrulamayı yapıp buraya tek kullanımlık devir kodunu adres
 * parçasında (#code=…) gönderir. Kod aynı tarayıcıdan HRPDR oturumuyla değiştirilir.
 */
export default function BizmoIdCallbackPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = hash.get("code");
    // Kod geçmişte ve yer imlerinde kalmasın
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      router.replace("/login?sso_error=INVALID_FLOW");
      return;
    }

    api
      .post("/api/auth/bizmo-id/exchange", { code, app: "admin" })
      .then((res) => {
        const { accessToken, user, returnTo } = res.data.data;
        setAccessToken(accessToken);
        setAuth(user, accessToken, "bizmo-id");
        toast.success(`Hoş geldiniz, ${user.name}!`);
        // Sunucu yalnız uygulama içi yol döndürür
        const target = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : "/dashboard";
        router.replace(target);
      })
      .catch((err: unknown) => {
        setError(apiErrorMessage(err, "Bizmo.ID ile giriş tamamlanamadı."));
      });
  }, [router, setAuth]);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
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
    </div>
  );
}
