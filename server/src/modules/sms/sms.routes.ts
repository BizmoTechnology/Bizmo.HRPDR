import type { FastifyPluginAsync } from "fastify";
import { normalizeTrMobile } from "@ph/shared";
import { prisma } from "../../lib/prisma.js";
import { portalAccessibleSessionWhere } from "../../lib/portal-sessions.js";
import {
  getSmsBalance,
  isSmsConfigured,
  smsSender,
  SmsProviderError,
} from "../../lib/iletimerkezi.js";

/** Sağlayıcı denetimi (bakiye sorgusu) her sayfa açılışında tekrarlanmasın */
const PROVIDER_CHECK_TTL_MS = 60_000;

type ProviderCheck =
  | { ok: true; balance: { amount: string | null; sms: string | null } }
  | { ok: false; error: string };

let lastCheck: { at: number; result: ProviderCheck } | null = null;

async function checkProvider(force: boolean): Promise<ProviderCheck> {
  if (!force && lastCheck && Date.now() - lastCheck.at < PROVIDER_CHECK_TTL_MS) {
    return lastCheck.result;
  }
  let result: ProviderCheck;
  try {
    result = { ok: true, balance: await getSmsBalance() };
  } catch (err) {
    const detail =
      err instanceof SmsProviderError
        ? `${err.message}${err.providerCode ? ` (kod ${err.providerCode})` : ""}`
        : "beklenmeyen hata";
    result = { ok: false, error: `İletimerkezi bağlantısı doğrulanamadı: ${detail}` };
  }
  lastCheck = { at: Date.now(), result };
  return result;
}

/**
 * GET /api/sms-status — SMS ile portal girişinin durumu (tüm panel kullanıcıları).
 * `connected`: kimlik bilgileri tanımlı ve İletimerkezi bakiye sorgusuyla doğrulandı.
 * Aktif değerlendirmesi olup geçerli cep telefonu kayıtlı olmayan personel de sayılır.
 */
const smsStatusRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticate);

  fastify.get<{ Querystring: { refresh?: string } }>("/", async (request, reply) => {
    const orgId = request.user.orgId!;
    const configured = isSmsConfigured();

    const assigned = await prisma.personnel.findMany({
      where: {
        organizationId: orgId,
        deletedAt: null,
        status: "ACTIVE",
        assessmentSessions: { some: portalAccessibleSessionWhere(new Date()) },
      },
      select: { phone: true },
    });
    const missingPhoneCount = assigned.filter((p) => !normalizeTrMobile(p.phone)).length;

    const check = configured ? await checkProvider(request.query.refresh === "1") : null;

    return reply.send({
      data: {
        provider: "İletimerkezi",
        configured,
        connected: check?.ok === true,
        sender: smsSender(),
        balance: check?.ok ? check.balance : null,
        error: check && !check.ok ? check.error : null,
        assignedCount: assigned.length,
        missingPhoneCount,
      },
    });
  });
};

export default smsStatusRoutes;
