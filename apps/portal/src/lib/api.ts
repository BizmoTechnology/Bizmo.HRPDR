import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

export const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

const TOKEN_KEY = "ph_portal_token";
const REFRESH_KEY = "ph_portal_refresh";
const PERSONNEL_KEY = "ph_personnel";

export interface PortalPersonnel {
  id: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  preferredLanguage?: string;
}

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function saveSession(data: {
  accessToken: string;
  refreshToken: string;
  personnel: PortalPersonnel;
}) {
  const s = storage();
  if (!s) return;
  s.setItem(TOKEN_KEY, data.accessToken);
  s.setItem(REFRESH_KEY, data.refreshToken);
  s.setItem(PERSONNEL_KEY, JSON.stringify(data.personnel));
}

export function getPersonnel(): PortalPersonnel | null {
  const raw = storage()?.getItem(PERSONNEL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalPersonnel;
  } catch {
    return null;
  }
}

export function hasToken(): boolean {
  return !!storage()?.getItem(TOKEN_KEY);
}

/** Ortak cihazlarda (kiosk/tablet) bir sonraki kişi önceki oturumu görmesin. */
export function clearSession() {
  const s = storage();
  if (!s) return;
  s.removeItem(TOKEN_KEY);
  s.removeItem(REFRESH_KEY);
  s.removeItem(PERSONNEL_KEY);
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = storage()?.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

/** Aynı anda gelen 401'ler tek bir yenileme isteğini paylaşır. */
function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = storage()?.getItem(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const res = await axios.post(`${API_BASE}/api/auth/portal/refresh`, { refreshToken });
      const accessToken: string | undefined = res.data?.data?.accessToken;
      if (!accessToken) return null;
      storage()?.setItem(TOKEN_KEY, accessToken);
      return accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    // Giriş/yenileme/çıkış çağrılarında 401 normal bir sonuçtur (ör. hatalı şifre);
    // çıkış refresh token ile yapıldığından access token gerektirmez.
    const isAuthCall = /\/api\/auth\/portal\/(login|refresh|logout)(\?|$)/.test(original?.url ?? "");

    if (error.response?.status === 401 && original && !original._retry && !isAuthCall) {
      original._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      clearSession();
      if (typeof window !== "undefined") window.location.replace("/login?expired=1");
    }

    return Promise.reject(error);
  },
);

/** Sunucunun standart hata gövdesinden kullanıcıya gösterilecek mesaj */
export function errorMessage(err: unknown, fallback: string): string {
  const data = (err as AxiosError<{ message?: string }>)?.response?.data;
  if (data?.message) return data.message;
  if ((err as AxiosError)?.code === "ERR_NETWORK") {
    return "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.";
  }
  return fallback;
}

export function errorCode(err: unknown): string | undefined {
  return (err as AxiosError<{ code?: string }>)?.response?.data?.code;
}

/** Portal oturumunu sunucuda da sonlandırır. */
export async function logout() {
  try {
    // Yalnızca bu cihazdaki oturumun refresh token'ı iptal edilir
    await api.post("/api/auth/portal/logout", {
      refreshToken: storage()?.getItem(REFRESH_KEY) ?? undefined,
    });
  } catch {
    // Sunucuya ulaşılamasa da yerel oturum temizlenir
  }
  clearSession();
}
