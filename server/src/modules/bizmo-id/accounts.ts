import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { BIZMO_ID_PROVIDER, type BizmoIdConfig } from "./config.js";

/**
 * Bizmo.ID kimliği ↔ HRPDR hesabı eşlemesi ve yaşam döngüsü (giriş, webhook, SCIM ortak).
 *
 * Kurallar (INTEGRATION_GUIDE §3.3):
 *  1. `externalId = sub` olan hesap varsa odur (pasifse reddedilir).
 *  2. Yoksa BIZMO_ID_ORG_SLUG kurumunda aynı e-posta; yalnız `email_verified === true` iken
 *     bağlanır. Aday başka bir sub'a bağlıysa reddedilir.
 *  3. Hesap yoksa reddedilir (otomatik hesap açılmaz; rol HRPDR'de yönetilir).
 */

export type SsoErrorCode =
  | "NOT_CONFIGURED"
  | "IDP_UNAVAILABLE"
  | "IDP_ERROR"
  | "INVALID_FLOW"
  | "TOKEN_INVALID"
  | "ACCESS_DENIED"
  | "EMAIL_NOT_VERIFIED"
  | "NO_ACCOUNT"
  | "ACCOUNT_DISABLED"
  | "ACCOUNT_CONFLICT"
  | "PORTAL_DISABLED";

export class SsoError extends Error {
  constructor(public readonly code: SsoErrorCode, message?: string) {
    super(message ?? code);
  }
}

export interface BizmoIdentityClaims {
  sub: string;
  email?: string | null;
  emailVerified?: boolean;
  name?: string | null;
  employeeNumber?: string | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** id_token claim'lerinden eşleme için gereken alanlar */
export function identityFromClaims(claims: Record<string, unknown>): BizmoIdentityClaims {
  const org = (claims["org"] ?? {}) as Record<string, unknown>;
  const name =
    str(claims["name"]) ??
    ([str(claims["given_name"]), str(claims["family_name"])].filter(Boolean).join(" ") || null);
  return {
    sub: String(claims["sub"]),
    email: str(claims["email"])?.toLowerCase() ?? null,
    emailVerified: claims["email_verified"] === true,
    name,
    employeeNumber: str(org["employee_number"]),
  };
}

let orgCache: { slug: string; id: string; at: number } | null = null;

/** BIZMO_ID_ORG_SLUG kurumunun kimliği (1 dk önbellek) */
export async function targetOrganizationId(cfg: BizmoIdConfig): Promise<string> {
  if (orgCache && orgCache.slug === cfg.orgSlug && Date.now() - orgCache.at < 60_000) {
    return orgCache.id;
  }
  const org = await prisma.organization.findUnique({
    where: { slug: cfg.orgSlug },
    select: { id: true },
  });
  if (!org) throw new SsoError("NOT_CONFIGURED", "BIZMO_ID_ORG_SLUG kurumu bulunamadı");
  orgCache = { slug: cfg.orgSlug, id: org.id, at: Date.now() };
  return org.id;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ── Yönetim paneli kullanıcısı ────────────────────────

export async function resolveAdminUser(cfg: BizmoIdConfig, identity: BizmoIdentityClaims) {
  const orgId = await targetOrganizationId(cfg);

  const linked = await prisma.user.findFirst({
    where: { externalProvider: BIZMO_ID_PROVIDER, externalId: identity.sub },
    include: { organization: true },
  });
  if (linked) {
    if (linked.organizationId !== orgId) throw new SsoError("ACCOUNT_CONFLICT", "Bağlı hesap başka kurumda");
    if (!linked.isActive || linked.deletedAt) throw new SsoError("ACCOUNT_DISABLED");
    return linked;
  }

  if (!identity.email) throw new SsoError("NO_ACCOUNT", "Bizmo.ID e-postası yok");
  if (!identity.emailVerified) throw new SsoError("EMAIL_NOT_VERIFIED");

  const candidates = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      email: { equals: identity.email, mode: "insensitive" },
      deletedAt: null,
    },
    include: { organization: true },
    take: 2,
  });
  if (candidates.length === 0) throw new SsoError("NO_ACCOUNT");
  if (candidates.length > 1) throw new SsoError("ACCOUNT_CONFLICT", "E-posta birden fazla hesapta");
  const user = candidates[0]!;
  if (user.externalId && user.externalId !== identity.sub) {
    throw new SsoError("ACCOUNT_CONFLICT", "Hesap başka bir Bizmo.ID kimliğine bağlı");
  }
  if (!user.isActive) throw new SsoError("ACCOUNT_DISABLED");

  // Eşzamanlı iki girişte yalnız boş bağlantı yazılır
  try {
    const res = await prisma.user.updateMany({
      where: { id: user.id, externalId: null },
      data: { externalId: identity.sub, externalProvider: BIZMO_ID_PROVIDER },
    });
    if (res.count !== 1) {
      const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { externalId: true } });
      if (fresh?.externalId !== identity.sub) throw new SsoError("ACCOUNT_CONFLICT");
    }
  } catch (err) {
    if (isUniqueViolation(err)) throw new SsoError("ACCOUNT_CONFLICT", "Bizmo.ID kimliği başka hesaba bağlı");
    throw err;
  }
  return { ...user, externalId: identity.sub, externalProvider: BIZMO_ID_PROVIDER };
}

