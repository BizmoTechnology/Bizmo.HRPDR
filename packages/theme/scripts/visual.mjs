// Bizmo Universal Theme · görsel regresyon ve erişilebilirlik testi (bağımlılıksız: yerel Chrome + DevTools protokolü)
// Kullanım (depo kökünde):
//   node scripts/visual.mjs              vitrini karşılaştırır (taban yoksa oluşturur)
//   node scripts/visual.mjs --update     tabanları yeniler (bilinçli görsel değişiklikten sonra)
//   node scripts/visual.mjs --only=vurgu,saha   yalnız bu bölümler
//   node scripts/visual.mjs --css=".bz-btn{padding:0 40px!important}"   "ya şöyle olsaydı" — test kendini sınar
// Ortam: CHROME_PATH (yoksa macOS / Linux varsayılanları), BZ_PREVIEW_URL (yoksa çalışan 4390 sunucusu, o da yoksa geçici 4391).
//
// Her bölüm (section.pv-section[id]) açık / koyu × masaüstü 1280 / telefon 375 genişlikte çekilir. Kararlı görüntü için
// saat (2026-10-10 10:00) ve Math.random sabitlenir, animasyon / geçiş kapatılır, sayfa yüklendikten sonra zamanlayıcılar ve
// rAF durdurulur, WebGL / canvas ve ECharts kapları gizlenir (3B ve grafikler işlevsel olarak ayrıca denenir).
// Ek denetimler: konsol hatası ve yakalanmamış istisna, 375 px'te yatay taşma, kart içi taşma, yinelenen id, kırık aria başvurusu,
// erişilebilirlik ağacında adsız etkileşimli öğe (düğme, bağlantı, alan, sekme…). Sorun varsa çıkış kodu 1.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : true]; }));
const BASE = path.join(root, "tests", "visual");
const BASELINE = path.join(BASE, "baseline"), DIFF = path.join(BASE, "diff");
const ONLY = args.only ? String(args.only).split(",") : null;
const CONFIGS = [
  { name: "light-1280", theme: "light", width: 1280, mobile: false },
  { name: "dark-1280", theme: "dark", width: 1280, mobile: false },
  { name: "light-375", theme: "light", width: 375, mobile: true },
];
const PIXEL_DELTA = 48; // kanal farkı bu eşiği aşan piksel "farklı"
const MAX_RATIO = Number(args.ratio ?? 0.002); // bölümde en çok %0,2 farklı piksel (kenar yumuşatma payı)

// ───────── PNG (yalnız 8 bit, taramasız; Chrome ekran görüntüleri için yeterli) ─────────
function decodePng(buf) {
  let pos = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; if (data[12]) throw new Error("taramalı PNG desteklenmiyor"); }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const bpp = { 6: 4, 2: 3, 0: 1, 4: 2 }[ct];
  if (bd !== 8 || !bpp) throw new Error(`PNG biçimi desteklenmiyor (bit ${bd}, renk ${ct})`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let add = 0;
      if (f === 1) add = a; else if (f === 2) add = b; else if (f === 3) add = (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = (line[i] + add) & 255;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * bpp;
      if (bpp >= 3) { out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2]; out[o + 3] = bpp === 4 ? line[s + 3] : 255; }
      else { out[o] = out[o + 1] = out[o + 2] = line[s]; out[o + 3] = bpp === 2 ? line[s + 1] : 255; }
    }
    prev = line;
  }
  return { w, h, data: out };
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function encodePng({ w, h, data }) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const tb = Buffer.concat([Buffer.from(type, "ascii"), body]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(tb)); return Buffer.concat([len, tb, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
// Piksel farkı; alt piksel yuvarlamasından doğan 1 px kaymalar sayılmaz: farklı görünen piksel, öbür görüntüde 3×3 komşulukta
// eşini buluyorsa (iki yönde de) aynı kabul edilir. Renk, boyut, eklenen / kaybolan öğe yine yakalanır.
function compare(a, b) {
  if (a.w !== b.w || a.h !== b.h) return { sizeChanged: true, ratio: 1 };
  const { w, h } = a, A = a.data, B = b.data;
  const near = (P, i, Q, x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const j = (yy * w + xx) * 4;
      if (Math.abs(P[i] - Q[j]) <= PIXEL_DELTA && Math.abs(P[i + 1] - Q[j + 1]) <= PIXEL_DELTA && Math.abs(P[i + 2] - Q[j + 2]) <= PIXEL_DELTA) return true;
    }
    return false;
  };
  const diff = Buffer.alloc(A.length);
  let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    const g = (A[i] + A[i + 1] + A[i + 2]) / 3;
    if (d > PIXEL_DELTA && !(near(A, i, B, x, y) && near(B, i, A, x, y))) { n++; diff[i] = 230; diff[i + 1] = 30; diff[i + 2] = 40; }
    else { diff[i] = diff[i + 1] = diff[i + 2] = 200 + g * 0.2; }
    diff[i + 3] = 255;
  }
  return { ratio: n / (w * h), pixels: n, diff: { w, h, data: diff } };
}

