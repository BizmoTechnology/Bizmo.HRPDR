import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15_000,
});

/** LLM çağrıları uzun sürebilir; bu endpoint'ler için zaman aşımı uzatılır. */
const AI_ENDPOINT =
  /\/(ai-generate|ai-suggest|ai-analysis|messages|list-abacus-models|test)(\?|$)|\/api\/reports\/generate/;
const AI_TIMEOUT_MS = 180_000;

let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

/** Kalıcı oturum bilgisi (auth store, localStorage "ph-auth") var mı? */
function hasSessionHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem("ph-auth")?.includes('"isAuthenticated":true') ?? false;
  } catch {
    return false;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** Oturum yenilenemediğinde çağrılır (ör. auth store'u temizlemek için). */
export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

api.interceptors.request.use(async (config) => {
  // Access token yalnızca bellekte tutulur; sayfa yenilendiğinde ilk istekten önce
  // (paralel sorguların hepsi 401 alıp ayrı ayrı yenilemesin diye) bir kez yenilenir.
  if (!accessToken && hasSessionHint() && !config.url?.includes("/api/auth/")) {
    await refreshAccessToken();
  }
  if (accessToken) {
    config.headers["Authorization"] = `Bearer ${accessToken}`;
  }
  if (config.url && AI_ENDPOINT.test(config.url) && (config.timeout ?? 0) < AI_TIMEOUT_MS) {
    config.timeout = AI_TIMEOUT_MS;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

/** Paralel 401'ler tek bir yenileme isteğini paylaşır. */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true })
    .then(({ data }) => {
      const token: string | undefined = data?.data?.accessToken;
      setAccessToken(token ?? null);
      return token ?? null;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    // Giriş/çıkış/yenileme çağrılarında 401 normal bir sonuçtur (ör. hatalı şifre)
    const isAuthCall = originalRequest?.url?.includes("/api/auth/");

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
      originalRequest._retry = true;

      const token = await refreshAccessToken();
      if (token) {
        originalRequest.headers["Authorization"] = `Bearer ${token}`;
        return api(originalRequest);
      }

      setAccessToken(null);
      onAuthFailure?.();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

/** Sunucunun standart hata gövdesinden kullanıcıya gösterilecek mesaj */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as AxiosError<{ message?: string }>;
  if (e?.response?.status === 403) {
    return e.response.data?.message ?? "Bu işlem için yetkiniz yok";
  }
  return e?.response?.data?.message ?? fallback;
}
