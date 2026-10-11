// Bizmo Universal Theme · kalite kontrolü
// Kullanım: node scripts/check.mjs   (CI'da da çalışır; sorun varsa çıkış kodu 1)
//  1. Üretilen dosyalar tokens.json ile güncel mi (tokens.css, tokens.ts, platforms/*, dist/*)
//  2. WCAG karşıtlığı: metin ≥ 4.5, metin dışı (odak, kontrol kenarı) ≥ 3 — açık, koyu, yüksek karşıtlık
//  3. Grafik paleti: renk körlüğü (Machado 2009) ve normal görüşte OKLab ΔE eşikleri
//  4. DESIGN.md ön bilgi (YAML) renkleri tokens.json ile aynı mı
//  5. DESIGN.md ve preview.html'de geçen bz- sınıfları components.css'te var mı
//  6. components.css'te kullanılan --bz-* değişkenleri tanımlı mı
//  7. Aynı bz- sınıfı iki ayrı bölümde üst düzeyde farklı değerlerle tanımlı mı (ad çakışması)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseColor } from "./platforms.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const src = JSON.parse(read("tokens.json"));
const results = [];
const fail = (area, msg) => results.push({ ok: false, area, msg });
const pass = (area, msg) => results.push({ ok: true, area, msg });

// ───────── 1 · Üretilen dosyalar güncel mi ─────────
{
  const generated = ["tokens.css", "tokens.ts", "platforms/scss/_bizmo-tokens.scss", "platforms/ios/BizmoTokens.swift", "platforms/android/BizmoTokens.kt", "platforms/flutter/bizmo_tokens.dart"];
  const distDir = path.join(root, "dist");
  const distFiles = fs.existsSync(distDir) ? fs.readdirSync(distDir).map((f) => "dist/" + f) : [];
  const before = new Map([...generated, ...distFiles].map((f) => [f, fs.existsSync(path.join(root, f)) ? read(f) : null]));
  execFileSync(process.execPath, [path.join(root, "scripts", "build.mjs")], { cwd: root, stdio: "ignore" });
  const stale = [...before].filter(([f, body]) => !fs.existsSync(path.join(root, f)) || read(f) !== body).map(([f]) => f);
  if (stale.length) fail("üretim", `Güncel değildi, yeniden üretildi (commit edin): ${stale.join(", ")}`);
  else pass("üretim", `${before.size} üretilen dosya güncel`);
}

// ───────── yardımcılar: renk ─────────
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const resolveVal = (v) => { const m = String(v).match(/^\{primitive\.([\w-]+)\}$/); return m ? src.primitive[m[1]].$value : v; };

function palette(mode, contrastMore = false) {
  const p = {};
  for (const [k, t] of Object.entries(src[mode])) if (t && t.$type === "color") p[k] = parseColor(resolveVal(t.$value));
  if (contrastMore) for (const [k, t] of Object.entries(src["contrast-more"][mode] || {})) if (t && t.$value) p[k] = parseColor(t.$value);
  return p;
}

