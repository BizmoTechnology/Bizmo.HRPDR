import { timingSafeEqual } from "node:crypto";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { BizmoIdIdentity, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { bizmoIdStatus, type BizmoIdConfig } from "./config.js";
import { deactivateBySub, linkBySub, reactivateBySub, updateProfileBySub } from "./accounts.js";

/**
 * SCIM 2.0 (RFC 7643/7644) Users ucu: Bizmo.ID, `bizmo-hrpdr` uygulamasına erişimi olan
 * kişileri buraya gönderir (Panel → Uygulamalar → Veri ve SCIM). Eşleme anahtarı
 * `externalId` = OIDC `sub`.
 *
 * HRPDR hesap açmaz (rol ve hesap HRPDR'de yönetilir): gelen kişi BizmoIdIdentity
 * tablosunda tutulur, kurumdaki aynı e-postalı yöneticiye ve aynı sicil/e-postalı personele
 * bağlanır; `active: false` ve silme bağlı yönetici hesabını pasifler, oturumları kapatır.
 * Groups desteklenmez (Bizmo.ID'de `bizmo.groups` kapsamı açılmamalı).
 */

const SCIM_USER = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_ENTERPRISE = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
const SCIM_LIST = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCIM_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error";
const SCIM_PATCH = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
const SCIM_CONTENT_TYPE = "application/scim+json; charset=utf-8";
const MAX_PAGE = 200;

type Json = Record<string, unknown>;

function scimError(reply: FastifyReply, status: number, detail: string, scimType?: string) {
  return reply
    .status(status)
    .type(SCIM_CONTENT_TYPE)
    .send({ schemas: [SCIM_ERROR], status: String(status), detail, ...(scimType ? { scimType } : {}) });
}

function bearerMatches(header: string | undefined, token: string): boolean {
  const m = typeof header === "string" ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  if (!m) return false;
  const a = Buffer.from(m[1]!);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** SCIM kaynağından eşleme ve görünüm alanları */
export function extractScimUser(resource: Json) {
  const name = (resource["name"] ?? {}) as Json;
  const emails = Array.isArray(resource["emails"]) ? (resource["emails"] as Json[]) : [];
  const primary = emails.find((e) => e?.["primary"] === true) ?? emails[0];
  const enterprise = (resource[SCIM_ENTERPRISE] ?? {}) as Json;
  const givenName = str(name["givenName"]);
  const familyName = str(name["familyName"]);
  const displayName =
    str(resource["displayName"]) ?? str(name["formatted"]) ?? ([givenName, familyName].filter(Boolean).join(" ") || null);
  const userName = str(resource["userName"]);
  const email = (str(primary?.["value"]) ?? (userName?.includes("@") ? userName : null))?.toLowerCase() ?? null;
  return {
    externalId: str(resource["externalId"]),
    userName,
    email,
    givenName,
    familyName,
    displayName,
    employeeNumber: str(enterprise["employeeNumber"]),
    active: resource["active"] === undefined ? true : resource["active"] === true || resource["active"] === "true",
  };
}

function toResource(row: BizmoIdIdentity, baseUrl: string): Json {
  const stored = (row.resource ?? {}) as Json;
  return {
    ...stored,
    schemas: Array.isArray(stored["schemas"]) ? stored["schemas"] : [SCIM_USER],
    id: row.id,
    externalId: row.externalId,
    userName: row.userName,
    active: row.active,
    meta: {
      resourceType: "User",
      created: row.createdAt.toISOString(),
      lastModified: row.updatedAt.toISOString(),
      location: `${baseUrl}/Users/${row.id}`,
    },
  };
}

/** Desteklenen filtre: `<attr> eq "<değer>"` (userName, externalId, emails.value, id) */
export function parseScimFilter(filter: string): { attr: string; value: string } | null {
  const m = /^\s*([A-Za-z.]+)\s+eq\s+"((?:[^"\\]|\\.)*)"\s*$/i.exec(filter);
  if (!m) return null;
  const attr = m[1]!.toLowerCase();
  if (!["username", "externalid", "emails.value", "emails", "id"].includes(attr)) return null;
  return { attr, value: m[2]!.replace(/\\(.)/g, "$1") };
}

