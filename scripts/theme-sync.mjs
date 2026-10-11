#!/usr/bin/env node
/**
 * @bizmo/theme kopyasını (packages/theme) Bizmo.UniversalTheme deposundan yeniler.
 *
 *   node scripts/theme-sync.mjs [../Bizmo.UniversalTheme]
 *
 * Kopya elle düzenlenmez; tema değişikliği Bizmo.UniversalTheme deposunda yapılır, sonra bu betik çalıştırılır.
 * Görsel regresyon tabanları (tests/) uygulamada kullanılmadığı için kopyalanmaz.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(process.argv[2] ?? join(root, "..", "Bizmo.UniversalTheme"));
const target = join(root, "packages", "theme");
const SKIP = new Set([".git", "node_modules", "tests"]);

if (!existsSync(join(source, "tokens.json"))) {
  console.error(`Tema deposu bulunamadı: ${source}`);
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
  recursive: true,
  filter: (src) => !relative(source, src).split(/[\\/]/).some((part) => SKIP.has(part)),
});

let commit = "bilinmiyor";
try {
  commit = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {}
const { version } = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
writeFileSync(join(root, "packages", "theme.version"), `@bizmo/theme ${version}\nkaynak: BizmoTechnology/Bizmo.UniversalTheme@${commit}\n`);
console.log(`@bizmo/theme ${version} (${commit.slice(0, 7)}) → packages/theme`);