// ───────── 2 · Karşıtlık ─────────
{
  const TEXT = 4.5, UI = 3;
  // [ön plan, zemin (soft ise surface üstüne bindirilir), en az]
  const pairs = [
    ["text", "surface", TEXT], ["text", "bg", TEXT], ["text-2", "surface", TEXT], ["text-2", "bg", TEXT],
    ["text-3", "surface", TEXT], ["text-3", "bg", TEXT], ["text-3", "bg-sunken", TEXT], ["text-3", "surface-3", TEXT], ["text-3", "well", TEXT], ["text-3", "surface-raised", TEXT], ["text", "surface-raised", TEXT], ["danger-ink", "surface-raised", TEXT], ["warning-ink", "surface-raised", TEXT],
    ["andon-run-ink", "andon-run", TEXT], ["andon-warn-ink", "andon-warn", TEXT], ["andon-stop-ink", "andon-stop", TEXT], ["andon-maint-ink", "andon-maint", TEXT], ["andon-idle-ink", "andon-idle", TEXT],
    ["text-2", "grid-header-bg", TEXT],
    ["accent-ink", "surface", TEXT], ["accent-ink", "bg", TEXT], ["accent-ink", "accent-soft", TEXT],
    ["data-ink", "surface", TEXT], ["data-ink", "data-soft", TEXT],
    ["success-ink", "surface", TEXT], ["success-ink", "success-soft", TEXT],
    ["warning-ink", "surface", TEXT], ["warning-ink", "warning-soft", TEXT],
    ["danger-ink", "surface", TEXT], ["danger-ink", "danger-soft", TEXT],
    ["info-ink", "info-soft", TEXT],
    ["accent-contrast", "accent", TEXT], ["data-contrast", "data-solid", TEXT], ["bg", "text", TEXT],
    ["text", "grid-row-selected", TEXT],
    ["focus", "surface", UI], ["focus", "bg", UI], ["focus", "bg-sunken", UI],
    ["control-border", "surface", UI], ["control-border", "bg", UI], ["control-border", "bg-sunken", UI],
  ];
  for (const [mode, more] of [["light", false], ["dark", false], ["light", true], ["dark", true]]) {
    const p = palette(mode, more);
    const label = `${mode}${more ? " + contrast-more" : ""}`;
    let min = Infinity, bad = [];
    for (const [fg, bgKey, need] of pairs) {
      const base = p.surface;
      const bg = p[bgKey].a < 1 ? over(p[bgKey], base) : p[bgKey];
      const fgc = p[fg].a < 1 ? over(p[fg], bg) : p[fg];
      const c = contrast(fgc, bg);
      min = Math.min(min, c / need);
      if (c < need) bad.push(`${fg}/${bgKey} ${c.toFixed(2)} < ${need}`);
    }
    const white = contrast({ r: 255, g: 255, b: 255, a: 1 }, p["danger-solid"]);
    if (white < TEXT) bad.push(`#fff/danger-solid ${white.toFixed(2)}`);
    if (bad.length) fail("karşıtlık", `${label}: ${bad.join(" · ")}`);
    else pass("karşıtlık", `${label}: ${pairs.length + 1} çift geçti (en yakın eşik payı ×${min.toFixed(2)})`);
  }
}

// ───────── 3 · Grafik paleti (OKLab ΔE ×100, Machado 2009 şiddet 1.0) ─────────
{
  const M = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
  };
  const toLin = (hex) => { const c = parseColor(hex); return [lin(c.r), lin(c.g), lin(c.b)]; };
  const sim = (rgb, m) => m.map((row) => Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])));
  const oklab = ([r, g, b]) => {
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  };
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
  const evaluate = (colors, pairsOf) => {
    let normal = Infinity, cvd = Infinity;
    for (const [i, j] of pairsOf(colors.length)) {
      const a = toLin(colors[i]), b = toLin(colors[j]);
      normal = Math.min(normal, dE(oklab(a), oklab(b)));
      for (const m of Object.values(M)) cvd = Math.min(cvd, dE(oklab(sim(a, m)), oklab(sim(b, m))));
    }
    return { normal, cvd };
  };
  const adjacent = (n) => Array.from({ length: n - 1 }, (_, i) => [i, i + 1]);
  const all = (n) => { const r = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) r.push([i, j]); return r; };
  for (const mode of ["light", "dark"]) {
    const series = [1, 2, 3, 4, 5, 6].map((n) => src.primitive[`series-${n}-${mode}`].$value);
    const adj = evaluate(series, adjacent);
    const msg = `${mode} seri (yan yana): renk körlüğü ΔE ${adj.cvd.toFixed(1)}, normal ΔE ${adj.normal.toFixed(1)}`;
    if (adj.normal < 15 || adj.cvd < 8) fail("palet", msg + " — eşik: renk körlüğü ≥ 8, normal ≥ 15");
    else pass("palet", msg);
    const scatter = mode === "light" ? ["#0a8fc4", "#d99a00", "#d1508a"] : ["#1f97cc", "#b88000", "#d55181"];
    const sc = evaluate(scatter, all);
    const msg2 = `${mode} dağılım (tüm ikililer): renk körlüğü ΔE ${sc.cvd.toFixed(1)}, normal ΔE ${sc.normal.toFixed(1)}`;
    if (sc.normal < 15 || sc.cvd < 8) fail("palet", msg2);
    else pass("palet", msg2);
  }
}

