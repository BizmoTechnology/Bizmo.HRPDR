import axios from "axios";
import { API_BASE } from "@/lib/api";

/** Bizmo.ID akışı API'nin httpOnly çerezini (tarayıcı bağlama, çıkış ipucu) kullanır */
const sso = axios.create({ baseURL: API_BASE, timeout: 15_000, withCredentials: true });

const IDP_KEY = "ph_portal_idp";

export interface PortalSsoInfo {
  /** Bizmo.ID portal girişi açık ve yapılandırılmış */
  enabled: boolean;
  available: boolean;
}

export async function fetchPortalSso(): Promise<PortalSsoInfo> {
  try {
    const res = await sso.get("/api/auth/mode", { timeout: 6_000 });
    const b = res.data?.data?.bizmoId;
    return { enabled: !!(b?.configured && b?.portal), available: !!b?.available };
  } catch {
    return { enabled: false, available: false };
  }
}

export function bizmoIdPortalLoginUrl(): string {
  return `${API_BASE}/api/auth/bizmo-id/login?app=portal`;
}

export async function exchangePortalCode(code: string) {
  const res = await sso.post("/api/auth/bizmo-id/exchange", { code, app: "portal" });
  window.sessionStorage.setItem(IDP_KEY, "bizmo-id");
  return res.data.data as {
    accessToken: string;
    refreshToken: string;
    personnel: { id: string; employeeId: string; firstName: string; lastName: string; preferredLanguage?: string };
    returnTo?: string;
  };
}

/**
 * Oturum Bizmo.ID ile açıldıysa Bizmo.ID oturumunu da kapatacak adres (end_session).
 * Ortak cihazda (kiosk) sonraki kişi önceki kişinin Bizmo.ID oturumuyla giremesin.
 */
export async function portalBizmoIdLogoutUrl(): Promise<string | null> {
  let viaBizmoId = false;
  try {
    viaBizmoId = window.sessionStorage.getItem(IDP_KEY) === "bizmo-id";
    window.sessionStorage.removeItem(IDP_KEY);
  } catch {
    // sessionStorage yok
  }
  try {
    const res = await sso.post("/api/auth/bizmo-id/logout", { app: "portal", force: viaBizmoId });
    const url = res.data?.data?.url;
    return typeof url === "string" && /^https?:\/\//.test(url) ? url : null;
  } catch {
    return null;
  }
}