// ───────── Chrome + DevTools protokolü ─────────
function chromePath() {
  const c = [process.env.CHROME_PATH, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  return c.find((p) => fs.existsSync(p));
}
async function launch() {
  const exe = chromePath();
  if (!exe) throw new Error("Chrome bulunamadı (CHROME_PATH ile verin)");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "bz-visual-"));
  const proc = spawn(exe, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--hide-scrollbars", "--mute-audio", "--force-color-profile=srgb", "--font-render-hinting=none", "--disable-gpu", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  const ws = await new Promise((resolve, reject) => {
    let err = "";
    const t = setTimeout(() => reject(new Error("Chrome başlamadı: " + err.slice(-400))), 20000);
    proc.stderr.on("data", (d) => { err += d; const m = err.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); resolve(m[1]); } });
    proc.on("exit", (c) => reject(new Error(`Chrome kapandı (${c}): ${err.slice(-400)}`)));
  });
  const sock = new WebSocket(ws);
  await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
  let id = 0;
  const pending = new Map(), listeners = [];
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    else if (m.method) listeners.forEach((l) => l(m));
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); sock.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const close = () => { try { sock.close(); } catch {} proc.kill(); setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 500); };
  return { send, on: (f) => listeners.push(f), close };
}

// Sayfa başında: saat, rastgelelik, hareket sabit; __bzFreeze() zamanlayıcıları ve rAF'ı durdurur
const FREEZE = `(() => {
  const T = Date.UTC(2026, 9, 10, 7, 0, 0);
  const D = Date;
  class FixedDate extends D { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }
  FixedDate.UTC = D.UTC; FixedDate.parse = D.parse;
  window.Date = FixedDate;
  let s = 20261010; Math.random = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const iv = [], to = [], si = window.setInterval, st = window.setTimeout;
  // Dondurulduktan sonra yeni zamanlayıcı kurulmaz: görünür olunca başlayan demolar (IntersectionObserver) çekim sırasında değişmez
  let frozen = false;
  window.setInterval = (...a) => { if (frozen) return 0; const i = si(...a); iv.push(i); return i; };
  window.setTimeout = (...a) => { if (frozen) return 0; const i = st(...a); to.push(i); return i; };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (f) => (frozen ? 0 : raf(f));
  window.__bzFreeze = () => { frozen = true; iv.forEach(clearInterval); to.forEach(clearTimeout); };
  // Belge öğesi henüz yoksa (yeni belge oluşurken) ilk fırsatta uygula
  const apply = () => {
    document.documentElement.dataset.motion = "reduced";
    const css = document.createElement("style");
    css.textContent = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}canvas,[_echarts_instance_]{visibility:hidden!important}" + ${JSON.stringify(String(args.css ?? ""))};
    (document.head || document.documentElement).appendChild(css);
  };
  if (document.documentElement) apply(); else document.addEventListener("readystatechange", apply, { once: true });
})();`;

async function previewUrl() {
  if (process.env.BZ_PREVIEW_URL) return { url: process.env.BZ_PREVIEW_URL };
  for (const port of [4390]) {
    try { const r = await fetch(`http://127.0.0.1:${port}/preview.html`, { method: "HEAD" }); if (r.ok) return { url: `http://127.0.0.1:${port}/preview.html` }; } catch {}
  }
  // Çalışan önizleme yoksa geçici statik sunucu (oturum / çerez yok)
  const srv = spawn(process.execPath, [path.join(root, "scripts", "serve.mjs"), "4391"], { stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 600));
  return { url: "http://127.0.0.1:4391/preview.html", stop: () => srv.kill() };
}