// ───────── 4 · DESIGN.md ön bilgi ↔ tokens.json ─────────
{
  const md = read("DESIGN.md");
  const fm = md.split(/^---$/m)[1] || "";
  const lines = fm.split("\n");
  const found = { light: {}, dark: {} };
  let inColors = false, mode = null;
  for (const line of lines) {
    if (/^colors:/.test(line)) { inColors = true; continue; }
    if (inColors && /^\S/.test(line)) break;
    const m2 = line.match(/^ {2}(light|dark):\s*$/);
    if (m2) { mode = m2[1]; continue; }
    if (/^ {2}\S/.test(line)) { mode = null; continue; }
    const m4 = line.match(/^ {4}([\w-]+):\s*"([^"]+)"/);
    if (mode && m4) found[mode][m4[1]] = m4[2];
  }
  const norm = (v) => { const c = parseColor(v); return `${c.r},${c.g},${c.b},${+c.a.toFixed(3)}`; };
  const diffs = [];
  let n = 0;
  for (const mode of ["light", "dark"]) for (const [k, v] of Object.entries(found[mode])) {
    n++;
    const t = src[mode][k];
    if (!t) diffs.push(`${mode}.${k} tokens.json'da yok`);
    else if (norm(resolveVal(t.$value)) !== norm(v)) diffs.push(`${mode}.${k}: ${v} ≠ ${t.$value}`);
  }
  if (n === 0) fail("DESIGN.md", "ön bilgide renk bulunamadı");
  else if (diffs.length) fail("DESIGN.md", diffs.join(" · "));
  else pass("DESIGN.md", `${n} renk tokens.json ile aynı`);
}

