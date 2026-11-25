import { api } from "@/lib/api";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export interface AuthModeInfo {
  mode: "local" | "hybrid" | "central";
  /** "super_admin": merkezi modda şifreli giriş yalnız acil durum içindir */
  localLogin: "all" | "super_admin";
  bizmoId: {
    /** Mod local değil (entegrasyon açılmak istenmiş) */
    enabled: boolean;
    /** Zorunlu ayarlar tamam */
    configured: boolean;
    /** Bizmo.ID şu anda erişilebilir */
    available: boolean;
    portal: boolean;
  };
}

/** Uç yanıt vermezse yerel girişe düşülür (giriş ekranı hiçbir zaman kilitlenmez) */
export async function fetchAuthMode(): Promise<AuthModeInfo | null> {
  try {
    const res = await api.get("/api/auth/mode", { timeout: 6_000 });
    return res.data.data as AuthModeInfo;
  } catch {
    return null;
  }
}

/** Bizmo.ID girişini başlatan adres (tarayıcı üst düzeyde yönlenir) */
export function bizmoIdLoginUrl(opts: { returnTo?: string | null; rememberMe?: boolean }): string {
  const params = new URLSearchParams({ app: "admin" });
  if (opts.returnTo) params.set("returnTo", opts.returnTo);
  if (opts.rememberMe) params.set("rememberMe", "1");
  return `${API_BASE}/api/auth/bizmo-id/login?${params.toString()}`;
}

/**
 * Bizmo.ID oturumunu da kapatır: sunucu çıkış adresini (end_session) verir, tarayıcı oraya
 * gider ve Bizmo.ID giriş ekranına döner. Oturum Bizmo.ID ile açılmadıysa null döner.
 */
export async function bizmoIdLogoutUrl(force: boolean): Promise<string | null> {
  try {
    const res = await api.post("/api/auth/bizmo-id/logout", { app: "admin", force });
    const url = res.data?.data?.url;
    return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
  } catch {
    return null;
  }
}
