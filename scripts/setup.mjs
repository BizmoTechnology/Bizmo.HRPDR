#!/usr/bin/env node
/**
 * Yerel geliştirme ortamını tek komutla hazırlar (Windows / macOS / Linux):
 *
 *   npm run setup        → .env, PostgreSQL, migrasyonlar ve örnek veriler
 *   npm run local        → setup + tüm uygulamaları başlatır
 *
 * Adımlar:
 *  1. server/.env yoksa .env.example'dan oluşturur; yer tutucu JWT/şifreleme
 *     anahtarlarını rastgele değerlerle değiştirir.
 *  2. DATABASE_URL'deki PostgreSQL'e bağlanmayı dener; yerel adreste kapalıysa
 *     Docker ile (docker-compose.yml → postgres) başlatır ve hazır olmasını bekler.
 *  3. prisma generate + migrate deploy (veritabanı yoksa oluşturulur).
 *  4. Hiç kullanıcı yoksa örnek verileri yükler (--seed ile her zaman yükler).
 *  5. 3000/3001/3002 portları doluysa uyarır.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, "server");
const envPath = path.join(serverDir, ".env");
const examplePath = path.join(root, ".env.example");
const forceSeed = process.argv.includes("--seed");

const color = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = color("32");
const yellow = color("33");
const red = color("31");
const bold = color("1");

const step = (msg) => console.log(`\n${bold("▶")} ${msg}`);
const ok = (msg) => console.log(`  ${green("✓")} ${msg}`);
const note = (msg) => console.log(`  ${yellow("!")} ${msg}`);

function fail(msg, hints = []) {
  console.error(`\n${red("✗")} ${msg}`);
  for (const h of hints) console.error(`  → ${h}`);
  process.exit(1);
}

/**
 * Komutu çalıştırır. Windows'ta npm/npx .cmd dosyası olduğundan kabuk üzerinden
 * tek satır olarak çalıştırılır (argümanlarda boşluk yok).
 */
function run(cmd, args, opts = {}) {
  const isWin = process.platform === "win32";
  const res = spawnSync(isWin ? [cmd, ...args].join(" ") : cmd, isWin ? [] : args, {
    cwd: opts.cwd ?? root,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: opts.capture ? "pipe" : "inherit",
    shell: isWin,
    encoding: "utf8",
  });
  return {
    code: res.status ?? 1,
    output: `${res.stdout ?? ""}${res.stderr ?? ""}`,
    error: res.error,
  };
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out[m[1]] = value;
  }
  return out;
}

function tcpReachable(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 0. Ön koşullar ─────────────────────────────────────────────────────────
const [major] = process.versions.node.split(".").map(Number);
if (major < 20) {
  fail(`Node.js ${process.versions.node} bulundu; en az 20 gerekli.`, [
    "https://nodejs.org adresinden Node.js 20 LTS veya üstünü kurun.",
  ]);
}

if (!existsSync(path.join(root, "node_modules"))) {
  step("Bağımlılıklar kuruluyor (npm install)…");
  if (run("npm", ["install"]).code !== 0) fail("npm install başarısız oldu.");
}

// ── 1. server/.env ─────────────────────────────────────────────────────────
step("Ortam dosyası (server/.env)");
if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  ok(".env.example → server/.env kopyalandı");
}

let envText = readFileSync(envPath, "utf8");
const replacements = [
  [/^JWT_SECRET=change-me.*$/m, () => `JWT_SECRET=${randomBytes(48).toString("hex")}`],
  [/^JWT_REFRESH_SECRET=change-me.*$/m, () => `JWT_REFRESH_SECRET=${randomBytes(48).toString("hex")}`],
  [/^ENCRYPTION_KEY=0{64}\s*$/m, () => `ENCRYPTION_KEY=${randomBytes(32).toString("hex")}`],
];
let replaced = 0;
for (const [pattern, make] of replacements) {
  if (pattern.test(envText)) {
    envText = envText.replace(pattern, make());
    replaced++;
  }
}
if (replaced > 0) {
  writeFileSync(envPath, envText);
  ok(`${replaced} yer tutucu anahtar rastgele değerle değiştirildi`);
} else {
  ok("server/.env hazır");
}

const env = parseEnv(envText);
if (!env.DATABASE_URL) {
  fail("server/.env içinde DATABASE_URL tanımlı değil.", [
    "Örnek: DATABASE_URL=postgresql://postgres:Bizmo.2025%2A@localhost:4455/Bizmo.HRPDR",
  ]);
}

let dbUrl;
try {
  dbUrl = new URL(env.DATABASE_URL);
} catch {
  fail(`DATABASE_URL geçerli bir adres değil: ${env.DATABASE_URL}`, [
    "Şifrede özel karakter varsa URL kodlayın (ör. * → %2A, @ → %40).",
  ]);
}
const dbHost = dbUrl.hostname || "localhost";
const dbPort = Number(dbUrl.port || 5432);
const isLocalDb = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(dbHost);