// ───────── 5 · Sınıf başvuruları ─────────
{
  const css = read("components.css");
  const defined = new Set([...css.matchAll(/\.(bz-[a-zA-Z0-9_-]+)/g), ...css.matchAll(/@keyframes\s+(bz-[\w-]+)/g)].map((m) => m[1]));
  const ignore = new Set(["bz-theme", "bz-haptics"]);
  const check = (file, text) => {
    // ".bz-ctx-*" gibi aile (joker) yazımları ve sınıf olmayan adlar (localStorage anahtarı vb.) atlanır
    const used = new Set([...text.matchAll(/(?<![-\w$])\.?(bz-[a-z0-9]+(?:[-_]{1,2}[a-z0-9]+)*)(-\*)?/g)].filter((m) => !m[2]).map((m) => m[1]));
    const missing = [...used].filter((c) => !defined.has(c) && !ignore.has(c) && !c.startsWith("bz-light") && !c.startsWith("bz-dark"));
    if (missing.length) fail("sınıflar", `${file}: tanımsız → ${missing.join(", ")}`);
    else pass("sınıflar", `${file}: ${used.size} sınıf adı tanımlı`);
  };
  const md = read("DESIGN.md").replace(/^---[\s\S]*?^---$/m, "");
  check("DESIGN.md", [...md.matchAll(/`[^`\n]+`|```[\s\S]*?```/g)].map((m) => m[0]).join("\n"));
  const html = read("preview.html");
  check("preview.html", [...html.matchAll(/class(?:Name)?=["']([^"']+)["']|className\s*=\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1] || m[2]).join(" "));
}

// ───────── 6 · CSS değişkenleri tanımlı mı ─────────
{
  const tokensCss = read("tokens.css");
  const css = read("components.css") + read("ag-grid.css") + read("tailwind.css") + read("shadcn.css");
  const defined = new Set([...tokensCss.matchAll(/--(bz-[\w-]+)\s*:/g), ...css.matchAll(/--(bz-[\w-]+)\s*:/g)].map((m) => m[1]));
  // var(--bz-x, varsayılan) biçimi bileşen düzeyinde ayardır (ör. --bz-range-fill), tanım gerektirmez
  const used = new Set([...css.matchAll(/var\(--(bz-[\w-]+)\s*\)/g)].map((m) => m[1]));
  const tsUsed = new Set([...["ag-grid.ts"].map(read).join("\n").matchAll(/v\("([\w-]+)"\)/g)].map((m) => "bz-" + m[1]));
  const missing = [...used, ...tsUsed].filter((v) => !defined.has(v));
  if (missing.length) fail("değişkenler", `tanımsız: ${[...new Set(missing)].join(", ")}`);
  else pass("değişkenler", `${used.size + tsUsed.size} değişken kullanımı tanımlı`);
}

// ───────── 7 · Bileşen sınıfı çakışması ─────────
// Aynı sınıf iki ayrı bölümde, üst düzeyde (medya sorgusu dışında) tanımlanıp aynı özelliğe farklı değer veriyorsa iki bileşen
// aynı adı paylaşıyordur (ör. form etiketi .bz-label ile termal etiket) → biri yeniden adlandırılmalı. Farklı özellik ekleyen
// bilinçli genişletmeler (ör. .bz-tile'a yerleşim, pano bölümünde iç düzen) çakışma sayılmaz.
{
  const src = read("components.css").replace(/\/\*[\s\S]*?\*\//g, (c) => { const m = c.match(/─{3,}\s*([^─]+?)\s*─{3,}/); return m ? `\u0000${m[1].trim()}\u0000` : " "; });
  const defs = new Map();
  const stack = [];
  let section = "?", start = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\u0000") { const j = src.indexOf("\u0000", i + 1); section = src.slice(i + 1, j); i = j; start = j + 1; continue; }
    if (ch === ";" ) { start = i + 1; continue; }
    if (ch === "}") { stack.pop(); start = i + 1; continue; }
    if (ch !== "{") continue;
    const prelude = src.slice(start, i).trim();
    if (prelude.startsWith("@layer")) { stack.push("layer"); start = i + 1; }
    else if (prelude.startsWith("@")) { stack.push("at"); start = i + 1; }
    else {
      const end = src.indexOf("}", i);
      if (stack.every((k) => k === "layer")) {
        const props = new Map();
        for (const d of src.slice(i + 1, end).split(/;(?![^(]*\))/)) {
          const k = d.indexOf(":");
          if (k > 0) props.set(d.slice(0, k).trim(), d.slice(k + 1).trim().replace(/\s+/g, " "));
        }
        for (const sel of prelude.split(/,(?![^(]*\))/).map((x) => x.trim())) {
          if (!/^\.bz-[\w-]+$/.test(sel)) continue;
          if (!defs.has(sel)) defs.set(sel, []);
          defs.get(sel).push({ section, props });
        }
      }
      i = end;
      start = end + 1;
    }
  }
  const SHORT = { font: /^font-/, background: /^background-/, border: /^border-/, padding: /^padding-/, margin: /^margin-/, inset: /^(top|right|bottom|left)$/, flex: /^flex-/, grid: /^grid-/, gap: /^(row|column)-gap$/, overflow: /^overflow-/, outline: /^outline-/ };
  const overlap = (a, b) => a === b || SHORT[a]?.test(b) || SHORT[b]?.test(a);
  const clashes = [];
  for (const [sel, list] of defs) {
    for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
      const A = list[x], B = list[y];
      if (A.section === B.section) continue;
      for (const [pa, va] of A.props) for (const [pb, vb] of B.props) {
        if (overlap(pa, pb) && !(pa === pb && va === vb)) { clashes.push(`${sel} (${A.section} ↔ ${B.section}: ${pa} / ${pb})`); break; }
      }
    }
  }
  const uniq = [...new Set(clashes)];
  if (uniq.length) fail("çakışma", `aynı ad iki bileşende: ${uniq.slice(0, 5).join("; ")}`);
  else pass("çakışma", `${defs.size} bileşen sınıfı, bölümler arası çakışma yok`);
}

// ───────── rapor ─────────
const pad = (s, n) => (s + " ".repeat(n)).slice(0, n);
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${pad(r.area, 12)} ${r.msg}`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} sorun bulundu.` : `\nTüm denetimler geçti (${results.length}).`);
process.exit(failed ? 1 : 0);