const results = [];
const fail = (area, msg) => results.push({ ok: false, area, msg });
const pass = (area, msg) => results.push({ ok: true, area, msg });

const { url, stop } = await previewUrl();
const cdp = await launch();
try {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  let errors = [];
  cdp.on((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails, f = d.stackTrace?.callFrames?.[0];
      errors.push(`${d.exception?.description?.split("\n")[0] ?? d.text}${f ? ` (${path.basename(f.url.split("?")[0])}:${f.lineNumber + 1})` : ""}`);
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
  });
  await S("Page.enable"); await S("Runtime.enable"); await S("DOM.enable"); await S("Accessibility.enable");
  await S("Page.addScriptToEvaluateOnNewDocument", { source: FREEZE });
  fs.mkdirSync(BASELINE, { recursive: true });
  fs.rmSync(DIFF, { recursive: true, force: true });
  let shots = 0, created = 0, changed = 0;

  for (const cfg of CONFIGS) {
    errors = [];
    await S("Emulation.setDeviceMetricsOverride", { width: cfg.width, height: 900, deviceScaleFactor: 1, mobile: cfg.mobile });
    await S("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: cfg.theme }, { name: "prefers-reduced-motion", value: "reduce" }] });
    const loaded = new Promise((r) => cdp.on((m) => m.sessionId === sessionId && m.method === "Page.loadEventFired" && r()));
    await S("Page.navigate", { url: `${url}?visual=1` });
    await loaded;
    await new Promise((r) => setTimeout(r, 2500)); // modüller, ikonlar, ilk çizim
    const ev = (expr) => S("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }).then((r) => r.result.value);
    // Dış kaynaklar hazır olmadan çekme: ikon kütüphanesi (CDN), yazı tipleri, görseller — yoksa düğme genişlikleri kayar
    await ev(`(async () => {
      for (let i = 0; i < 50 && !window.lucide; i++) await new Promise((r) => setTimeout(r, 100));
      await document.fonts.ready;
      window.lucide?.createIcons();
      await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
      document.documentElement.dataset.theme = ${JSON.stringify(cfg.theme)};
      window.__bzFreeze();
      // Yapışkan / sabit sayfa öğeleri kaydırma konumuna göre başka bölümün üstüne düşer: akışa al, bölüm dışındaki sabitleri gizle.
      // Yalnız yatayda yapışan öğe (Gantt makine sütunu gibi, top: auto) kendi kaydırma kabındadır, olduğu gibi kalır.
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el), p = cs.position;
        if (p === "sticky" && !(cs.top === "auto" && cs.bottom === "auto")) el.style.position = "relative";
        else if (p === "fixed" && !el.closest("section.pv-section")) el.style.visibility = "hidden";
      }
      document.activeElement?.blur?.();
      // İç kaydırma konumları (sohbet, tablo, Gantt…) dondurma anındaki haliyle saklanır; uzun bölüm çekilirken Chrome görüntü
      // alanını geçici büyütür ve bu konumlar kayabilir — her çekimden önce geri yüklenir (çekimler birbirini etkilemez)
      window.__bzScroll = [...document.querySelectorAll("body *")].filter((el) => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1).map((el) => [el, el.scrollTop, el.scrollLeft]);
      window.scrollTo(0, 0);
      return document.querySelectorAll("i[data-lucide]").length;
    })()`);
    await new Promise((r) => setTimeout(r, 300));

    // Sayfa geneli denetimler
    if (errors.length) fail("konsol", `${cfg.name}: ${errors.length} hata — ${[...new Set(errors)].slice(0, 3).join(" | ")}`);
    else pass("konsol", `${cfg.name}: hata yok`);
    const page = await ev(`(() => {
      const ids = {}; document.querySelectorAll("[id]").forEach((e) => (ids[e.id] = (ids[e.id] || 0) + 1));
      const dup = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
      const broken = [];
      // Üçüncü taraf (AG Grid) kendi içinde denetlenir; burada temanın ve vitrinin öğeleri
      document.querySelectorAll("[aria-labelledby],[aria-describedby],[aria-controls]").forEach((e) => {
        if (e.closest(".ag-root-wrapper, [class*='ag-theme']")) return;
        for (const a of ["aria-labelledby", "aria-describedby", "aria-controls"]) for (const r of (e.getAttribute(a) || "").split(/\\s+/).filter(Boolean)) if (!document.getElementById(r)) broken.push(a + "→" + r);
      });
      const W = document.documentElement.clientWidth, over = [];
      if (document.documentElement.scrollWidth > W + 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width && r.right > W + 1 && getComputedStyle(el).position !== "fixed") {
            let p = el.parentElement, clipped = false;
            while (p && p !== document.body) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowX)) { clipped = true; break; } p = p.parentElement; }
            if (!clipped) over.push((el.id ? "#" + el.id : el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase()) + " (" + Math.round(r.right - W) + "px)");
          }
          if (over.length > 6) break;
        }
      }
      // Kart içi taşma: kartın / panelin sağ kenarını aşan öğe (araya kaydırma ya da kırpma kabı girmiyorsa) — sayfa taşmasa bile görünür kusur
      const inner = [];
      const boxes = document.querySelectorAll(".bz-card, [class*='__card'], .bz-dialog, .bz-scene__panel, .bz-term, .bz-alert, .bz-callout");
      for (const box of boxes) {
        const bs = getComputedStyle(box);
        if (/(auto|scroll|hidden|clip)/.test(bs.overflowX) || !box.getClientRects().length) continue;
        const right = box.getBoundingClientRect().right;
        for (const el of box.querySelectorAll("*")) {
          const r = el.getBoundingClientRect();
          if (!r.width || r.right <= right + 1) continue;
          let p = el.parentElement, clipped = false;
          while (p && p !== box) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; } p = p.parentElement; }
          if (clipped || getComputedStyle(el).position === "fixed") continue;
          const sec = box.closest("section[id]");
          inner.push((sec ? "#" + sec.id + " " : "") + (el.id ? "#" + el.id : "." + (typeof el.className === "string" && el.className.trim() ? el.className.trim().split(/\s+/)[0] : el.tagName.toLowerCase())) + " (" + Math.round(r.right - right) + "px)");
          break;
        }
        if (inner.length > 8) break;
      }
      return { dup, broken: [...new Set(broken)], overflow: document.documentElement.scrollWidth - W, over, inner };
    })()`);
    if (page.dup.length) fail("id", `${cfg.name}: yinelenen id — ${page.dup.slice(0, 8).join(", ")}`); else pass("id", `${cfg.name}: id'ler benzersiz`);
    if (page.broken.length) fail("aria", `${cfg.name}: kırık başvuru — ${page.broken.slice(0, 8).join(", ")}`); else pass("aria", `${cfg.name}: aria başvuruları geçerli`);
    if (page.inner.length) fail("iç taşma", `${cfg.name}: ${page.inner.length} kapta taşan öğe — ${page.inner.join(", ")}`);
    else pass("iç taşma", `${cfg.name}: kartların içinde taşma yok`);
    if (cfg.mobile) {
      if (page.overflow > 1) fail("taşma", `${cfg.name}: yatay taşma ${page.overflow}px — ${page.over.join(", ")}`);
      else pass("taşma", `${cfg.name}: yatay kaydırma yok`);
    }
    // Erişilebilirlik ağacı: adsız etkileşimli öğe
    if (!cfg.mobile) {
      const { nodes } = await S("Accessibility.getFullAXTree");
      const ROLES = new Set(["button", "link", "textbox", "searchbox", "combobox", "checkbox", "radio", "switch", "slider", "spinbutton", "tab", "menuitem", "listbox", "option"]);
      const bad = [];
      for (const n of nodes) {
        if (n.ignored || !ROLES.has(n.role?.value)) continue;
        if (!(n.name?.value ?? "").trim()) bad.push(n);
      }
      // AG Grid iç öğeleri (üçüncü taraf) hariç
      for (let k = bad.length - 1; k >= 0; k--) {
        try {
          const { object } = await S("DOM.resolveNode", { backendNodeId: bad[k].backendDOMNodeId });
          const r = await S("Runtime.callFunctionOn", { objectId: object.objectId, returnByValue: true, functionDeclaration: "function(){return !!this.closest('.ag-root-wrapper, [class*=ag-theme]')}" });
          if (r.result.value) bad.splice(k, 1);
        } catch {}
      }
      if (bad.length) {
        const where = [];
        for (const n of bad.slice(0, 8)) {
          try {
            const { object } = await S("DOM.resolveNode", { backendNodeId: n.backendDOMNodeId });
            const r = await S("Runtime.callFunctionOn", { objectId: object.objectId, returnByValue: true, functionDeclaration: "function(){const s=this.closest('section[id]');return (s?'#'+s.id+' ':'')+this.tagName.toLowerCase()+(this.className&&typeof this.className==='string'?'.'+this.className.trim().split(/\\s+/)[0]:'')}" });
            where.push(`${n.role.value}: ${r.result.value}`);
          } catch { where.push(n.role.value); }
        }
        fail("a11y", `${cfg.name}: ${bad.length} adsız etkileşimli öğe — ${where.join(" · ")}`);
      } else pass("a11y", `${cfg.name}: tüm etkileşimli öğelerin adı var`);
    }

    // Bölüm ekran görüntüleri
    const sections = await ev(`[...document.querySelectorAll("section.pv-section[id]")].map((s) => { const r = s.getBoundingClientRect(); return { id: s.id, x: Math.max(0, Math.floor(r.left + scrollX)), y: Math.floor(r.top + scrollY), w: Math.ceil(r.width), h: Math.min(Math.ceil(r.height), 4000) }; })`);
    for (const sec of sections) {
      if (ONLY && !ONLY.includes(sec.id)) continue;
      // Görünür alan dışındaki bölge henüz boyanmamış olabilir (yarım çizim): önce bölüme kaydır, boyanmasını bekle
      await ev(`window.__bzScroll?.forEach(([el, t, l]) => { el.scrollTop = t; el.scrollLeft = l; }); window.scrollTo(0, ${Math.max(0, sec.y - 20)})`);
      await new Promise((r) => setTimeout(r, 150));
      // Kararlı kare: 200 ms arayla iki çekim birebir aynı olana kadar (en çok 5 deneme) — geçici, yarım boyanmış kare girmez
      const shot = async () => Buffer.from((await S("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: sec.x, y: sec.y, width: sec.w, height: sec.h, scale: 1 } })).data, "base64");
      let png = await shot();
      for (let k = 0; k < 5; k++) {
        await new Promise((r) => setTimeout(r, 200));
        const again = await shot();
        if (again.equals(png)) break;
        png = again;
      }
      const file = path.join(BASELINE, `${sec.id}.${cfg.name}.png`);
      shots++;
      if (args.update || !fs.existsSync(file)) { fs.writeFileSync(file, png); created++; continue; }
      const c = compare(decodePng(fs.readFileSync(file)), decodePng(png));
      if (c.sizeChanged || c.ratio > MAX_RATIO) {
        changed++;
        fs.mkdirSync(DIFF, { recursive: true });
        fs.writeFileSync(path.join(DIFF, `${sec.id}.${cfg.name}.yeni.png`), png);
        if (c.diff) fs.writeFileSync(path.join(DIFF, `${sec.id}.${cfg.name}.fark.png`), encodePng(c.diff));
        fail("görsel", `${sec.id} · ${cfg.name}: ${c.sizeChanged ? "boyut değişti" : `%${(c.ratio * 100).toFixed(2)} piksel farklı`} → tests/visual/diff/`);
      }
    }
  }
  if (!changed) pass("görsel", `${shots} ekran görüntüsü${created ? ` (${created} yeni taban)` : ""} · fark yok`);
} finally {
  cdp.close();
  stop?.();
}

const icon = (r) => (r.ok ? "✓" : "✗");
for (const r of results) console.log(`${icon(r)} ${r.area.padEnd(8)} ${r.msg}`);
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n${bad} sorun bulundu.` : `\nTüm görsel ve erişilebilirlik denetimleri geçti.`);
process.exit(bad ? 1 : 0);
