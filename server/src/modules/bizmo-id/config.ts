/**
 * Bizmo.ID (Keycloak 26, OIDC) yapılandırması.
 * Sözleşme: bizmo.identity/docs/INTEGRATION_GUIDE.md (referans uygulama: bizmo.mail).
 *
 * AUTH_MODE:
 *  - local   (varsayılan) yalnız e-posta/şifre; Bizmo.ID uçları kapalı
 *  - hybrid  "Bizmo.ID ile giriş" + e-posta/şifre
 *  - central yalnız Bizmo.ID; SUPER_ADMIN acil durum için yerel girişi kullanabilir
 *
 * Mod hybrid/central olduğu hâlde zorunlu değerler eksikse sunucu açılır, giriş ekranı
 * "Bizmo.ID bağlı değil" gösterir ve yerel giriş açık kalır (kimse dışarıda kalmaz).
 */

export type AuthMode = "local" | "hybrid" | "central";
export type SsoApp = "admin" | "portal";

export const BIZMO_ID_PROVIDER = "bizmo-id";

export interface BizmoIdConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Bizmo.ID kullanıcılarının bağlanacağı HRPDR kurumu (Organization.slug) */
  orgSlug: string;
  /** API'nin tarayıcıdan görünen kökü; redirect_uri bununla kurulur */
  apiPublicUrl: string;
  appUrl: string;
  portalUrl: string;
  /** Personel portalında "Bizmo.ID ile giriş" */
  portalEnabled: boolean;
  webhookSecret: string | null;
  scimToken: string | null;
  /** Yalnız yerel http Keycloak için (üretimde kapalı olmalı) */
  allowHttp: boolean;
}

export interface BizmoIdStatus {
  mode: AuthMode;
  /** Mod local değil ve tüm zorunlu değerler tanımlı */
  configured: boolean;
  /** Eksik/hatalı ortam değişkenleri (adlar; değerler asla) */
  problems: string[];
  config: BizmoIdConfig | null;
}

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function isHttpUrl(value: string, allowHttp: boolean): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || (allowHttp && u.protocol === "http:");
  } catch {
    return false;
  }
}

export function readAuthMode(): AuthMode {
  const raw = env("AUTH_MODE").toLowerCase();
  return raw === "hybrid" || raw === "central" ? raw : "local";
}

let cached: BizmoIdStatus | null = null;

export function bizmoIdStatus(): BizmoIdStatus {
  if (cached) return cached;
  const mode = readAuthMode();
  const problems: string[] = [];
  const production = env("NODE_ENV") === "production";
  const allowHttp = env("BIZMO_ID_ALLOW_HTTP") === "true";
  if (production && allowHttp) problems.push("BIZMO_ID_ALLOW_HTTP üretimde kullanılamaz");

  const issuer = trimSlash(env("BIZMO_ID_ISSUER"));
  const clientId = env("BIZMO_ID_CLIENT_ID");
  const clientSecret = env("BIZMO_ID_CLIENT_SECRET");
  const orgSlug = env("BIZMO_ID_ORG_SLUG");
  const port = env("PORT") || "3001";
  const apiPublicUrl = trimSlash(env("API_PUBLIC_URL") || (production ? "" : `http://localhost:${port}`));
  const appUrl = trimSlash(env("APP_URL") || "http://localhost:3000");
  const portalUrl = trimSlash(env("PORTAL_URL") || "http://localhost:3002");

  if (mode !== "local") {
    if (!issuer) problems.push("BIZMO_ID_ISSUER tanımlı değil");
    else if (!isHttpUrl(issuer, allowHttp)) problems.push("BIZMO_ID_ISSUER https adresi olmalı");
    if (!clientId) problems.push("BIZMO_ID_CLIENT_ID tanımlı değil");
    if (!clientSecret) problems.push("BIZMO_ID_CLIENT_SECRET tanımlı değil");
    if (!orgSlug) problems.push("BIZMO_ID_ORG_SLUG tanımlı değil");
    if (!apiPublicUrl) problems.push("API_PUBLIC_URL tanımlı değil");
    else if (!isHttpUrl(apiPublicUrl, !production)) problems.push("API_PUBLIC_URL geçerli bir adres değil");
  }

  const configured = mode !== "local" && problems.length === 0;
  cached = {
    mode,
    configured,
    problems,
    config: configured
      ? {
          issuer,
          clientId,
          clientSecret,
          orgSlug,
          apiPublicUrl,
          appUrl,
          portalUrl,
          portalEnabled: env("BIZMO_ID_PORTAL") === "true",
          webhookSecret: env("BIZMO_ID_WEBHOOK_SECRET") || null,
          scimToken: env("BIZMO_ID_SCIM_TOKEN") || null,
          allowHttp,
        }
      : null,
  };
  return cached;
}

/** Yalnız testler için: ortam değiştikten sonra yapılandırmayı yeniden okur */
export function resetBizmoIdConfigForTests() {
  cached = null;
}

export function redirectUri(cfg: BizmoIdConfig): string {
  return `${cfg.apiPublicUrl}/api/auth/bizmo-id/callback`;
}

/** Uygulamanın giriş ekranı (hata ve çıkış dönüşü) */
export function loginPageUrl(cfg: BizmoIdConfig, app: SsoApp): string {
  return `${app === "portal" ? cfg.portalUrl : cfg.appUrl}/login`;
}

/**
 * Giriş sonrası dönülecek yol. Yalnız uygulama içi mutlak yol kabul edilir
 * ("/dashboard?x=1"); şema, "//", ters bölü ve kontrol karakterleri reddedilir
 * (açık yönlendirme olmasın). Geçersizse varsayılan sayfa.
 */
export function safeReturnTo(value: unknown, app: SsoApp): string {
  const fallback = app === "portal" ? "/" : "/dashboard";
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const u = new URL(value, "http://hrpdr.invalid");
    if (u.origin !== "http://hrpdr.invalid") return fallback;
    if (u.pathname.startsWith("/login") || u.pathname.startsWith("/auth/")) return fallback;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return fallback;
  }
}