// ── 2. PostgreSQL ──────────────────────────────────────────────────────────
step(`PostgreSQL (${dbHost}:${dbPort})`);
if (await tcpReachable(dbHost, dbPort)) {
  ok("Bağlantı açık");
} else if (!isLocalDb) {
  fail(`${dbHost}:${dbPort} adresindeki PostgreSQL sunucusuna ulaşılamıyor.`, [
    "Sunucunun çalıştığını ve ağdan erişilebilir olduğunu kontrol edin.",
    "Veya server/.env içindeki DATABASE_URL'i düzeltin.",
  ]);
} else {
  note("Çalışan bir PostgreSQL bulunamadı; Docker ile başlatılıyor…");
  const dockerInfo = run("docker", ["info"], { capture: true });
  if (dockerInfo.error || dockerInfo.code !== 0) {
    fail("Docker çalışmıyor veya kurulu değil, PostgreSQL başlatılamadı.", [
      "Docker Desktop'ı açın, simgesi 'running' olana kadar bekleyip bu komutu tekrar çalıştırın.",
      `Ya da kendi PostgreSQL sunucunuzu ${dbPort} portunda çalıştırın / DATABASE_URL'i ona göre düzenleyin.`,
    ]);
  }
  if (run("docker", ["compose", "up", "-d", "postgres"]).code !== 0) {
    fail("docker compose up -d postgres başarısız oldu.", [
      `${dbPort} portu başka bir uygulama tarafından kullanılıyor olabilir.`,
    ]);
  }
  let up = false;
  for (let i = 0; i < 45 && !up; i++) {
    await sleep(2000);
    up = await tcpReachable(dbHost, dbPort);
  }
  if (!up) fail(`PostgreSQL ${dbPort} portunda 90 saniye içinde açılmadı.`, ["docker compose logs postgres"]);
  // Port açıldıktan sonra sunucunun bağlantı kabul etmesi birkaç saniye sürebilir
  await sleep(3000);
  ok("PostgreSQL Docker'da çalışıyor");
}

// ── 3. Prisma ──────────────────────────────────────────────────────────────
step("Prisma istemcisi oluşturuluyor");
if (run("npx", ["prisma", "generate"], { cwd: serverDir }).code !== 0) {
  fail("prisma generate başarısız oldu.");
}

step("Veritabanı şeması uygulanıyor (prisma migrate deploy)");
function migrateDeploy() {
  return run("npx", ["prisma", "migrate", "deploy"], { cwd: serverDir, capture: true });
}
let migrate = migrateDeploy();
for (let i = 0; i < 5 && migrate.code !== 0 && /P1001|P1017|Can't reach database/i.test(migrate.output); i++) {
  await sleep(3000);
  migrate = migrateDeploy();
}
if (migrate.code !== 0 && /P3005/.test(migrate.output)) {
  // `prisma db push` ile oluşturulmuş veritabanı: eski migrasyonları uygulanmış say (bkz. KURULUM.md §4)
  note("Mevcut şema migrasyon geçmişi olmadan oluşturulmuş; temel migrasyonlar uygulanmış olarak işaretleniyor…");
  for (const name of [
    "20250101000000_init",
    "20250420120000_ai_chat_conversations",
    "20260219120000_assessment_session_optional_columns",
  ]) {
    run("npx", ["prisma", "migrate", "resolve", "--applied", name], { cwd: serverDir, capture: true });
  }
  migrate = migrateDeploy();
}
if (migrate.code !== 0) {
  console.error(migrate.output);
  const hints = [];
  if (/P1000|authentication failed/i.test(migrate.output)) {
    hints.push("Kullanıcı adı/şifre hatalı. DATABASE_URL'deki şifreyi kontrol edin (* → %2A).");
    hints.push("Docker volume'u eski bir şifreyle oluşturulduysa: docker compose down -v (VERİLER SİLİNİR).");
  }
  fail("Migrasyonlar uygulanamadı.", hints);
}
ok("Şema güncel");

// ── 4. Örnek veriler ───────────────────────────────────────────────────────
step("Örnek veriler");
let userCount = -1;
try {
  const requireFromServer = createRequire(path.join(serverDir, "package.json"));
  process.env.DATABASE_URL = env.DATABASE_URL;
  const { PrismaClient } = requireFromServer("@prisma/client");
  const prisma = new PrismaClient();
  userCount = await prisma.user.count();
  await prisma.$disconnect();
} catch (err) {
  note(`Kullanıcı sayısı okunamadı (${err.message}); örnek veriler yükleniyor.`);
}
if (forceSeed || userCount <= 0) {
  if (run("npm", ["run", "prisma:seed", "-w", "server"]).code !== 0) {
    fail("Örnek veriler yüklenemedi.");
  }
  ok("Örnek veriler yüklendi");
} else {
  ok(`Veritabanında ${userCount} kullanıcı var; örnek veri atlandı (yeniden yüklemek için: npm run setup -- --seed)`);
}

// ── 5. Portlar ─────────────────────────────────────────────────────────────
step("Uygulama portları");
const ports = [
  [3001, "API"],
  [3000, "Yönetim paneli"],
  [3002, "Personel portalı"],
];
let busy = 0;
for (const [port, name] of ports) {
  if (!(await tcpReachable("localhost", port, 1000))) continue;
  busy++;
  note(`${port} portu kullanımda (${name}). Uygulama zaten çalışıyor olabilir; değilse o portu kullanan programı kapatın.`);
}
if (busy === 0) ok("3000, 3001 ve 3002 boş");

console.log(`
${green(bold("Kurulum tamam."))}

  Başlatmak için:   ${bold("npm run dev")}

  Yönetim paneli:   http://localhost:3000   admin@example.com / Admin1234!
  Personel portalı: http://localhost:3002   P001 / Portal123!
  API:              http://localhost:3001/health
`);
