import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { maskTrMobile, normalizeTrMobile } from "@ph/shared";
import { prisma } from "../../lib/prisma.js";
import { portalSessionWhere } from "../../lib/portal-sessions.js";
import { sendSms } from "../../lib/iletimerkezi.js";
import { JWT_REFRESH_SECRET } from "../../env.js";
import { issuePortalSession } from "./auth.service.js";

/**
 * SMS ile şifresiz portal girişi: personel sicil numarasını girer, kayıtlı cep
 * telefonuna 6 haneli tek kullanımlık kod gider, kodla oturum açılır.
 *
 * Yalnız aktif bir değerlendirmeye atanmış (portalda erişebileceği oturumu olan),
 * aktif ve geçerli TR cep numarası kayıtlı personel kod alabilir.
 */

export const OTP_TTL_SEC = 5 * 60;
export const OTP_RESEND_COOLDOWN_SEC = 60;
export const OTP_MAX_ATTEMPTS = 5;
/** Personel ve telefon başına gönderim üst sınırları (SMS bombardımanı / maliyet) */
const OTP_LIMITS = [
  { windowSec: 60 * 60, max: 5 },
  { windowSec: 24 * 60 * 60, max: 10 },
] as const;

/**
 * Kodun kendisi saklanmaz: kayıt kimliğiyle tuzlanmış HMAC özeti tutulur. 6 haneli
 * kodun düz SHA-256'sı veritabanı sızıntısında anında çözülebileceği için sunucu
 * anahtarı gerekir (refresh anahtarından amaç etiketiyle türetilir).
 */
const OTP_HMAC_KEY = createHash("sha256").update(`portal-login-otp:${JWT_REFRESH_SECRET}`).digest();

function hashCode(otpId: string, code: string): string {
  return createHmac("sha256", OTP_HMAC_KEY).update(`${otpId}:${code}`).digest("hex");
}

function codeMatches(otpId: string, code: string, storedHash: string): boolean {
  const a = Buffer.from(hashCode(otpId, code), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Türkçe karakter yok: ı/ş gibi harfler mesajı Unicode'a çevirip tek SMS'i 160'tan 70 karaktere düşürür */
function otpMessage(code: string): string {
  return `PotansiyelHaritasi giris kodunuz: ${code}. Kod 5 dakika gecerlidir, kimseyle paylasmayin.`;
}

const secondsUntil = (date: Date, now: Date) => Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));

type OtpCandidate = {
  id: string;
  organizationId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  preferredLanguage: string;
  phone: string;
};

/**
 * Sicil numarasına göre kod alabilecek personeli bulur. Uygun kişi yoksa (kayıt yok,
 * pasif, telefonu yok/geçersiz, aktif ataması yok) ya da sicil numarası birden fazla
 * kurumda uygun kişiye denk geliyorsa `null` döner; çağıran tek bir genel yanıt verir.
 */
async function findOtpCandidate(employeeId: string, now: Date): Promise<OtpCandidate | null> {
  const people = await prisma.personnel.findMany({
    where: {
      employeeId: { equals: employeeId.trim(), mode: "insensitive" },
      deletedAt: null,
      status: "ACTIVE",
    },
    select: {
      id: true,
      organizationId: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      preferredLanguage: true,
      phone: true,
    },
    take: 5,
  });

  const eligible: OtpCandidate[] = [];
  for (const p of people) {
    const phone = normalizeTrMobile(p.phone);
    if (!phone) continue;
    const session = await prisma.assessmentSession.findFirst({
      where: portalSessionWhere(p.id, now),
      select: { id: true },
    });
    if (session) eligible.push({ ...p, phone });
  }
  return eligible.length === 1 ? eligible[0]! : null;
}

export type OtpRequestResult =
  | { kind: "unavailable" }
  | { kind: "sent" | "already_sent"; maskedPhone: string; expiresInSec: number; resendInSec: number }
  | { kind: "cooldown" | "limited"; retryAfterSec: number };

/**
 * Kod üretir ve SMS'le gönderir. Bekleme süresi içindeki ikinci istekte yeni SMS
 * gönderilmez; geçerli kod için "zaten gönderildi" döner (sayfa yenilense de kalınan
 * yerden devam edilir). Sağlayıcı hatasında kayıt silinir ve hata yukarı fırlatılır.
 */
