import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { hashToken, tokenMatchesHash } from "../../lib/crypto.js";
import type { SsoApp } from "./config.js";
import { SsoError } from "./accounts.js";
import { randomToken } from "./oidc.js";

/**
 * Giriş akışı kaydı (SsoLoginFlow):
 *  login     → state, nonce, PKCE doğrulayıcısı ve tarayıcı bağlama değeri üretilir (10 dk)
 *  callback  → state tek kullanımlık tüketilir; satır devir koduna (60 sn) dönüşür
 *  exchange  → uygulama devir kodunu (aynı tarayıcıdan) kendi oturum token'larıyla değiştirir
 *
 * Tarayıcıya yalnız rastgele değerler gider; veritabanında state, bağlama ve devir kodunun
 * yalnız SHA-256 özetleri durur.
 */

export const FLOW_TTL_MS = 10 * 60 * 1000;
export const HANDOFF_TTL_MS = 60 * 1000;

export interface StartedFlow {
  state: string;
  nonce: string;
  codeVerifier: string;
  binding: string;
}

export async function startFlow(opts: {
  app: SsoApp;
  returnTo: string;
  rememberMe: boolean;
}): Promise<StartedFlow> {
  // Süresi dolmuş akışları temizle (en fazla birkaç satır; istek beklemez)
  void prisma.ssoLoginFlow
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => undefined);

  const flow: StartedFlow = {
    state: randomToken(32),
    nonce: randomToken(24),
    codeVerifier: randomToken(48),
    binding: randomToken(32),
  };
  await prisma.ssoLoginFlow.create({
    data: {
      stateHash: hashToken(flow.state),
      bindingHash: hashToken(flow.binding),
      nonce: flow.nonce,
      codeVerifier: flow.codeVerifier,
      app: opts.app,
      returnTo: opts.returnTo,
      rememberMe: opts.rememberMe,
      expiresAt: new Date(Date.now() + FLOW_TTL_MS),
    },
  });
  return flow;
}

export interface ClaimedFlow {
  id: string;
  app: SsoApp;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  rememberMe: boolean;
  /** Uygulamaya verilecek tek kullanımlık devir kodu (henüz etkin değil) */
  handoff: string;
}

/** Callback girişi: state'in kaydını (bilinmiyorsa null) okur; tüketmez */
export async function peekFlowApp(state: string | undefined): Promise<SsoApp | null> {
  if (!state) return null;
  const row = await prisma.ssoLoginFlow.findUnique({
    where: { stateHash: hashToken(state) },
    select: { app: true },
  });
  return row?.app === "portal" || row?.app === "admin" ? row.app : null;
}

/**
 * State'i tek kullanımlık tüketir ve devir kodunu ayırır. Tarayıcı bağlama çerezi akışı
 * başlatan tarayıcıyla eşleşmelidir (giriş CSRF'si / çalınan callback adresi).
 */
export async function claimFlow(state: string, binding: string | undefined): Promise<ClaimedFlow> {
  const row = await prisma.ssoLoginFlow.findUnique({ where: { stateHash: hashToken(state) } });
  if (!row || row.handoffHash || row.expiresAt < new Date()) {
    throw new SsoError("INVALID_FLOW", "Giriş akışı bulunamadı, kullanıldı ya da süresi doldu");
  }
  if (!binding || !tokenMatchesHash(binding, row.bindingHash)) {
    await prisma.ssoLoginFlow.deleteMany({ where: { id: row.id } });
    throw new SsoError("INVALID_FLOW", "Giriş akışı bu tarayıcıda başlatılmadı");
  }
  const handoff = randomToken(32);
  const res = await prisma.ssoLoginFlow.updateMany({
    where: { id: row.id, handoffHash: null },
    data: { handoffHash: hashToken(handoff), expiresAt: new Date(Date.now() + HANDOFF_TTL_MS) },
  });
  if (res.count !== 1) throw new SsoError("INVALID_FLOW", "Giriş akışı zaten kullanıldı");
  return {
    id: row.id,
    app: row.app === "portal" ? "portal" : "admin",
    nonce: row.nonce,
    codeVerifier: row.codeVerifier,
    returnTo: row.returnTo,
    rememberMe: row.rememberMe,
    handoff,
  };
}

/** Kimlik doğrulandı: devir kodunu eşlenen hesapla etkinleştirir */
export async function completeFlow(
  id: string,
  subjectId: string,
  idToken: string,
  authMeta: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.ssoLoginFlow.update({
    where: { id },
    // PKCE doğrulayıcısı ve nonce artık gerekmez
    data: { subjectId, idToken, authMeta, codeVerifier: "", nonce: "" },
  });
}

export async function discardFlow(id: string): Promise<void> {
  await prisma.ssoLoginFlow.deleteMany({ where: { id } });
}

export interface RedeemedHandoff {
  app: SsoApp;
  subjectId: string;
  returnTo: string;
  rememberMe: boolean;
  idToken: string | null;
}

/** Devir kodunu tek kullanımlık tüketir (aynı tarayıcı, aynı uygulama, 60 sn) */
export async function redeemHandoff(
  handoff: string,
  binding: string | undefined,
  app: SsoApp,
): Promise<RedeemedHandoff> {
  const row = await prisma.ssoLoginFlow.findUnique({ where: { handoffHash: hashToken(handoff) } });
  if (!row || !row.subjectId || row.expiresAt < new Date() || row.app !== app) {
    throw new SsoError("INVALID_FLOW", "Devir kodu geçersiz veya süresi doldu");
  }
  if (!binding || !tokenMatchesHash(binding, row.bindingHash)) {
    await prisma.ssoLoginFlow.deleteMany({ where: { id: row.id } });
    throw new SsoError("INVALID_FLOW", "Devir kodu bu tarayıcıya ait değil");
  }
  const res = await prisma.ssoLoginFlow.deleteMany({ where: { id: row.id } });
  if (res.count !== 1) throw new SsoError("INVALID_FLOW", "Devir kodu zaten kullanıldı");
  return {
    app,
    subjectId: row.subjectId,
    returnTo: row.returnTo,
    rememberMe: row.rememberMe,
    idToken: row.idToken,
  };
}
