import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { type BizmoIdConfig, redirectUri } from "./config.js";

/**
 * Bizmo.ID (Keycloak) OIDC istemcisi: Authorization Code + PKCE (S256), state, nonce.
 * Token'lar yalnız sunucuda işlenir; tarayıcı Bizmo.ID token'ı görmez.
 */

/** Keycloak'a giden her istek için zaman aşımı */
const HTTP_TIMEOUT_MS = 8_000;
/** Discovery belgesi bu süre önbelleklenir */
const DISCOVERY_TTL_MS = 60 * 60 * 1000;
/**
 * Yalnız asimetrik imzalar: discovery HS256'yı da listeler; istemci sırrıyla imzalanmış
 * (veya alg karışıklığıyla üretilmiş) token kabul edilmez.
 */
export const ALLOWED_ALGS = [
  "RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA",
];
export const ACCESS_ROLE = "access";
export const BACKCHANNEL_LOGOUT_EVENT = "http://schemas.openid.net/event/backchannel-logout";

export class OidcError extends Error {
  constructor(
    public readonly code: "IDP_UNAVAILABLE" | "TOKEN_EXCHANGE_FAILED" | "TOKEN_INVALID",
    message: string,
  ) {
    super(message);
  }
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

interface Provider {
  doc: Discovery;
  keys: JWTVerifyGetKey;
  at: number;
}

let provider: Promise<Provider> | null = null;
let providerAt = 0;
let keysOverride: JWTVerifyGetKey | null = null;

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

async function loadProvider(cfg: BizmoIdConfig): Promise<Provider> {
  let res: Response;
  try {
    res = await fetch(`${cfg.issuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
  } catch {
    throw new OidcError("IDP_UNAVAILABLE", "Bizmo.ID discovery belgesine ulaşılamadı");
  }
  if (!res.ok) throw new OidcError("IDP_UNAVAILABLE", `Bizmo.ID discovery yanıtı ${res.status}`);
  const doc = (await res.json().catch(() => null)) as Partial<Discovery> | null;
  if (!doc?.issuer || !doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
    throw new OidcError("IDP_UNAVAILABLE", "Bizmo.ID discovery belgesi eksik");
  }
  // id_token'daki iss bununla birebir karşılaştırılır (bizmo.mail: "issuer uyuşmuyor")
  if (doc.issuer !== cfg.issuer) {
    throw new OidcError("IDP_UNAVAILABLE", "BIZMO_ID_ISSUER discovery'deki issuer ile aynı değil");
  }
  // Uç noktalar issuer ile aynı kökte olmalı (discovery yanıtı başka sunucuya yönlendiremesin)
  for (const url of [doc.authorization_endpoint, doc.token_endpoint, doc.jwks_uri, doc.end_session_endpoint]) {
    if (url && !sameOrigin(url, cfg.issuer)) {
      throw new OidcError("IDP_UNAVAILABLE", "Bizmo.ID uç noktası issuer ile aynı kökte değil");
    }
  }
  const keys =
    keysOverride ??
    createRemoteJWKSet(new URL(doc.jwks_uri), { timeoutDuration: HTTP_TIMEOUT_MS });
  return { doc: doc as Discovery, keys, at: Date.now() };
}

export function getProvider(cfg: BizmoIdConfig): Promise<Provider> {
  if (!provider || Date.now() - providerAt > DISCOVERY_TTL_MS) {
    providerAt = Date.now();
    provider = loadProvider(cfg).catch((err) => {
      provider = null; // geçici erişim sorununda sonraki istek yeniden dener
      throw err;
    });
  }
  return provider;
}

/** Yalnız testler için: sahte JWKS ve discovery önbelleğini sıfırlama */
export function setOidcTestOverrides(keys: JWTVerifyGetKey | null) {
  keysOverride = keys;
  provider = null;
}

const b64url = (buf: Buffer) => buf.toString("base64url");

export function randomToken(bytes = 32): string {
  return b64url(randomBytes(bytes));
}

export function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

export async function buildAuthorizationUrl(
  cfg: BizmoIdConfig,
  params: { state: string; nonce: string; codeVerifier: string; forceLogin?: boolean },
): Promise<string> {
  const { doc } = await getProvider(cfg);
  const url = new URL(doc.authorization_endpoint);
  const search = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: redirectUri(cfg),
    // Ek veri kapsamları (bizmo.org) Bizmo.ID panelinde istemcinin varsayılan kapsamlarıdır
    scope: "openid profile email",
    state: params.state,
    nonce: params.nonce,
    code_challenge: pkceChallenge(params.codeVerifier),
    code_challenge_method: "S256",
  });
  // Ortak cihaz (kiosk) güvenliği: önceki kişinin Bizmo.ID SSO oturumu şifresiz giriş vermesin
  if (params.forceLogin) {
    search.set("prompt", "login");
    search.set("max_age", "0");
  }
  url.search = search.toString();
  return url.toString();
}

export interface TokenSet {
  idToken: string;
  accessToken: string | null;
}

export async function exchangeCode(
  cfg: BizmoIdConfig,
  code: string,
  codeVerifier: string,
): Promise<TokenSet> {
  const { doc } = await getProvider(cfg);
  // client_secret_basic: RFC 6749 §2.3.1 gereği kimlik ve sır form-url kodlanır
  const basic = Buffer.from(
    `${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`,
  ).toString("base64");
  let res: Response;
  try {
    res = await fetch(doc.token_endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri(cfg),
        code_verifier: codeVerifier,
      }).toString(),
    });
  } catch {
    throw new OidcError("IDP_UNAVAILABLE", "Bizmo.ID token ucuna ulaşılamadı");
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !body) {
    // Yalnız OAuth hata kodu loglanır (gövde sır içermez ama gereksiz veri de taşınmaz)
    const err = typeof body?.["error"] === "string" ? body["error"] : `HTTP ${res.status}`;
    throw new OidcError("TOKEN_EXCHANGE_FAILED", `Token değişimi başarısız: ${err}`);
  }
  if (typeof body["id_token"] !== "string") {
    throw new OidcError("TOKEN_EXCHANGE_FAILED", "Token yanıtında id_token yok");
  }
  return {
    idToken: body["id_token"],
    accessToken: typeof body["access_token"] === "string" ? body["access_token"] : null,
  };
}

export type IdClaims = JWTPayload & {
  sub: string;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  azp?: string;
  sid?: string;
  acr?: string;
  amr?: string[];
  org?: Record<string, unknown>;
  resource_access?: Record<string, { roles?: unknown }>;
};

/** id_token: imza (JWKS), iss, aud, azp, süre ve nonce */
export async function verifyIdToken(
  cfg: BizmoIdConfig,
  idToken: string,
  expectedNonce: string,
): Promise<IdClaims> {
  const { doc, keys } = await getProvider(cfg);
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: doc.issuer,
      audience: cfg.clientId,
      algorithms: ALLOWED_ALGS,
      maxTokenAge: "10m",
      clockTolerance: 30,
      requiredClaims: ["sub", "iat", "exp"],
    }));
  } catch (err) {
    throw new OidcError("TOKEN_INVALID", `id_token doğrulanamadı: ${(err as Error).message}`);
  }
  if (payload["nonce"] !== expectedNonce) throw new OidcError("TOKEN_INVALID", "nonce eşleşmedi");
  const aud = payload.aud;
  if (Array.isArray(aud) && aud.length > 1 && payload["azp"] !== cfg.clientId) {
    throw new OidcError("TOKEN_INVALID", "azp istemci kimliği değil");
  }
  if (typeof payload.sub !== "string" || !payload.sub) throw new OidcError("TOKEN_INVALID", "sub yok");
  return payload as IdClaims;
}

/**
 * Keycloak erişim token'ı (JWT). Rol eşleyicisi id_token'a yazmadıysa erişim rolü buradan
 * okunur; imza ve issuer yine doğrulanır, token bu istemciye verilmiş olmalı (azp).
 */
export async function verifyAccessToken(
  cfg: BizmoIdConfig,
  accessToken: string,
): Promise<IdClaims | null> {
  const { doc, keys } = await getProvider(cfg);
  try {
    const { payload } = await jwtVerify(accessToken, keys, {
      issuer: doc.issuer,
      algorithms: ALLOWED_ALGS,
      clockTolerance: 30,
    });
    return payload["azp"] === cfg.clientId ? (payload as IdClaims) : null;
  } catch {
    return null;
  }
}

/** Derinlemesine savunma: Keycloak erişimi olmayanı zaten durdurur */
export function hasAppAccess(claims: IdClaims | null, clientId: string): boolean {
  const roles = claims?.resource_access?.[clientId]?.roles;
  return Array.isArray(roles) && roles.includes(ACCESS_ROLE);
}

/** OIDC Back-Channel Logout 1.0 logout_token doğrulaması */
export async function verifyLogoutToken(
  cfg: BizmoIdConfig,
  token: string,
): Promise<{ sub: string | null; sid: string | null }> {
  const { doc, keys } = await getProvider(cfg);
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, keys, {
      issuer: doc.issuer,
      audience: cfg.clientId,
      algorithms: ALLOWED_ALGS,
      maxTokenAge: "5m",
      clockTolerance: 30,
      requiredClaims: ["iat", "jti"],
    }));
  } catch (err) {
    throw new OidcError("TOKEN_INVALID", `logout_token doğrulanamadı: ${(err as Error).message}`);
  }
  const events = payload["events"] as Record<string, unknown> | undefined;
  if (!events || typeof events !== "object" || !(BACKCHANNEL_LOGOUT_EVENT in events)) {
    throw new OidcError("TOKEN_INVALID", "logout_token olay tipi hatalı");
  }
  if ("nonce" in payload) throw new OidcError("TOKEN_INVALID", "logout_token nonce içermemeli");
  const sub = typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  const sid = typeof payload["sid"] === "string" && payload["sid"] ? payload["sid"] : null;
  if (!sub && !sid) throw new OidcError("TOKEN_INVALID", "logout_token sub veya sid içermeli");
  return { sub, sid };
}

/** Bizmo.ID oturumunu da kapatmak için end_session adresi (RP-initiated logout) */
export async function buildEndSessionUrl(
  cfg: BizmoIdConfig,
  postLogoutRedirectUri: string,
  idTokenHint: string | null,
): Promise<string | null> {
  const { doc } = await getProvider(cfg);
  if (!doc.end_session_endpoint) return null;
  const url = new URL(doc.end_session_endpoint);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    post_logout_redirect_uri: postLogoutRedirectUri,
  });
  if (idTokenHint) params.set("id_token_hint", idTokenHint);
  url.search = params.toString();
  return url.toString();
}
