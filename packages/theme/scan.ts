/**
 * Bizmo Universal Theme · barkod okutma (el terminali, hat başı, masaüstü okuyucu; çerçeveden bağımsız)
 *
 *   const s = bizmoScanInput(input, { onScan: (code, source) => … });   alan: okuyucu ile elle yazımı ayırır
 *   const g = bizmoScanner({ onScan });                                  sayfa: odak bir alanda değilken okutmayı yakalar
 *   bizmoParseScan(code, { location: loc })                              → { kind, valid, error?, gtin?, lot?, expiry?, location? … }
 *   gs1CheckDigit("020000000123")                                         GTIN / SSCC / GLN kontrol hanesi (mod 10)
 *   s.feed("A-3-D-2")                                                    okuyucu taklidi (test, vitrin)
 *
 * Klavye kaması okuyucular karakterleri ~5–30 ms arayla gönderir ve Enter (bazen Tab) ile bitirir; insan yazımı
 * genellikle ≥ 60 ms'dir. AIM sembol önekleri (]C1 GS1-128, ]E0 EAN-13, ]d2 GS1 DataMatrix, ]Q3 GS1 QR) ve
 * FNC1 / GS (\x1d) ayırıcısı desteklenir; GS gönderemeyen okuyucular için yerine geçen karakter (gsChar) verilebilir.
 * Okutulan değer cihaz dışına gönderilmez; denetim kaydına içerik değil yalnız tür + sonuç yazılır (KVKK) — DESIGN.md §37.
 */

import type { LocationParts, LocationScheme } from "./location";

export type ScanSource = "scanner" | "manual";
export type ScanKind = "location" | "gs1" | "ean" | "sscc" | "text";

export type ScanResult = {
  /** Önekleri temizlenmiş değer (GS ayırıcısı \x1d olarak korunur) */
  code: string;
  kind: ScanKind;
  valid: boolean;
  /** Geçersizse kullanıcıya gösterilecek neden (Türkçe) */
  error?: string;
  /** AIM önekinden okunan sembol türü: "GS1-128", "EAN-13", "QR"… */
  symbology?: string;
  location?: LocationParts & { code: string };
  /** 14 haneli GTIN (EAN-8/12/13 sola sıfırla tamamlanır) */
  gtin?: string;
  sscc?: string;
  lot?: string;
  serial?: string;
  /** Son kullanma (AI 17) veya tavsiye edilen tüketim (AI 15) tarihi, ISO yyyy-mm-dd */
  expiry?: string;
  productionDate?: string;
  count?: number;
  netKg?: number;
  /** Tüm GS1 uygulama tanımlayıcıları (AI → değer) */
  ai?: Record<string, string>;
};

const GS = "\x1d";

/** GS1 mod 10 kontrol hanesi: GTIN-8/12/13/14, SSCC, GLN gövdesi için (kontrol hanesi hariç) */
export function gs1CheckDigit(body: string) {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = body.charCodeAt(body.length - 1 - i) - 48;
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (sum % 10)) % 10);
}
const validCheck = (num: string) => /^\d+$/.test(num) && gs1CheckDigit(num.slice(0, -1)) === num.slice(-1);

// Sabit uzunluklu AI'lar (değer uzunluğu); değişkenler GS ile ya da en fazla uzunlukla biter
const AI_FIXED: Record<string, number> = { "00": 18, "01": 14, "02": 14, "11": 6, "12": 6, "13": 6, "15": 6, "16": 6, "17": 6, "20": 2, "410": 13, "411": 13, "412": 13, "413": 13, "414": 13, "415": 13 };
const AI_VAR: Record<string, number> = { "10": 20, "21": 20, "22": 20, "30": 8, "37": 8, "240": 30, "241": 30, "250": 30, "400": 30, "401": 30, "403": 30, "420": 20, "90": 30, "91": 90, "92": 90 };
const SYMBOLOGY: Record<string, string> = { "]C1": "GS1-128", "]C0": "Code 128", "]E0": "EAN-13", "]E4": "EAN-8", "]d2": "GS1 DataMatrix", "]d1": "DataMatrix", "]Q3": "GS1 QR", "]Q1": "QR", "]e0": "GS1 DataBar" };

function aiAt(s: string, i: number): { ai: string; len: number; fixed: boolean } | null {
  for (const n of [2, 3, 4]) {
    const ai = s.slice(i, i + n);
    if (ai in AI_FIXED) return { ai, len: AI_FIXED[ai], fixed: true };
    if (ai in AI_VAR) return { ai, len: AI_VAR[ai], fixed: false };
    // 310n–369n: ölçü (n ondalık), 6 hane sabit
    if (n === 4 && /^3[1-6]\d\d$/.test(ai)) return { ai, len: 6, fixed: true };
  }
  return null;
}