/** PATCH işlemlerini kaynağın kopyasına uygular (RFC 7644 §3.5.2; yolsuz Entra biçimi dahil) */
export function applyScimPatch(resource: Json, operations: unknown): Json {
  if (!Array.isArray(operations)) throw new Error("Operations dizisi gerekli");
  const out: Json = structuredClone(resource);
  const setPath = (path: string, value: unknown, remove: boolean) => {
    const emailPath = /^emails(\[[^\]]*\])?\.value$/i.exec(path);
    if (emailPath) {
      const emails = Array.isArray(out["emails"]) ? (out["emails"] as Json[]) : [];
      if (remove) {
        out["emails"] = [];
      } else if (emails.length) {
        emails[0] = { ...emails[0], value };
        out["emails"] = emails;
      } else {
        out["emails"] = [{ value, type: "work", primary: true }];
      }
      return;
    }
    const parts = path.split(".");
    let node: Json = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]!;
      if (typeof node[key] !== "object" || node[key] === null) node[key] = {};
      node = node[key] as Json;
    }
    const last = parts[parts.length - 1]!;
    if (remove) delete node[last];
    else node[last] = value;
  };
  for (const raw of operations) {
    const op = raw as Json;
    const kind = String(op["op"] ?? "").toLowerCase();
    if (!["add", "replace", "remove"].includes(kind)) throw new Error(`Desteklenmeyen işlem: ${String(op["op"])}`);
    const path = str(op["path"]);
    if (path) {
      if (path.includes("[") && !/^emails\[[^\]]*\]\.value$/i.test(path)) {
        throw new Error(`Desteklenmeyen yol: ${path}`);
      }
      setPath(path.replace(/^urn:ietf:params:scim:schemas:core:2\.0:User:/i, ""), op["value"], kind === "remove");
    } else if (kind !== "remove" && op["value"] && typeof op["value"] === "object") {
      for (const [k, v] of Object.entries(op["value"] as Json)) setPath(k, v, false);
    } else {
      throw new Error("Yolsuz remove desteklenmez");
    }
  }
  return out;
}

async function applySideEffects(
  cfg: BizmoIdConfig,
  before: { active: boolean } | null,
  user: ReturnType<typeof extractScimUser> & { externalId: string },
) {
  await linkBySub(cfg, user.externalId, { email: user.email, employeeNumber: user.employeeNumber });
  if (!user.active) {
    await deactivateBySub(cfg, user.externalId, null);
    return;
  }
  if (before && !before.active) await reactivateBySub(user.externalId);
  await updateProfileBySub(user.externalId, { name: user.displayName, email: user.email });
}

const scimRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser(
    ["application/scim+json"],
    { parseAs: "string", bodyLimit: 256 * 1024 },
    (_req, body, done) => {
      try {
        done(null, body ? JSON.parse(body as string) : {});
      } catch {
        const err = new Error("Geçersiz JSON") as Error & { statusCode?: number };
        err.statusCode = 400;
        done(err, undefined);
      }
    },
  );

  let cfg: BizmoIdConfig | null = null;

  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const status = bizmoIdStatus();
    cfg = status.config;
    if (!cfg || !cfg.scimToken) return scimError(reply, 404, "SCIM bağlı değil");
    if (!bearerMatches(request.headers.authorization, cfg.scimToken)) {
      return scimError(reply, 401, "Geçersiz SCIM token");
    }
  });

  const baseUrl = () => `${cfg!.apiPublicUrl}/scim/v2`;
  const send = (reply: FastifyReply, status: number, body: unknown) =>
    reply.status(status).type(SCIM_CONTENT_TYPE).send(body);

  fastify.get("/ServiceProviderConfig", async (_request, reply) =>
    send(reply, 200, {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: MAX_PAGE },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        { type: "oauthbearertoken", name: "Bearer", description: "BIZMO_ID_SCIM_TOKEN" },
      ],
    }),
  );

  fastify.get("/ResourceTypes", async (_request, reply) =>
    send(reply, 200, {
      schemas: [SCIM_LIST],
      totalResults: 1,
      Resources: [
        {
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
          id: "User",
          name: "User",
          endpoint: "/Users",
          schema: SCIM_USER,
          schemaExtensions: [{ schema: SCIM_ENTERPRISE, required: false }],
        },
      ],
    }),
  );

  fastify.get("/Users", async (request, reply) => {
    const q = request.query as { filter?: string; startIndex?: string; count?: string };
    const startIndex = Math.max(1, parseInt(q.startIndex ?? "1", 10) || 1);
    const count = Math.min(MAX_PAGE, Math.max(0, parseInt(q.count ?? String(MAX_PAGE), 10) || 0));
    let where: Prisma.BizmoIdIdentityWhereInput = {};
    if (q.filter) {
      const f = parseScimFilter(q.filter);
      if (!f) return scimError(reply, 400, "Desteklenmeyen filtre", "invalidFilter");
      if (f.attr === "externalid") where = { externalId: f.value };
      else if (f.attr === "id") where = { id: f.value };
      else if (f.attr === "username") where = { userName: { equals: f.value, mode: "insensitive" } };
      else where = { email: { equals: f.value, mode: "insensitive" } };
    }
    const [total, rows] = await Promise.all([
      prisma.bizmoIdIdentity.count({ where }),
      prisma.bizmoIdIdentity.findMany({ where, orderBy: { createdAt: "asc" }, skip: startIndex - 1, take: count }),
    ]);
    return send(reply, 200, {
      schemas: [SCIM_LIST],
      totalResults: total,
      startIndex,
      itemsPerPage: rows.length,
      Resources: rows.map((r) => toResource(r, baseUrl())),
    });
  });

  fastify.get("/Users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const row = await prisma.bizmoIdIdentity.findUnique({ where: { id } });
    if (!row) return scimError(reply, 404, "Kullanıcı bulunamadı");
    return send(reply, 200, toResource(row, baseUrl()));
  });

  async function save(existing: BizmoIdIdentity | null, resource: Json, reply: FastifyReply, created: boolean) {
    const user = extractScimUser(resource);
    if (!user.externalId) return scimError(reply, 400, "externalId (Bizmo.ID sub) gerekli", "invalidValue");
    if (!user.userName) return scimError(reply, 400, "userName gerekli", "invalidValue");
    if (existing && existing.externalId !== user.externalId) {
      return scimError(reply, 400, "externalId değiştirilemez", "mutability");
    }
    const clash = await prisma.bizmoIdIdentity.findFirst({
      where: {
        OR: [{ externalId: user.externalId }, { userName: { equals: user.userName, mode: "insensitive" } }],
        ...(existing ? { id: { not: existing.id } } : {}),
      },
      select: { id: true },
    });
    if (clash) return scimError(reply, 409, "Kullanıcı zaten var", "uniqueness");

    const { id: _id, meta: _meta, ...stored } = resource;
    const data = {
      externalId: user.externalId,
      userName: user.userName,
      email: user.email,
      givenName: user.givenName,
      familyName: user.familyName,
      displayName: user.displayName,
      employeeNumber: user.employeeNumber,
      active: user.active,
      resource: stored as Prisma.InputJsonValue,
    };
    const row = existing
      ? await prisma.bizmoIdIdentity.update({ where: { id: existing.id }, data })
      : await prisma.bizmoIdIdentity.create({ data });
    await applySideEffects(cfg!, existing ? { active: existing.active } : null, {
      ...user,
      externalId: user.externalId,
    });
    return send(reply, created ? 201 : 200, toResource(row, baseUrl()));
  }

  fastify.post("/Users", async (request, reply) => {
    const body = request.body as Json | undefined;
    if (!body || typeof body !== "object") return scimError(reply, 400, "Gövde gerekli", "invalidSyntax");
    return save(null, body, reply, true);
  });

  fastify.put("/Users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.bizmoIdIdentity.findUnique({ where: { id } });
    if (!existing) return scimError(reply, 404, "Kullanıcı bulunamadı");
    const body = request.body as Json | undefined;
    if (!body || typeof body !== "object") return scimError(reply, 400, "Gövde gerekli", "invalidSyntax");
    return save(existing, body, reply, false);
  });

  fastify.patch("/Users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.bizmoIdIdentity.findUnique({ where: { id } });
    if (!existing) return scimError(reply, 404, "Kullanıcı bulunamadı");
    const body = request.body as Json | undefined;
    const schemas = Array.isArray(body?.["schemas"]) ? (body!["schemas"] as unknown[]) : [];
    if (!schemas.includes(SCIM_PATCH)) return scimError(reply, 400, "PatchOp şeması gerekli", "invalidSyntax");
    let next: Json;
    try {
      const current = toResource(existing, baseUrl());
      next = applyScimPatch(current, body!["Operations"]);
    } catch (err) {
      return scimError(reply, 400, (err as Error).message, "invalidPath");
    }
    return save(existing, next, reply, false);
  });

  fastify.delete("/Users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.bizmoIdIdentity.findUnique({ where: { id } });
    if (!existing) return scimError(reply, 404, "Kullanıcı bulunamadı");
    await deactivateBySub(cfg!, existing.externalId, null);
    await prisma.bizmoIdIdentity.delete({ where: { id } });
    return reply.status(204).send();
  });

  fastify.all("/Groups", async (_request, reply) => scimError(reply, 501, "Groups desteklenmiyor"));
  fastify.all("/Groups/*", async (_request, reply) => scimError(reply, 501, "Groups desteklenmiyor"));
};

export default scimRoutes;