/**
 * Bağlı kullanıcının adını (ve kurumda çakışmıyorsa e-postasını) Bizmo.ID'deki değerle
 * günceller. Bizmo kurumsal kimliğinde ad ve e-posta yalnız Bizmo.ID'de düzenlenir.
 */
export async function syncLinkedUserProfile(
  userId: string,
  profile: { name?: string | null; email?: string | null },
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, organizationId: true },
  });
  if (!user) return;
  const data: { name?: string; email?: string } = {};
  if (profile.name && profile.name !== user.name) data.name = profile.name.slice(0, 200);
  if (profile.email && profile.email.toLowerCase() !== user.email.toLowerCase()) {
    const clash = await prisma.user.findFirst({
      where: {
        organizationId: user.organizationId,
        email: { equals: profile.email, mode: "insensitive" },
        id: { not: userId },
      },
      select: { id: true },
    });
    if (!clash) data.email = profile.email.toLowerCase();
  }
  if (Object.keys(data).length === 0) return;
  try {
    await prisma.user.update({ where: { id: userId }, data });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

// ── Personel portalı ──────────────────────────────────

export async function resolvePortalPersonnel(cfg: BizmoIdConfig, identity: BizmoIdentityClaims) {
  const orgId = await targetOrganizationId(cfg);

  const linked = await prisma.personnel.findFirst({
    where: { externalProvider: BIZMO_ID_PROVIDER, externalId: identity.sub },
  });
  if (linked) {
    if (linked.organizationId !== orgId) throw new SsoError("ACCOUNT_CONFLICT", "Bağlı personel başka kurumda");
    if (linked.deletedAt || linked.status !== "ACTIVE") throw new SsoError("ACCOUNT_DISABLED");
    return linked;
  }

  // Sicil (Bizmo.ID `org.employee_number`, bizmo.org kapsamı) imzalı token'dan gelir;
  // e-posta yalnız doğrulanmışsa kullanılır. İkisi farklı kişiyi gösterirse reddedilir.
  const byEmployeeNumber = identity.employeeNumber
    ? await prisma.personnel.findFirst({
        where: { organizationId: orgId, employeeId: identity.employeeNumber, deletedAt: null },
      })
    : null;
  const byEmail =
    identity.email && identity.emailVerified
      ? await prisma.personnel.findFirst({
          where: {
            organizationId: orgId,
            email: { equals: identity.email, mode: "insensitive" },
            deletedAt: null,
          },
        })
      : null;
  if (byEmployeeNumber && byEmail && byEmployeeNumber.id !== byEmail.id) {
    throw new SsoError("ACCOUNT_CONFLICT", "Sicil ve e-posta farklı personeli gösteriyor");
  }
  const person = byEmployeeNumber ?? byEmail;
  if (!person) {
    if (identity.email && !identity.emailVerified && !identity.employeeNumber) {
      throw new SsoError("EMAIL_NOT_VERIFIED");
    }
    throw new SsoError("NO_ACCOUNT");
  }
  if (person.externalId && person.externalId !== identity.sub) {
    throw new SsoError("ACCOUNT_CONFLICT", "Personel başka bir Bizmo.ID kimliğine bağlı");
  }
  if (person.status !== "ACTIVE") throw new SsoError("ACCOUNT_DISABLED");

  try {
    const res = await prisma.personnel.updateMany({
      where: { id: person.id, externalId: null },
      data: { externalId: identity.sub, externalProvider: BIZMO_ID_PROVIDER },
    });
    if (res.count !== 1) {
      const fresh = await prisma.personnel.findUnique({ where: { id: person.id }, select: { externalId: true } });
      if (fresh?.externalId !== identity.sub) throw new SsoError("ACCOUNT_CONFLICT");
    }
  } catch (err) {
    if (isUniqueViolation(err)) throw new SsoError("ACCOUNT_CONFLICT", "Bizmo.ID kimliği başka personele bağlı");
    throw err;
  }
  return person;
}

// ── Yaşam döngüsü (webhook, SCIM, back-channel logout) ──

export interface LifecycleResult {
  users: number;
  personnel: number;
}

/** Bizmo.ID kimliğine bağlı yönetici ve personel oturumlarını kapatır */
export async function revokeSessionsBySub(sub: string): Promise<LifecycleResult> {
  const [users, personnel] = await Promise.all([
    prisma.user.updateMany({
      where: { externalProvider: BIZMO_ID_PROVIDER, externalId: sub },
      data: { refreshToken: null },
    }),
    prisma.personnel.updateMany({
      where: { externalProvider: BIZMO_ID_PROVIDER, externalId: sub },
      data: { portalRefreshToken: null },
    }),
  ]);
  return { users: users.count, personnel: personnel.count };
}

/**
 * Hesabı pasifler ve tüm oturumları kapatır (işten çıkış, erişimin kaldırılması, hesap
 * kapatma). Bağlı yönetici hesabı pasiflenir; `byEmail` verilirse (kişi tümüyle kapatıldıysa)
 * henüz bağlanmamış aynı e-postalı yönetici hesabı da pasiflenir. Personel kaydının İK
 * durumu değiştirilmez (işten ayrılış İK sürecidir); yalnız portal oturumları kapanır.
 */
export async function deactivateBySub(
  cfg: BizmoIdConfig,
  sub: string,
  byEmail: string | null,
): Promise<LifecycleResult> {
  const now = new Date();
  const users = await prisma.user.updateMany({
    where: { externalProvider: BIZMO_ID_PROVIDER, externalId: sub },
    data: { refreshToken: null, isActive: false, externalDisabledAt: now },
  });
  let byEmailCount = 0;
  if (byEmail) {
    const orgId = await targetOrganizationId(cfg).catch(() => null);
    if (orgId) {
      const res = await prisma.user.updateMany({
        where: {
          organizationId: orgId,
          externalId: null,
          email: { equals: byEmail, mode: "insensitive" },
          deletedAt: null,
          isActive: true,
        },
        data: { refreshToken: null, isActive: false, externalDisabledAt: now },
      });
      byEmailCount = res.count;
    }
  }
  const personnel = await prisma.personnel.updateMany({
    where: { externalProvider: BIZMO_ID_PROVIDER, externalId: sub },
    data: { portalRefreshToken: null },
  });
  return { users: users.count + byEmailCount, personnel: personnel.count };
}

/**
 * Bizmo.ID'nin kapattığı bağlı hesabı yeniden açar. Yalnız Bizmo.ID olayıyla pasiflenmiş
 * hesaplar açılır; HRPDR'de elle pasiflenen hesaba dokunulmaz. E-postayla eşleme yapılmaz.
 */
export async function reactivateBySub(sub: string): Promise<LifecycleResult> {
  const users = await prisma.user.updateMany({
    where: {
      externalProvider: BIZMO_ID_PROVIDER,
      externalId: sub,
      isActive: false,
      externalDisabledAt: { not: null },
      deletedAt: null,
    },
    data: { isActive: true, externalDisabledAt: null },
  });
  return { users: users.count, personnel: 0 };
}

/** Bağlı yönetici kullanıcısının adını/e-postasını günceller */
export async function updateProfileBySub(
  sub: string,
  profile: { name?: string | null; email?: string | null },
): Promise<LifecycleResult> {
  const users = await prisma.user.findMany({
    where: { externalProvider: BIZMO_ID_PROVIDER, externalId: sub },
    select: { id: true },
  });
  for (const u of users) await syncLinkedUserProfile(u.id, profile);
  return { users: users.length, personnel: 0 };
}

/**
 * Henüz bağlanmamış hesapları sub'a bağlar (SCIM: Bizmo.ID dizininden gelen kişi). Kurumdaki
 * aynı e-postalı yönetici ve aynı sicil/e-postalı personel bağlanır; çakışmada bağlanmaz.
 */
export async function linkBySub(
  cfg: BizmoIdConfig,
  sub: string,
  identity: { email: string | null; employeeNumber: string | null },
): Promise<LifecycleResult> {
  const orgId = await targetOrganizationId(cfg).catch(() => null);
  if (!orgId) return { users: 0, personnel: 0 };
  let users = 0;
  let personnel = 0;
  try {
    if (identity.email) {
      const alreadyLinked = await prisma.user.count({
        where: { externalProvider: BIZMO_ID_PROVIDER, externalId: sub },
      });
      if (alreadyLinked === 0) {
        const candidates = await prisma.user.findMany({
          where: {
            organizationId: orgId,
            externalId: null,
            email: { equals: identity.email, mode: "insensitive" },
            deletedAt: null,
          },
          select: { id: true },
          take: 2,
        });
        if (candidates.length === 1) {
          const res = await prisma.user.updateMany({
            where: { id: candidates[0]!.id, externalId: null },
            data: { externalId: sub, externalProvider: BIZMO_ID_PROVIDER },
          });
          users = res.count;
        }
      }
    }
    const personLinked = await prisma.personnel.count({
      where: { externalProvider: BIZMO_ID_PROVIDER, externalId: sub },
    });
    if (personLinked === 0) {
      const byEmp = identity.employeeNumber
        ? await prisma.personnel.findFirst({
            where: { organizationId: orgId, employeeId: identity.employeeNumber, deletedAt: null },
            select: { id: true, externalId: true },
          })
        : null;
      const byEmail = identity.email
        ? await prisma.personnel.findFirst({
            where: {
              organizationId: orgId,
              email: { equals: identity.email, mode: "insensitive" },
              deletedAt: null,
            },
            select: { id: true, externalId: true },
          })
        : null;
      const target =
        byEmp && byEmail && byEmp.id !== byEmail.id ? null : (byEmp ?? byEmail);
      if (target && !target.externalId) {
        const res = await prisma.personnel.updateMany({
          where: { id: target.id, externalId: null },
          data: { externalId: sub, externalProvider: BIZMO_ID_PROVIDER },
        });
        personnel = res.count;
      }
    }
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
  return { users, personnel };
}