/** GS1 öğe dizisini çözer: "(01)…(10)…" ya da ham "01…10…<GS>17…". Tanınmayan AI'da null */
export function parseGs1(input: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  if (input.startsWith("(")) {
    const re = /\((\d{2,4})\)([^(]*)/g;
    let m: RegExpExecArray | null;
    let seen = 0;
    while ((m = re.exec(input))) { out[m[1]] = m[2].replace(GS, ""); seen += m[0].length; }
    return seen === input.length && Object.keys(out).length ? out : null;
  }
  let i = 0;
  while (i < input.length) {
    if (input[i] === GS) { i++; continue; }
    const a = aiAt(input, i);
    if (!a) return null;
    i += a.ai.length;
    if (a.fixed) { out[a.ai] = input.slice(i, i + a.len); i += a.len; }
    else {
      const end = input.indexOf(GS, i);
      const stop = end < 0 ? Math.min(input.length, i + a.len) : Math.min(end, i + a.len);
      out[a.ai] = input.slice(i, stop);
      i = stop;
    }
  }
  return Object.keys(out).length ? out : null;
}

/** GS1 tarihi YYMMDD → ISO; GS1 kayan yüzyıl kuralı, gün 00 = ayın son günü. Geçersizse null */
export function gs1Date(yymmdd: string, now = new Date()) {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = +yymmdd.slice(0, 2), mm = +yymmdd.slice(2, 4);
  let dd = +yymmdd.slice(4, 6);
  if (mm < 1 || mm > 12) return null;
  const cy = now.getFullYear() % 100, base = now.getFullYear() - cy, diff = yy - cy;
  const year = base + yy + (diff >= 51 ? -100 : diff <= -50 ? 100 : 0);
  const last = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  if (dd === 0) dd = last;
  if (dd > last) return null;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/**
 * Okutulan değeri sınıflandırır ve doğrular. Sıra: AIM öneki → GS1 öğe dizisi → göz kodu (şema verilirse) →
 * GTIN / SSCC (yalnız rakam) → serbest metin.
 */
export function bizmoParseScan(raw: string, opts: { location?: LocationScheme; gsChar?: string; now?: Date } = {}): ScanResult {
  let code = (raw ?? "").replace(/[\r\n]+$/g, "").trim();
  if (opts.gsChar) code = code.split(opts.gsChar).join(GS);
  let symbology: string | undefined;
  const aim = code.slice(0, 3);
  if (/^\][A-Za-z]\d$/.test(aim)) { symbology = SYMBOLOGY[aim] ?? aim; code = code.slice(3); }
  // FNC1 başta gelebilir
  if (code.startsWith(GS)) code = code.slice(1);
  if (!code) return { code, kind: "text", valid: false, error: "Boş okutma", symbology };

  const gs1Like = (symbology && /GS1/.test(symbology)) || code.includes(GS) || /^\(\d{2,4}\)/.test(code);
  if (gs1Like) {
    const ai = parseGs1(code);
    if (!ai) return { code, kind: "gs1", valid: false, error: "GS1 barkodu çözülemedi (tanınmayan uygulama tanımlayıcısı)", symbology };
    const r: ScanResult = { code, kind: "gs1", valid: true, symbology, ai };
    const gtin = ai["01"] ?? ai["02"];
    if (gtin) {
      r.gtin = gtin;
      if (!validCheck(gtin)) return { ...r, valid: false, error: "GTIN kontrol hanesi hatalı" };
    }
    if (ai["00"]) {
      r.sscc = ai["00"];
      if (!validCheck(ai["00"])) return { ...r, valid: false, error: "SSCC kontrol hanesi hatalı" };
    }
    if (ai["10"]) r.lot = ai["10"];
    if (ai["21"]) r.serial = ai["21"];
    const exp = ai["17"] ?? ai["15"];
    if (exp) {
      const d = gs1Date(exp, opts.now);
      if (!d) return { ...r, valid: false, error: "Son kullanma tarihi geçersiz" };
      r.expiry = d;
    }
    if (ai["11"]) r.productionDate = gs1Date(ai["11"], opts.now) ?? undefined;
    const cnt = ai["30"] ?? ai["37"];
    if (cnt) r.count = Number(cnt);
    const kg = Object.keys(ai).find((k) => /^310\d$/.test(k));
    if (kg) r.netKg = Number(ai[kg]) / 10 ** Number(kg[3]);
    return r;
  }

  const loc = opts.location?.parse(code);
  if (loc) return { code, kind: "location", valid: true, symbology, location: { ...loc, code: opts.location!.format(loc) } };

  if (/^\d+$/.test(code)) {
    if (code.length === 18) return validCheck(code) ? { code, kind: "sscc", valid: true, symbology, sscc: code } : { code, kind: "sscc", valid: false, error: "SSCC kontrol hanesi hatalı", symbology };
    if ([8, 12, 13, 14].includes(code.length))
      return validCheck(code) ? { code, kind: "ean", valid: true, symbology, gtin: code.padStart(14, "0") } : { code, kind: "ean", valid: false, error: "Barkod kontrol hanesi hatalı", symbology };
  }
  return { code, kind: "text", valid: true, symbology };
}

type WedgeOpts = {
  /** Okuyucu kabul edilecek en büyük ortanca tuş aralığı (ms, varsayılan 35) */
  maxGap?: number;
  /** Okuyucu kabul edilecek en kısa değer (varsayılan 4) */
  minLength?: number;
  /** Bitiş tuşları (varsayılan Enter ve Tab) */
  suffix?: string[];
};
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : Infinity; };

