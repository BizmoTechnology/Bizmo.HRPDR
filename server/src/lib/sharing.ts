import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma.js";

/**
 * Kurum ayarları (`Organization.settings` JSON) ve personelle sonuç paylaşımı.
 *
 * Paylaşım kuralı her kayıt türü için aynıdır (Assessment, ReviewCycle, CareerPlan …):
 * kaydın kendi `shareWithEmployee` alanı (tri-state) doluysa o geçerlidir, boşsa
 * (`null`) kurumun `shareResultsDefault` değeri kullanılır. Sistem varsayılanı
 * PAYLAŞMA'dır (`false`).
 *
 * Yeni bir ayar eklemek için: `orgSettingsSchema`'ya alanı varsayılanıyla ekleyin;
 * `DEFAULT_ORG_SETTINGS`, okuma ve PATCH şeması otomatik güncellenir.
 */

export const orgSettingsSchema = z.object({
  /** Sonuçlar personelle varsayılan olarak paylaşılsın mı? (sistem varsayılanı: hayır) */
  shareResultsDefault: z.boolean().default(false),
});

export type OrgSettings = z.infer<typeof orgSettingsSchema>;

export const DEFAULT_ORG_SETTINGS: Readonly<OrgSettings> = Object.freeze(orgSettingsSchema.parse({}));

/** Kısmi güncelleme gövdesi: yalnız bilinen alanlar, bilinmeyen anahtar reddedilir */
export const orgSettingsPatchSchema = z
  .object({
    shareResultsDefault: z.boolean(),
  })
  .partial()
  .strict();

export type OrgSettingsPatch = z.infer<typeof orgSettingsPatchSchema>;

type Db = Pick<PrismaClient, "organization"> | Prisma.TransactionClient;

function asObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

/**
 * Ham JSON'u tipli ayarlara çevirir. Bozuk/eksik alanlar alan bazında
 * varsayılana düşer (tek bir hatalı alan tüm ayarları sıfırlamaz).
 */
export function parseOrgSettings(raw: unknown): OrgSettings {
  const obj = asObject(raw);
  const result: Record<string, unknown> = {};
  for (const [key, fieldSchema] of Object.entries(orgSettingsSchema.shape)) {
    const parsed = (fieldSchema as z.ZodTypeAny).safeParse(obj[key]);
    result[key] = parsed.success
      ? parsed.data
      : (DEFAULT_ORG_SETTINGS as Record<string, unknown>)[key];
  }
  return result as OrgSettings;
}

/** Kurum ayarlarını varsayılanlarla birlikte döndürür (kurum yoksa varsayılanlar) */
export async function getOrgSettings(orgId: string, db: Db = prisma): Promise<OrgSettings> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });
  return parseOrgSettings(org?.settings);
}

/**
 * Kısmi güncelleme. Şemada olmayan (ör. ileride başka bir modülün yazdığı)
 * anahtarlar korunur. Güncel tipli ayarları ve önceki hâlini döndürür.
 */
export async function updateOrgSettings(
  orgId: string,
  patch: OrgSettingsPatch,
  db: Db = prisma,
): Promise<{ before: OrgSettings; after: OrgSettings }> {
  const org = await db.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { settings: true },
  });
  const raw = asObject(org.settings);
  const before = parseOrgSettings(raw);
  const merged = { ...raw, ...before, ...patch };
  await db.organization.update({
    where: { id: orgId },
    data: { settings: merged as Prisma.InputJsonValue },
  });
  return { before, after: parseOrgSettings(merged) };
}

/**
 * Etkin paylaşım değeri: kayıt düzeyindeki geçersiz kılma (`true`/`false`) varsa o,
 * yoksa (`null`/`undefined`) kurum varsayılanı.
 */
export function resolveShare(override: boolean | null | undefined, orgDefault: boolean): boolean {
  return typeof override === "boolean" ? override : orgDefault;
}

/** Tri-state alanlar için ortak giriş şeması (null = kurum varsayılanı) */
export const shareOverrideSchema = z.boolean().nullable();
