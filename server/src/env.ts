/**
 * Ortam değişkenlerini yükler ve kritik değerleri doğrular.
 *
 * Öncelik: süreç ortamı > server/.env > kök .env
 * (dotenv mevcut değerleri ezmez; bu yüzden önce server/.env yüklenir.)
 * Monorepo kökünden veya `server` klasöründen başlatıldığında aynı sonuç alınır.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(serverRoot, "..");

dotenv.config({ path: path.join(serverRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, ".env") });

const isProduction = process.env["NODE_ENV"] === "production";

function fail(message: string): never {
  // Logger henüz hazır değil; doğrudan stderr.
  console.error(`[env] ${message}`);
  process.exit(1);
}

function warn(message: string) {
  console.warn(`[env] ${message}`);
}

if (!process.env["DATABASE_URL"]) {
  fail("DATABASE_URL tanımlı değil. .env.example dosyasını .env olarak kopyalayıp doldurun.");
}

const jwtSecret = process.env["JWT_SECRET"] ?? "";
const refreshSecret = process.env["JWT_REFRESH_SECRET"] ?? "";

const weakSecret = (s: string) => s.length < 32 || s.startsWith("change-me");

if (isProduction) {
  if (weakSecret(jwtSecret)) fail("JWT_SECRET üretimde en az 32 karakter ve rastgele olmalı.");
  if (weakSecret(refreshSecret)) fail("JWT_REFRESH_SECRET üretimde en az 32 karakter ve rastgele olmalı.");
  if (jwtSecret === refreshSecret) fail("JWT_SECRET ve JWT_REFRESH_SECRET farklı olmalı.");
  const key = process.env["ENCRYPTION_KEY"] ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(key) || /^0+$/.test(key)) {
    fail("ENCRYPTION_KEY üretimde 64 karakterlik rastgele hex olmalı.");
  }
} else {
  if (!jwtSecret) warn("JWT_SECRET tanımlı değil; geliştirme için geçici bir değer kullanılıyor.");
  if (!refreshSecret) warn("JWT_REFRESH_SECRET tanımlı değil; geliştirme için geçici bir değer kullanılıyor.");
}

/** Access token imzalama anahtarı (geliştirmede güvenli olmayan varsayılan). */
export const JWT_ACCESS_SECRET = jwtSecret || "dev-access-secret";
/** Refresh token imzalama anahtarı; access anahtarından ayrı tutulur. */
export const JWT_REFRESH_SECRET = refreshSecret || "dev-refresh-secret";