/**
 * Bir alana okuyucu desteği: Enter / Tab'da değeri gönderir, tuş aralıklarından kaynağı (okuyucu / elle) belirler,
 * formun gönderilmesini ve odağın kaçmasını engeller, alanı temizler.
 */
export function bizmoScanInput(input: HTMLInputElement, opts: WedgeOpts & { onScan: (code: string, source: ScanSource) => void; clear?: boolean }) {
  const maxGap = opts.maxGap ?? 35, minLength = opts.minLength ?? 4, suffix = opts.suffix ?? ["Enter", "Tab"];
  let times: number[] = [];
  let pasted = false;
  const submit = (code: string, source: ScanSource) => {
    times = [];
    pasted = false;
    if (opts.clear !== false) input.value = "";
    if (code) opts.onScan(code, source);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    if (suffix.includes(e.key)) {
      const code = input.value.trim();
      if (!code) return;
      e.preventDefault();
      const gaps = times.slice(1).map((t, k) => t - times[k]);
      const fast = !pasted && times.length >= minLength && median(gaps) <= maxGap;
      submit(code, fast ? "scanner" : "manual");
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) times.push(e.timeStamp || performance.now());
    else if (e.key === "Backspace" || e.key === "Delete") times = [];
  };
  const onPaste = () => { pasted = true; };
  input.addEventListener("keydown", onKey);
  input.addEventListener("paste", onPaste);
  input.setAttribute("autocomplete", "off");
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("spellcheck", "false");
  return {
    /** Okuyucu taklidi: aynı yoldan "scanner" kaynağıyla gönderir (test ve vitrin) */
    feed(code: string) { submit(code, "scanner"); },
    destroy() { input.removeEventListener("keydown", onKey); input.removeEventListener("paste", onPaste); },
  };
}

/**
 * Sayfa düzeyinde okutma: odak düzenlenebilir bir alanda değilken hızlı tuş dizisini yakalar (el terminalinde
 * ekrana dokunmadan okutma). Elle basılan tek tuşlar ve kısayollar etkilenmez.
 */
export function bizmoScanner(opts: WedgeOpts & { onScan: (code: string, source: ScanSource) => void; target?: Document | HTMLElement }) {
  const maxGap = opts.maxGap ?? 35, minLength = opts.minLength ?? 4, suffix = opts.suffix ?? ["Enter", "Tab"];
  const target = opts.target ?? document;
  let buf = "", times: number[] = [];
  const editable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const reset = () => { buf = ""; times = []; };
  const onKey = (e: Event) => {
    const k = e as KeyboardEvent;
    if (editable(k.target) || k.ctrlKey || k.metaKey || k.altKey) return;
    const now = k.timeStamp || performance.now();
    if (times.length && now - times[times.length - 1] > maxGap * 4) reset();
    if (suffix.includes(k.key)) {
      const gaps = times.slice(1).map((t, i) => t - times[i]);
      if (buf.length >= minLength && median(gaps) <= maxGap) {
        k.preventDefault();
        const code = buf;
        reset();
        opts.onScan(code, "scanner");
      } else reset();
      return;
    }
    if (k.key.length === 1) { buf += k.key; times.push(now); }
  };
  target.addEventListener("keydown", onKey, true);
  return {
    feed(code: string) { opts.onScan(code, "scanner"); },
    destroy() { target.removeEventListener("keydown", onKey, true); },
  };
}
