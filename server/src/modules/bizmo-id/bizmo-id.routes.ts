import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { issuePortalSession, signTokens } from "../auth/auth.service.js";
import { setAdminRefreshCookie } from "../auth/cookies.js";
import {
  bizmoIdStatus,
  loginPageUrl,
  safeReturnTo,
  type BizmoIdConfig,
  type SsoApp,
} from "./config.js";
import {
  SsoError,
  identityFromClaims,
  resolveAdminUser,
  resolvePortalPersonnel,
  revokeSessionsBySub,
  syncLinkedUserProfile,
  type SsoErrorCode,
} from "./accounts.js";
import { claimFlow, completeFlow, discardFlow, peekFlowApp, redeemHandoff, startFlow } from "./flow.js";
import {
  OidcError,
  buildAuthorizationUrl,
  buildEndSessionUrl,
  exchangeCode,
  getProvider,
  hasAppAccess,
  verifyAccessToken,
  verifyIdToken,
  verifyLogoutToken,
} from "./oidc.js";
import { handleIdentityEvent, verifyWebhook } from "./webhook.js";

/**
 * Bizmo.ID ile giriş (OIDC Authorization Code + PKCE), webhook ve back-channel logout.
 *
 *  GET  /api/auth/mode                          giriş ekranı: mod ve Bizmo.ID durumu
 *  GET  /api/auth/bizmo-id/login                Bizmo.ID'ye yönlendirir (state, nonce, PKCE)
 *  GET  /api/auth/bizmo-id/callback             kod → token → doğrulama → eşleme → uygulamaya devir
 *  POST /api/auth/bizmo-id/exchange             devir kodu → HRPDR oturumu (aynı tarayıcı)
 *  POST /api/auth/bizmo-id/logout               Bizmo.ID çıkış adresi (end_session)
 *  POST /api/auth/bizmo-id/webhook              HMAC imzalı Bizmo.ID olayları
 *  POST /api/auth/bizmo-id/backchannel-logout   Keycloak logout_token
 */

const BIND_COOKIE = "ph_sso_bind";
const BIND_COOKIE_PATH = "/api/auth/bizmo-id";
const ID_TOKEN_COOKIE: Record<SsoApp, string> = { admin: "ph_bzid_admin", portal: "ph_bzid_portal" };
/** Çerez sınırı 4 KB; daha büyük id_token saklanmaz (çıkışta Bizmo.ID onay sorar) */
const MAX_ID_TOKEN_COOKIE = 3500;
/** Portal girişinde (prompt=login) kimlik doğrulaması bu süreden eski olamaz */
const PORTAL_MAX_AUTH_AGE_SEC = 10 * 60;

const secureCookies = () => process.env["NODE_ENV"] === "production";

const appSchema = z.enum(["admin", "portal"]);
const loginQuerySchema = z.object({
  app: appSchema.default("admin"),
  returnTo: z.string().max(512).optional(),
  rememberMe: z.enum(["0", "1", "true", "false"]).optional(),
});
const exchangeBodySchema = z.object({ code: z.string().min(20).max(200), app: appSchema });
const logoutBodySchema = z.object({ app: appSchema, force: z.boolean().optional() });

/** Giriş ekranının Bizmo.ID düğmesi için IdP erişilebilirliği (en çok 2,5 sn beklenir) */
async function providerReachable(cfg: BizmoIdConfig): Promise<boolean> {
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2_500).unref());
  return Promise.race([getProvider(cfg).then(() => true, () => false), timeout]);
}

function errorRedirect(reply: FastifyReply, cfg: BizmoIdConfig | null, app: SsoApp, code: SsoErrorCode) {
  const base = cfg
    ? loginPageUrl(cfg, app)
    : `${(app === "portal" ? process.env["PORTAL_URL"] : process.env["APP_URL"]) ?? ""}/login`;
  return reply.redirect(`${base}?sso_error=${encodeURIComponent(code)}`, 303);
}

const bizmoIdRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Giriş ekranı: mod ve Bizmo.ID durumu ─────────────
  fastify.get("/mode", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (_request, reply) => {
    const status = bizmoIdStatus();
    const cfg = status.config;
    const available = cfg ? await providerReachable(cfg) : false;
    // Bizmo.ID bağlı değilse merkezi modda da yerel giriş açık kalır (kimse dışarıda kalmasın)
    const localLogin = status.mode === "central" && cfg ? "super_admin" : "all";
    return reply.header("cache-control", "no-store").send({
      data: {
        mode: status.mode,
        localLogin,
        bizmoId: {
          enabled: status.mode !== "local",
          configured: status.configured,
          available,
          portal: !!cfg?.portalEnabled,
        },
      },
    });
  });

  // ── Bizmo.ID'ye yönlendir ────────────────────────────
  fastify.get(
    "/bizmo-id/login",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = loginQuerySchema.safeParse(request.query);
      const app: SsoApp = parsed.success ? parsed.data.app : "admin";
      const cfg = bizmoIdStatus().config;
      if (!parsed.success) return errorRedirect(reply, cfg, app, "INVALID_FLOW");
      if (!cfg) return errorRedirect(reply, null, app, "NOT_CONFIGURED");
      if (app === "portal" && !cfg.portalEnabled) return errorRedirect(reply, cfg, app, "PORTAL_DISABLED");

      try {
        const flow = await startFlow({
          app,
          returnTo: safeReturnTo(parsed.data.returnTo, app),
          rememberMe: parsed.data.rememberMe === "1" || parsed.data.rememberMe === "true",
        });
        const url = await buildAuthorizationUrl(cfg, { ...flow, forceLogin: app === "portal" });
        return reply
          .setCookie(BIND_COOKIE, flow.binding, {
            httpOnly: true,
            secure: secureCookies(),
            // Bizmo.ID'den dönüş üst düzey GET yönlendirmesidir: Lax çerezi taşır
            sameSite: "lax",
            path: BIND_COOKIE_PATH,
            maxAge: 10 * 60,
          })
          .header("cache-control", "no-store")
          .redirect(url, 303);
      } catch (err) {
        request.log.warn({ err: (err as Error).message }, "bizmo_id.login_failed");
        return errorRedirect(reply, cfg, app, err instanceof OidcError ? "IDP_UNAVAILABLE" : "INVALID_FLOW");
      }
    },
  );

  // ── Bizmo.ID dönüşü ──────────────────────────────────
  fastify.get(
    "/bizmo-id/callback",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const q = request.query as Record<string, string | undefined>;
      const cfg = bizmoIdStatus().config;
      const app: SsoApp = (await peekFlowApp(typeof q["state"] === "string" ? q["state"] : undefined)) ?? "admin";
      if (!cfg) return errorRedirect(reply, null, app, "NOT_CONFIGURED");
      if (typeof q["state"] !== "string") return errorRedirect(reply, cfg, app, "INVALID_FLOW");

      let flow;
      try {
        flow = await claimFlow(q["state"], request.cookies?.[BIND_COOKIE]);
      } catch (err) {
        request.log.warn({ reason: (err as Error).message }, "bizmo_id.callback_invalid_flow");
        return errorRedirect(reply, cfg, app, "INVALID_FLOW");
      }

      try {
        // Kullanıcı iptal etti / erişimi yok / Keycloak hatası
        if (typeof q["error"] === "string") {
          throw new SsoError(q["error"] === "access_denied" ? "ACCESS_DENIED" : "IDP_ERROR", `Bizmo.ID: ${q["error"]}`);
        }
        if (typeof q["code"] !== "string" || !q["code"]) throw new SsoError("INVALID_FLOW", "code yok");
        // RFC 9207: iss parametresi geldiyse issuer ile aynı olmalı (karışık sağlayıcı saldırısı)
        if (typeof q["iss"] === "string" && q["iss"] !== cfg.issuer) throw new SsoError("TOKEN_INVALID", "iss eşleşmedi");

        const tokens = await exchangeCode(cfg, q["code"], flow.codeVerifier);
        const claims = await verifyIdToken(cfg, tokens.idToken, flow.nonce);
        if (flow.app === "portal") {
          const authTime = typeof claims["auth_time"] === "number" ? claims["auth_time"] : 0;
          if (Date.now() / 1000 - authTime > PORTAL_MAX_AUTH_AGE_SEC) {
            throw new SsoError("TOKEN_INVALID", "Portal girişi yeni kimlik doğrulaması gerektirir");
          }
        }
        const accessClaims = tokens.accessToken ? await verifyAccessToken(cfg, tokens.accessToken) : null;
        if (!hasAppAccess(claims, cfg.clientId) && !hasAppAccess(accessClaims, cfg.clientId)) {
          throw new SsoError("ACCESS_DENIED", "Uygulama erişim rolü yok");
        }
        const identity = identityFromClaims(claims);
        // Denetim için: ikinci adım (OTP/passkey) Bizmo.ID'de yapılır; acr/amr kayda yazılır
        const authMeta = {
          sub: identity.sub,
          acr: typeof claims.acr === "string" ? claims.acr : null,
          amr: Array.isArray(claims.amr) ? claims.amr.filter((v) => typeof v === "string") : [],
          sid: typeof claims.sid === "string" ? claims.sid : null,
        };

        let subjectId: string;
        if (flow.app === "portal") {
          const person = await resolvePortalPersonnel(cfg, identity);
          subjectId = person.id;
        } else {
          const user = await resolveAdminUser(cfg, identity);
          await syncLinkedUserProfile(user.id, { name: identity.name, email: identity.emailVerified ? identity.email : null });
          subjectId = user.id;
        }
        await completeFlow(flow.id, subjectId, tokens.idToken, authMeta);
        request.log.info(
          { app: flow.app, subjectId, acr: authMeta.acr, amr: authMeta.amr },
          "bizmo_id.login",
        );

        const base = flow.app === "portal" ? cfg.portalUrl : cfg.appUrl;
        // Devir kodu adres parçasında (#) taşınır: sunucu loglarına ve Referer'a düşmez
        return reply
          .header("cache-control", "no-store")
          .header("referrer-policy", "no-referrer")
          .redirect(`${base}/auth/bizmo-id#code=${encodeURIComponent(flow.handoff)}`, 303);
      } catch (err) {
        await discardFlow(flow.id).catch(() => undefined);
        const code: SsoErrorCode =
          err instanceof SsoError
            ? err.code
            : err instanceof OidcError
              ? err.code === "IDP_UNAVAILABLE"
                ? "IDP_UNAVAILABLE"
                : "TOKEN_INVALID"
              : "IDP_ERROR";
        request.log.warn({ code, reason: (err as Error).message, app: flow.app }, "bizmo_id.login_rejected");
        return errorRedirect(reply, cfg, flow.app, code);
      }
    },
  );

  // ── Devir kodu → HRPDR oturumu ───────────────────────
  fastify.post(
    "/bizmo-id/exchange",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const cfg = bizmoIdStatus().config;
      const body = exchangeBodySchema.safeParse(request.body);
      if (!cfg || !body.success) {
        return reply.status(400).send({ code: "INVALID_FLOW", message: "Geçersiz istek", traceId: request.traceId });
      }
      const { app } = body.data;
      let handoff;
      try {
        handoff = await redeemHandoff(body.data.code, request.cookies?.[BIND_COOKIE], app);
      } catch {
        return reply.status(400).send({
          code: "INVALID_FLOW",
          message: "Giriş bağlantısının süresi doldu. Lütfen yeniden deneyin.",
          traceId: request.traceId,
        });
      }

      reply.clearCookie(BIND_COOKIE, { path: BIND_COOKIE_PATH });
      if (handoff.idToken && handoff.idToken.length <= MAX_ID_TOKEN_COOKIE) {
        reply.setCookie(ID_TOKEN_COOKIE[app], handoff.idToken, {
          httpOnly: true,
          secure: secureCookies(),
          sameSite: "strict",
          path: BIND_COOKIE_PATH,
          maxAge: handoff.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 24 * 7,
        });
      }

      if (app === "portal") {
        const person = await prisma.personnel.findUnique({ where: { id: handoff.subjectId } });
        if (!person || person.deletedAt || person.status !== "ACTIVE") {
          return reply.status(403).send({ code: "ACCOUNT_DISABLED", message: "Hesap etkin değil", traceId: request.traceId });
        }
        const session = await issuePortalSession(fastify, person);
        return reply.send({ data: { ...session, returnTo: handoff.returnTo, idp: "bizmo-id" } });
      }

      const user = await prisma.user.findUnique({
        where: { id: handoff.subjectId },
        include: { organization: true },
      });
      if (!user || !user.isActive || user.deletedAt) {
        return reply.status(403).send({ code: "ACCOUNT_DISABLED", message: "Hesap etkin değil", traceId: request.traceId });
      }
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      const tokens = await signTokens(
        fastify,
        { sub: user.id, role: user.role, orgId: user.organizationId },
        handoff.rememberMe,
      );
      setAdminRefreshCookie(reply, tokens.refreshToken, handoff.rememberMe);
      return reply.send({
        data: {
          accessToken: tokens.accessToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            organization: { id: user.organization.id, name: user.organization.name },
          },
          returnTo: handoff.returnTo,
          idp: "bizmo-id",
        },
      });
    },
  );

  // ── Bizmo.ID oturumunu da kapat ──────────────────────
  // POST + JSON: başka bir siteden tetiklenemez (CORS ön kontrolü, SameSite çerez)
  fastify.post(
    "/bizmo-id/logout",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const cfg = bizmoIdStatus().config;
      const body = logoutBodySchema.safeParse(request.body);
      if (!cfg || !body.success) return reply.send({ data: { url: null } });
      const { app, force } = body.data;
      const idToken = request.cookies?.[ID_TOKEN_COOKIE[app]] ?? null;
      reply.clearCookie(ID_TOKEN_COOKIE[app], { path: BIND_COOKIE_PATH });
      if (!idToken && !force) return reply.send({ data: { url: null } });
      try {
        const url = await buildEndSessionUrl(cfg, loginPageUrl(cfg, app), idToken);
        return reply.send({ data: { url } });
      } catch {
        return reply.send({ data: { url: null } });
      }
    },
  );

  // ── Webhook (ham gövde ile HMAC) ─────────────────────
  await fastify.register(async (scope) => {
    scope.removeContentTypeParser("application/json");
    scope.addContentTypeParser("application/json", { parseAs: "string", bodyLimit: 256 * 1024 }, (_req, body, done) =>
      done(null, body),
    );
    scope.post(
      "/bizmo-id/webhook",
      { config: { rateLimit: { max: 600, timeWindow: "1 minute" } } },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const cfg = bizmoIdStatus().config;
        if (!cfg) return reply.status(404).send({ code: "NOT_CONFIGURED", message: "Bizmo.ID bağlı değil" });
        if (!cfg.webhookSecret) {
          request.log.warn("bizmo_id.webhook_secret_missing");
          return reply.status(503).send({ code: "NOT_CONFIGURED", message: "BIZMO_ID_WEBHOOK_SECRET tanımlı değil" });
        }
        const rawBody = typeof request.body === "string" ? request.body : "";
        const v = verifyWebhook({
          secret: cfg.webhookSecret,
          rawBody,
          headers: request.headers as Record<string, string | string[] | undefined>,
        });
        if (!v.ok) {
          request.log.warn({ reason: v.reason }, "bizmo_id.webhook_rejected");
          return reply.status(401).send({ code: "INVALID_SIGNATURE", message: v.reason });
        }
        const outcome = await handleIdentityEvent(cfg, v.event);
        request.log.info(
          { type: v.event.type, delivery: request.headers["x-bizmo-delivery"], ...outcome },
          "bizmo_id.webhook",
        );
        return reply.send({ ok: true, ...(outcome.action === "ignored" ? { ignored: true } : {}) });
      },
    );
  });

  // ── Back-channel logout (application/x-www-form-urlencoded) ──
  await fastify.register(async (scope) => {
    scope.addContentTypeParser(
      "application/x-www-form-urlencoded",
      { parseAs: "string", bodyLimit: 16 * 1024 },
      (_req, body, done) => done(null, Object.fromEntries(new URLSearchParams(body as string))),
    );
    scope.post(
      "/bizmo-id/backchannel-logout",
      { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } },
      async (request: FastifyRequest, reply: FastifyReply) => {
        reply.header("cache-control", "no-store");
        const cfg = bizmoIdStatus().config;
        if (!cfg) return reply.status(404).send();
        const token = (request.body as Record<string, string> | undefined)?.["logout_token"];
        if (!token) return reply.status(400).send({ error: "invalid_request" });
        try {
          const { sub, sid } = await verifyLogoutToken(cfg, token);
          // Yerel oturumlar Keycloak sid'ine bağlı değil: kişinin tüm oturumları kapatılır
          const result = sub ? await revokeSessionsBySub(sub) : { users: 0, personnel: 0 };
          request.log.info({ hasSub: !!sub, hasSid: !!sid, ...result }, "bizmo_id.backchannel_logout");
          return reply.status(200).send();
        } catch (err) {
          request.log.warn({ reason: (err as Error).message }, "bizmo_id.backchannel_logout_rejected");
          return reply.status(400).send({ error: "invalid_request" });
        }
      },
    );
  });
};

export default bizmoIdRoutes;
