// tokens.json → tokens.css + tokens.ts + platform dosyaları (SCSS, Swift, Kotlin, Dart) + dist/*.js (+ .d.ts)
// Kullanım: node scripts/build.mjs   (depo kökünde)
// tokens.json tek kaynaktır; üretilen dosyaları elle düzenlemeyin.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writePlatforms } from "./platforms.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = JSON.parse(fs.readFileSync(path.join(root, "tokens.json"), "utf8"));
const P = src.$extensions.bizmo.cssPrefix;

const isToken = (v) => v && typeof v === "object" && "$value" in v;
const ref = (v) => (typeof v === "string" ? v.replace(/\{primitive\.([\w-]+)\}/g, (_, k) => `var(--${P}-${k})`) : v);
const val = (t) => {
  if (t.$type === "cubicBezier") return `cubic-bezier(${t.$value.join(", ")})`;
  return ref(String(t.$value));
};
const block = (group, indent = "  ") =>
  Object.entries(group)
    .filter(([, t]) => isToken(t))
    .map(([k, t]) => `${indent}--${P}-${k}: ${val(t)};`)
    .join("\n");

const out = `/*
 * Bizmo Universal Theme · tokens.css (v${src.$extensions.bizmo.version})
 * Bu dosya tokens.json'dan üretilir: node scripts/build.mjs — elle düzenlemeyin.
 *
 * Tema seçimi:
 *   <html>                     → işletim sistemi temasını izler (prefers-color-scheme)
 *   <html data-theme="light">  → her zaman açık     <html data-theme="dark"> veya .dark → her zaman koyu
 *   <html data-contrast="more"> yüksek karşıtlık · data-transparency="reduced" düz yüzey · data-density="compact" sıkı · "field" saha
 */

:root {
${block(src.primitive)}

${block(src.scale)}

${block(src.light)}
  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]):not(.light) {
${block(src.dark, "    ")}
    color-scheme: dark;
  }
}

:root[data-theme="dark"],
:root.dark,
[data-theme="dark"] {
${block(src.dark)}
  color-scheme: dark;
}

:root[data-contrast="more"] {
${block(src["contrast-more"].light)}
}
:root[data-theme="dark"][data-contrast="more"],
:root.dark[data-contrast="more"] {
${block(src["contrast-more"].dark)}
}

:root[data-transparency="reduced"] {
  --${P}-glass-bg: var(--${P}-surface);
  --${P}-glass-strong: var(--${P}-surface);
  --${P}-sidebar-bg: var(--${P}-surface);
  --${P}-glass-blur: 0px;
}

:root[data-density="compact"] {
  --${P}-control-md: 32px;
  --${P}-field-h: 36px;
  --${P}-row-regular: 32px;
  --${P}-space-card: 14px;
}

/* Saha yoğunluğu: el terminali, hat başı, eldivenle kullanım — dokunma hedefi ≥ 56px (bir bölüme de verilebilir) */
:root[data-density="field"],
[data-density="field"] {
  --${P}-control-sm: 44px;
  --${P}-control-md: 56px;
  --${P}-control-lg: 64px;
  --${P}-field-h: 56px;
  --${P}-row-regular: 56px;
  --${P}-space-card: 20px;
}

/* Baskı: tema ne olursa olsun açık palet (koyu zemin toner harcar ve kâğıtta okunmaz) */
@media print {
  :root:not([data-theme="light"]):not(.light),
  [data-theme="dark"] {
${block(src.light, "    ")}
    color-scheme: light;
  }
}

/* Dokunmatik ekran: en küçük dokunma hedefi 44px (sıkı yoğunluk seçilse bile) */
@media (pointer: coarse) {
  :root,
  :root[data-density="compact"] {
    --${P}-control-sm: 36px;
    --${P}-control-md: 44px;
    --${P}-field-h: 44px;
  }
}
`;

fs.writeFileSync(path.join(root, "tokens.css"), out);
console.log(`tokens.css yazıldı (${out.split("\n").length} satır)`);

for (const f of writePlatforms(src, root)) console.log(`${f} yazıldı`);

// TypeScript yardımcıları → dist/*.js + *.d.ts (TS kullanmayan projeler ve önizleme sayfası için)
if (!process.argv.includes("--no-dist")) {
  const tsc = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");
  if (fs.existsSync(tsc)) {
    fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
    execFileSync(tsc, ["-p", "tsconfig.build.json"], { cwd: root, stdio: "inherit" });
    console.log("dist/ derlendi");
  } else {
    console.warn("Uyarı: typescript kurulu değil, dist/ derlenmedi (pnpm install)");
  }
}
