/**
 * Bizmo.ID entegrasyonu birim testleri (veritabanı gerektirmez).
 * Çalıştırma: npm test -w server
 *
 * OIDC doğrulaması, testte üretilen bir anahtar çiftiyle imzalanan token'larla ve yerel bir
 * discovery sunucusuyla denenir; gerçek Bizmo.ID'ye istek gitmez.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWK } from "jose";
import { safeReturnTo, type BizmoIdConfig } from "./config.js";
import { signWebhook, verifyWebhook } from "./webhook.js";
import { applyScimPatch, extractScimUser, parseScimFilter } from "./scim.routes.js";
import { identityFromClaims } from "./accounts.js";
import {
  BACKCHANNEL_LOGOUT_EVENT,
  buildAuthorizationUrl,
  hasAppAccess,
  pkceChallenge,
  setOidcTestOverrides,
  verifyIdToken,
  verifyLogoutToken,
} from "./oidc.js";

describe("safeReturnTo (açık yönlendirme yok)", () => {
  it("uygulama içi yolları kabul eder", () => {
    assert.equal(safeReturnTo("/personnel?page=2", "admin"), "/personnel?page=2");
    assert.equal(safeReturnTo("/reviews", "portal"), "/reviews");
  });
  it("dış adresleri ve hileli yolları reddeder", () => {
    for (const bad of [
      "https://evil.example/x",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "/%0d%0aSet-Cookie:x",
      "/a\nb",
      "",
      "/login?next=/x",
      "/auth/bizmo-id",
      123,
      undefined,
    ]) {
      const out = safeReturnTo(bad, "admin");
      assert.ok(out.startsWith("/") && !out.startsWith("//"), `güvensiz: ${String(bad)} → ${out}`);
      assert.ok(!out.includes("evil"), `dış adres geçti: ${String(bad)}`);
    }
    assert.equal(safeReturnTo("//evil.example", "admin"), "/dashboard");
    assert.equal(safeReturnTo("https://evil.example", "portal"), "/");
  });
});

describe("webhook imzası", () => {
  const secret = "whsec_test_" + "x".repeat(24);
  const body = JSON.stringify({ id: "e1", type: "user.disabled", createdAt: new Date().toISOString(), data: { user: { id: "sub-1" } } });
  const now = Math.floor(Date.now() / 1000);

  it("geçerli imzayı kabul eder", () => {
    const v = verifyWebhook({
      secret,
      rawBody: body,
      headers: { "x-bizmo-timestamp": String(now), "x-bizmo-signature": signWebhook(secret, body, now) },
      nowSec: now,
    });
    assert.equal(v.ok, true);
    if (v.ok) assert.equal(v.event.type, "user.disabled");
  });
  it("değiştirilmiş gövdeyi, yanlış sırrı ve eski zamanı reddeder", () => {
    const sig = signWebhook(secret, body, now);
    assert.equal(verifyWebhook({ secret, rawBody: body + " ", headers: { "x-bizmo-timestamp": String(now), "x-bizmo-signature": sig }, nowSec: now }).ok, false);
    assert.equal(verifyWebhook({ secret: secret + "y", rawBody: body, headers: { "x-bizmo-timestamp": String(now), "x-bizmo-signature": sig }, nowSec: now }).ok, false);
    const old = now - 301;
    assert.equal(
      verifyWebhook({ secret, rawBody: body, headers: { "x-bizmo-timestamp": String(old), "x-bizmo-signature": signWebhook(secret, body, old) }, nowSec: now }).ok,
      false,
    );
    assert.equal(verifyWebhook({ secret, rawBody: body, headers: {}, nowSec: now }).ok, false);
  });
});

describe("SCIM", () => {
  it("filtreyi ayrıştırır", () => {
    assert.deepEqual(parseScimFilter('externalId eq "abc-1"'), { attr: "externalid", value: "abc-1" });
    assert.deepEqual(parseScimFilter('userName eq "a\\"b@x.com"'), { attr: "username", value: 'a"b@x.com' });
    assert.equal(parseScimFilter('userName co "a"'), null);
    assert.equal(parseScimFilter('password eq "x"'), null);
  });
  it("Bizmo.ID kaynağından eşleme alanlarını çıkarır", () => {
    const u = extractScimUser({
      externalId: "sub-1",
      userName: "Ayse@Bizmo.com.tr",
      active: false,
      name: { givenName: "Ayşe", familyName: "Kaya", formatted: "Ayşe Kaya" },
      emails: [{ value: "Ayse@Bizmo.com.tr", type: "work", primary: true }],
      "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": { employeeNumber: "E1024" },
    });
    assert.equal(u.email, "ayse@bizmo.com.tr");
    assert.equal(u.employeeNumber, "E1024");
    assert.equal(u.displayName, "Ayşe Kaya");
    assert.equal(u.active, false);
  });
  it("PATCH işlemlerini uygular (yollu ve Entra'nın yolsuz biçimi)", () => {
    const base = { userName: "a@x.com", active: true, name: { givenName: "A" }, emails: [{ value: "a@x.com", primary: true }] };
    const p1 = applyScimPatch(base, [{ op: "replace", path: "active", value: false }]);
    assert.equal(p1["active"], false);
    assert.equal(base.active, true, "kaynak değişmemeli");
    const p2 = applyScimPatch(base, [{ op: "Replace", value: { "name.familyName": "B", displayName: "A B" } }]);
    assert.deepEqual(p2["name"], { givenName: "A", familyName: "B" });
    const p3 = applyScimPatch(base, [{ op: "replace", path: 'emails[type eq "work"].value', value: "b@x.com" }]);
    assert.equal((p3["emails"] as Array<{ value: string }>)[0]!.value, "b@x.com");
    assert.throws(() => applyScimPatch(base, [{ op: "move", path: "active" }]));
    assert.throws(() => applyScimPatch(base, [{ op: "remove" }]));
  });
});

describe("id_token claim eşlemesi", () => {
  it("org.employee_number ve doğrulanmış e-postayı okur", () => {
    const id = identityFromClaims({
      sub: "s1",
      email: "Ali@Bizmo.com.tr",
      email_verified: true,
      given_name: "Ali",
      family_name: "Veli",
      org: { employee_number: "P001" },
    });
    assert.deepEqual(id, { sub: "s1", email: "ali@bizmo.com.tr", emailVerified: true, name: "Ali Veli", employeeNumber: "P001" });
    assert.equal(identityFromClaims({ sub: "s2", email: "x@y", email_verified: "true" }).emailVerified, false);
  });
});

describe("OIDC token doğrulaması", () => {
  let server: Server;
  let cfg: BizmoIdConfig;
  let privateKey: CryptoKey;
  let otherKey: CryptoKey;
  const clientId = "bizmo-hrpdr";

  before(async () => {
    const pair = await generateKeyPair("RS256", { extractable: true });
    privateKey = pair.privateKey as CryptoKey;
    otherKey = (await generateKeyPair("RS256")).privateKey as CryptoKey;
    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
    setOidcTestOverrides(createLocalJWKSet({ keys: [jwk] }));

    server = createServer((req, res) => {
      const { port } = server.address() as AddressInfo;
      const issuer = `http://127.0.0.1:${port}/realms/bizmo`;
      if (req.url === "/realms/bizmo/.well-known/openid-configuration") {
        res.setHeader("content-type", "application/json");
        res.end(
          JSON.stringify({
            issuer,
            authorization_endpoint: `${issuer}/protocol/openid-connect/auth`,
            token_endpoint: `${issuer}/protocol/openid-connect/token`,
            jwks_uri: `${issuer}/protocol/openid-connect/certs`,
            end_session_endpoint: `${issuer}/protocol/openid-connect/logout`,
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    cfg = {
      issuer: `http://127.0.0.1:${port}/realms/bizmo`,
      clientId,
      clientSecret: "test-secret",
      orgSlug: "test",
      apiPublicUrl: "http://localhost:3111",
      appUrl: "http://localhost:3110",
      portalUrl: "http://localhost:3115",
      portalEnabled: true,
      webhookSecret: null,
      scimToken: null,
      allowHttp: true,
    };
  });

  after(() => {
    setOidcTestOverrides(null);
    server.close();
  });

  const idToken = (claims: Record<string, unknown>, key: CryptoKey = privateKey, alg = "RS256") =>
    new SignJWT({ nonce: "n-1", email: "a@x.com", ...claims })
      .setProtectedHeader({ alg, kid: "k1" })
      .setIssuer(cfg.issuer)
      .setAudience(clientId)
      .setSubject("sub-1")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(key);

  it("yetkilendirme adresi PKCE S256, state ve nonce taşır", async () => {
    const url = new URL(await buildAuthorizationUrl(cfg, { state: "st", nonce: "nn", codeVerifier: "v".repeat(64), forceLogin: true }));
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("code_challenge"), pkceChallenge("v".repeat(64)));
    assert.equal(url.searchParams.get("state"), "st");
    assert.equal(url.searchParams.get("nonce"), "nn");
    assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3111/api/auth/bizmo-id/callback");
    assert.equal(url.searchParams.get("prompt"), "login");
  });

  it("geçerli id_token'ı kabul eder", async () => {
    const claims = await verifyIdToken(cfg, await idToken({ resource_access: { [clientId]: { roles: ["access"] } } }), "n-1");
    assert.equal(claims.sub, "sub-1");
    assert.equal(hasAppAccess(claims, clientId), true);
    assert.equal(hasAppAccess(claims, "bizmo-mail"), false);
  });

  it("nonce, imza, issuer, audience ve HS256 karışıklığını reddeder", async () => {
    await assert.rejects(verifyIdToken(cfg, await idToken({}), "baska-nonce"));
    await assert.rejects(verifyIdToken(cfg, await idToken({}, otherKey), "n-1"));
    const wrongIss = await new SignJWT({ nonce: "n-1" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer("https://evil.example/realms/bizmo")
      .setAudience(clientId).setSubject("s").setIssuedAt().setExpirationTime("5m")
      .sign(privateKey);
    await assert.rejects(verifyIdToken(cfg, wrongIss, "n-1"));
    const wrongAud = await new SignJWT({ nonce: "n-1" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(cfg.issuer).setAudience("bizmo-mail").setSubject("s").setIssuedAt().setExpirationTime("5m")
      .sign(privateKey);
    await assert.rejects(verifyIdToken(cfg, wrongAud, "n-1"));
    // İstemci sırrıyla imzalanmış HS256 token kabul edilmez
    const hs = await new SignJWT({ nonce: "n-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(cfg.issuer).setAudience(clientId).setSubject("s").setIssuedAt().setExpirationTime("5m")
      .sign(new TextEncoder().encode(cfg.clientSecret));
    await assert.rejects(verifyIdToken(cfg, hs, "n-1"));
    // Süresi dolmuş
    const expired = await new SignJWT({ nonce: "n-1" })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(cfg.issuer).setAudience(clientId).setSubject("s")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600).setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(privateKey);
    await assert.rejects(verifyIdToken(cfg, expired, "n-1"));
  });

  const logoutToken = (claims: Record<string, unknown>) =>
    new SignJWT({ events: { [BACKCHANNEL_LOGOUT_EVENT]: {} }, sid: "sid-1", ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "k1", typ: "logout+jwt" })
      .setIssuer(cfg.issuer)
      .setAudience(clientId)
      .setSubject("sub-1")
      .setIssuedAt()
      .setJti(crypto.randomUUID())
      .sign(privateKey);

  it("back-channel logout token'ını doğrular", async () => {
    assert.deepEqual(await verifyLogoutToken(cfg, await logoutToken({})), { sub: "sub-1", sid: "sid-1" });
  });

  it("nonce içeren veya olay tipi yanlış logout token'ını reddeder", async () => {
    await assert.rejects(verifyLogoutToken(cfg, await logoutToken({ nonce: "x" })));
    await assert.rejects(verifyLogoutToken(cfg, await logoutToken({ events: { other: {} } })));
  });
});