export async function requestPortalOtp(employeeId: string, ipAddress: string | null): Promise<OtpRequestResult> {
  const now = new Date();
  const candidate = await findOtpCandidate(employeeId, now);
  if (!candidate) return { kind: "unavailable" };

  const otpId = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  // Aynı personel için eşzamanlı iki istek iki SMS göndermesin: denetim + kayıt tek kilit altında
  const decision = await prisma.$transaction(async (tx): Promise<OtpRequestResult | null> => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`portal-otp:${candidate.id}`}))`;

    const latest = await tx.portalLoginOtp.findFirst({
      where: { personnelId: candidate.id },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      const resendAt = new Date(latest.createdAt.getTime() + OTP_RESEND_COOLDOWN_SEC * 1000);
      if (resendAt > now) {
        const stillUsable =
          !latest.consumedAt &&
          latest.expiresAt > now &&
          latest.attempts < OTP_MAX_ATTEMPTS &&
          latest.phone === candidate.phone;
        return stillUsable
          ? {
              kind: "already_sent",
              maskedPhone: maskTrMobile(latest.phone),
              expiresInSec: secondsUntil(latest.expiresAt, now),
              resendInSec: secondsUntil(resendAt, now),
            }
          : { kind: "cooldown", retryAfterSec: secondsUntil(resendAt, now) };
      }
    }

    for (const { windowSec, max } of OTP_LIMITS) {
      const since = new Date(now.getTime() - windowSec * 1000);
      for (const where of [
        { personnelId: candidate.id, createdAt: { gt: since } },
        { phone: candidate.phone, createdAt: { gt: since } },
      ]) {
        const recent = await tx.portalLoginOtp.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: max,
          select: { createdAt: true },
        });
        if (recent.length >= max) {
          // En eski kayıt pencereden çıkınca yeni kod istenebilir
          const oldest = recent[recent.length - 1]!.createdAt;
          return { kind: "limited", retryAfterSec: secondsUntil(new Date(oldest.getTime() + windowSec * 1000), now) };
        }
      }
    }

    await tx.portalLoginOtp.create({
      data: {
        id: otpId,
        personnelId: candidate.id,
        codeHash: hashCode(otpId, code),
        phone: candidate.phone,
        expiresAt: new Date(now.getTime() + OTP_TTL_SEC * 1000),
        ipAddress,
      },
    });
    return null;
  });
  if (decision) return decision;

  try {
    const { orderId } = await sendSms(candidate.phone, otpMessage(code));
    await prisma.portalLoginOtp.update({ where: { id: otpId }, data: { providerOrderId: orderId } });
  } catch (err) {
    // Gönderilemeyen kod kullanılamaz; bekleme süresini ve sınırları da doldurmasın
    await prisma.portalLoginOtp.delete({ where: { id: otpId } }).catch(() => undefined);
    throw err;
  }

  return {
    kind: "sent",
    maskedPhone: maskTrMobile(candidate.phone),
    expiresInSec: OTP_TTL_SEC,
    resendInSec: OTP_RESEND_COOLDOWN_SEC,
  };
}

export type OtpVerifyResult =
  | { kind: "ok"; session: Awaited<ReturnType<typeof issuePortalSession>> }
  | { kind: "invalid"; remainingAttempts: number }
  | { kind: "expired" }
  | { kind: "locked" };

/**
 * Kodu doğrular; doğruysa kodu tüketip portal oturumu açar. Yalnız son gönderilen kod
 * geçerlidir; yeni kod istenince öncekiler kullanılamaz. Telefon numarası kod
 * gönderildikten sonra değiştiyse (ör. kayıp telefon) kod geçersiz sayılır.
 */
export async function verifyPortalOtp(
  fastify: FastifyInstance,
  employeeId: string,
  code: string,
): Promise<OtpVerifyResult> {
  const now = new Date();
  const candidate = await findOtpCandidate(employeeId, now);
  if (!candidate) return { kind: "expired" };

  const otp = await prisma.portalLoginOtp.findFirst({
    where: { personnelId: candidate.id },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.consumedAt || otp.expiresAt <= now || otp.phone !== candidate.phone) {
    return { kind: "expired" };
  }
  if (otp.attempts >= OTP_MAX_ATTEMPTS) return { kind: "locked" };

  // Deneme hakkı karşılaştırmadan önce düşülür: eşzamanlı istekler sınırı aşamaz
  const counted = await prisma.portalLoginOtp.updateMany({
    where: { id: otp.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) return { kind: "locked" };

  if (!codeMatches(otp.id, code, otp.codeHash)) {
    const remainingAttempts = OTP_MAX_ATTEMPTS - (otp.attempts + 1);
    return remainingAttempts > 0 ? { kind: "invalid", remainingAttempts } : { kind: "locked" };
  }

  // Tek kullanımlık: aynı kodla eşzamanlı ikinci giriş açılmaz
  const consumed = await prisma.portalLoginOtp.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count !== 1) return { kind: "expired" };

  return { kind: "ok", session: await issuePortalSession(fastify, candidate) };
}
