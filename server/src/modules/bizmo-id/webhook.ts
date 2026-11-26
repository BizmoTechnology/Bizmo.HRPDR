import { createHmac, timingSafeEqual } from "node:crypto";
import type { BizmoIdConfig } from "./config.js";
import {
  deactivateBySub,
  reactivateBySub,
  revokeSessionsBySub,
  updateProfileBySub,
  type LifecycleResult,
} from "./accounts.js";

/**
 * Bizmo.ID webhook'ları (INTEGRATION_GUIDE §4):
 *   X-Bizmo-Signature: sha256=hex(HMAC_SHA256(secret, "<timestamp>.<rawBody>"))
 * Ham gövde üzerinden doğrulanır; zaman damgası ±300 sn. İmza hatası 401, işlenen veya
 * yok sayılan olay 200. İşleyiciler idempotenttir (aynı olay yeniden gelebilir).
 */

export const WEBHOOK_TOLERANCE_SEC = 300;

export interface IdentityEvent {
  id: string;
  type: string;
  createdAt: string;
  schemaVersion?: number;
  data: {
    user?: { id?: string; email?: string; firstName?: string; lastName?: string; displayName?: string };
    clientId?: string;
    [key: string]: unknown;
  };
}

export function signWebhook(secret: string, rawBody: string, timestampSec: number | string): string {
  return `sha256=${createHmac("sha256", secret).update(`${timestampSec}.${rawBody}`).digest("hex")}`;
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = headers[name];
  return Array.isArray(v) ? v[0] : v;
}

export type WebhookVerification = { ok: true; event: IdentityEvent } | { ok: false; reason: string };

export function verifyWebhook(opts: {
  secret: string;
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
  nowSec?: number;
}): WebhookVerification {
  const ts = header(opts.headers, "x-bizmo-timestamp");
  const sig = header(opts.headers, "x-bizmo-signature");
  if (!ts || !sig) return { ok: false, reason: "imza başlıkları eksik" };
  if (!/^\d{1,12}$/.test(ts)) return { ok: false, reason: "geçersiz zaman damgası" };
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > WEBHOOK_TOLERANCE_SEC) {
    return { ok: false, reason: "zaman damgası tolerans dışında" };
  }
  const expected = Buffer.from(signWebhook(opts.secret, opts.rawBody, ts));
  const given = Buffer.from(sig.trim());
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: "imza eşleşmedi" };
  }
  let body: unknown;
  try {
    body = JSON.parse(opts.rawBody);
  } catch {
    return { ok: false, reason: "gövde JSON değil" };
  }
  const e = body as Partial<IdentityEvent> | null;
  if (!e || typeof e.type !== "string" || typeof e.id !== "string" || typeof e.data !== "object" || !e.data) {
    return { ok: false, reason: "geçersiz olay gövdesi" };
  }
  return { ok: true, event: e as IdentityEvent };
}

/** Kişiyi tümüyle kapatan olaylar: bağlı değilse e-postayla da bulunur */
const GLOBAL_DEACTIVATE = new Set(["user.disabled", "user.deleted", "person.terminated"]);
/** Yalnız bu uygulamaya erişimi kaldıran olay */
const APP_DEACTIVATE = new Set(["access.revoked"]);
const REACTIVATE = new Set(["user.enabled", "access.granted", "person.leave_ended"]);
const REVOKE_SESSIONS = new Set(["person.leave_started"]);
const UPDATE_PROFILE = new Set(["user.updated"]);

export interface EventOutcome {
  action: "deactivated" | "reactivated" | "sessions_revoked" | "profile_updated" | "ignored";
  result?: LifecycleResult;
}

export async function handleIdentityEvent(cfg: BizmoIdConfig, event: IdentityEvent): Promise<EventOutcome> {
  // Başka bir uygulamaya ait erişim/rol olayları
  if (event.data.clientId && event.data.clientId !== cfg.clientId) return { action: "ignored" };
  if (event.type === "ping") return { action: "ignored" };

  const user = event.data.user;
  const sub = typeof user?.id === "string" && user.id ? user.id : null;
  if (!sub) return { action: "ignored" };
  const email = typeof user?.email === "string" && user.email ? user.email.toLowerCase() : null;

  if (GLOBAL_DEACTIVATE.has(event.type)) {
    return { action: "deactivated", result: await deactivateBySub(cfg, sub, email) };
  }
  if (APP_DEACTIVATE.has(event.type)) {
    return { action: "deactivated", result: await deactivateBySub(cfg, sub, null) };
  }
  if (REACTIVATE.has(event.type)) {
    return { action: "reactivated", result: await reactivateBySub(sub) };
  }
  if (REVOKE_SESSIONS.has(event.type)) {
    return { action: "sessions_revoked", result: await revokeSessionsBySub(sub) };
  }
  if (UPDATE_PROFILE.has(event.type)) {
    const name =
      (typeof user?.displayName === "string" && user.displayName.trim()) ||
      [user?.firstName, user?.lastName].filter((v) => typeof v === "string" && v.trim()).join(" ") ||
      null;
    return { action: "profile_updated", result: await updateProfileBySub(sub, { name, email }) };
  }
  // roles.changed (rol HRPDR'de yönetilir), person.moved, group.*, orgunit.*, policy.* ve
  // bilinmeyen yeni tipler: 200 + yok sayıldı (Bizmo.ID yeniden denemez)
  return { action: "ignored" };
}
