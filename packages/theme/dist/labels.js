/**
 * Bizmo Universal Theme · barkod, etiket ve baskı (bağımlılıksız; çerçeveden bağımsız)
 *
 *   bizmoCode128Svg("A-3-D-2", { height: 60 })            Code 128 (B/C kod setleri otomatik) → SVG metni
 *   bizmoCode128Svg("01…10…\x1d17…", { gs1: true })        GS1-128 (FNC1 ile; \x1d = değişken alan sonu)
 *   bizmoQrSvg("IE-2026-0418", { ecc: "M" })                QR (bayt kipi, sürüm 1–10, hata düzeltme L/M/Q/H)
 *   gs1Hri({ "01": gtin, "17": "270331", "10": "L26-114" })  insan okunur satır: "(01)… (17)… (10)…"
 *   bizmoZpl({ widthMm: 100, heightMm: 50 }, [...])          Zebra termal yazıcı için ZPL II
 *   bizmoPrint(el, { title })                               yalnız bu öğeyi yazdırır (gizli çerçevede, sayfa stilleriyle)
 *
 * Etiket ölçüleri mm ile; ekranda ve baskıda aynı boyut (DESIGN.md §38). Barkodlar her zaman siyah / beyaz,
 * sessiz bölgeli (Code 128: 10 modül, QR: 4 modül) çizilir; ölçeklenirken modül oranı korunur.
 */
// ───────────────────────── Code 128 ─────────────────────────
// Sembol genişlikleri (çubuk, boşluk, çubuk, …): 0–102 veri, 103–105 başlangıç A/B/C, 106 bitiş
const C128 = ("212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
    "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
    "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
    "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
    "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
    "114131 311141 411131 211412 211214 211232 2331112").split(" ");
const START_B = 104, START_C = 105, TO_B = 100, TO_C = 99, FNC1 = 102, STOP = 106;
const GS = "\x1d";
/**
 * Metni Code 128 sembol değerlerine çevirir (kontrol karakteri dahil). Sayı dizilerinde C setine geçer (iki hane = bir sembol).
 * gs1: başa FNC1 eklenir, \x1d (GS) FNC1 olur. Code 128 dışı karakter (ör. ğ, ş) varsa hata fırlatır.
 */
export function code128Values(text, opts = {}) {
    for (const ch of text) {
        const c = ch.charCodeAt(0);
        if (ch !== GS && (c < 32 || c > 126))
            throw new Error(`Code 128'de olmayan karakter: "${ch}" (Türkçe harfler barkoda yazılmaz, insan okunur satıra yazılır)`);
    }
    const digitsAt = (i) => { let n = 0; while (i + n < text.length && text[i + n] >= "0" && text[i + n] <= "9")
        n++; return n; };
    const vals = [];
    let set;
    const first = digitsAt(0);
    set = first >= 4 || (first >= 2 && first === text.length && first % 2 === 0) ? "C" : "B";
    vals.push(set === "C" ? START_C : START_B);
    if (opts.gs1)
        vals.push(FNC1);
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (ch === GS) {
            vals.push(FNC1);
            i++;
            continue;
        }
        if (set === "C") {
            if (digitsAt(i) >= 2) {
                vals.push(+text.slice(i, i + 2));
                i += 2;
                continue;
            }
            vals.push(TO_B);
            set = "B";
            continue;
        }
        const run = digitsAt(i);
        // B'den C'ye geçiş, 4+ hanede kazançlı; tek sayıda hanede ilk hane B'de kalır
        if (run >= 4 && (run >= 6 || i + run === text.length || text[i + run] === GS)) {
            if (run % 2 === 1) {
                vals.push(text.charCodeAt(i) - 32);
                i++;
            }
            vals.push(TO_C);
            set = "C";
            continue;
        }
        vals.push(ch.charCodeAt(0) - 32);
        i++;
    }
    let sum = vals[0];
    for (let k = 1; k < vals.length; k++)
        sum += vals[k] * k;
    vals.push(sum % 103, STOP);
    return vals;
}
/** Code 128 modül dizisi (1 = çubuk) — sessiz bölge hariç */
export function code128Modules(text, opts = {}) {
    const out = [];
    for (const v of code128Values(text, opts)) {
        const w = C128[v];
        for (let k = 0; k < w.length; k++)
            for (let n = 0; n < +w[k]; n++)
                out.push(k % 2 === 0 ? 1 : 0);
    }
    return out;
}
/**
 * Code 128 / GS1-128 SVG. Genişlik modül sayısı × module (px ya da viewBox birimi); height çubuk yüksekliği.
 * CSS ile genişlik / yükseklik verilince eksenler ayrı ölçeklenir (preserveAspectRatio="none"): tüm modüller aynı oranda
 * genişlediği için okunurluk bozulmaz; modül genişliği baskıda ≥ 0,25 mm kalmalıdır.
 */
export function bizmoCode128Svg(text, opts = {}) {
    const m = code128Modules(text, opts);
    const q = opts.quiet ?? 10, mod = opts.module ?? 2, h = opts.height ?? 60, W = (m.length + 2 * q) * mod;
    let d = "";
    for (let i = 0; i < m.length;) {
        if (!m[i]) {
            i++;
            continue;
        }
        let n = 1;
        while (m[i + n])
            n++;
        d += `M${(q + i) * mod} 0h${n * mod}v${h}h${-n * mod}z`;
        i += n;
    }
    const aria = opts.label ?? text.replaceAll(GS, " ");
    return `<svg xmlns="http://www.w3.org/2000/svg" class="bz-barcode" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" preserveAspectRatio="none" role="img" aria-label="${escAttr(aria)}" shape-rendering="crispEdges"><rect width="${W}" height="${h}" fill="#fff"/><path d="${d}" fill="${opts.color ?? "#000"}"/></svg>`;
}
/** GS1 uygulama tanımlayıcılarından barkod verisi (değişken uzunluklu alanlardan sonra GS) ve insan okunur satır */
export function gs1Data(ai) {
    const FIXED = { "00": 18, "01": 14, "02": 14, "11": 6, "13": 6, "15": 6, "17": 6, "20": 2 };
    // Sıra: kimlik (00/01/02) → diğer sabit uzunluklular (tarih, ölçü) → değişkenler; GS yalnız değişkenler arasında gerekir
    const fixedAi = (k) => k in FIXED || /^3[1-6]\d\d$/.test(k);
    const rank = (k) => (["00", "01", "02"].includes(k) ? 0 : fixedAi(k) ? 1 : 2);
    const keys = Object.keys(ai).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    let data = "";
    keys.forEach((k, i) => {
        const v = String(ai[k]);
        data += k + v;
        if (!fixedAi(k) && i < keys.length - 1)
            data += GS;
    });
    return { data, hri: keys.map((k) => `(${k})${ai[k]}`).join(" ") };
}
/** "(01)… (17)… (10)…" — etiketin altına yazılan satır */
export const gs1Hri = (ai) => gs1Data(ai).hri;
// Sürüm 1–10 için blok başına hata düzeltme kod sözcüğü ve blok sayısı (ISO/IEC 18004 tablo 9)
const ECC_PER_BLOCK = {
    L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};
const ECC_BLOCKS = {
    L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};
const ECC_FORMAT = { L: 1, M: 0, Q: 3, H: 2 };
const rawModules = (v) => {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) {
        const n = Math.floor(v / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (v >= 7)
            r -= 36;
    }
    return r;
};
const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[e][v] * ECC_BLOCKS[e][v];
const gfMul = (x, y) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xff;
};
function rsDivisor(degree) {
    const r = new Array(degree).fill(0);
    r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < r.length; j++) {
            r[j] = gfMul(r[j], root);
            if (j + 1 < r.length)
                r[j] ^= r[j + 1];
        }
        root = gfMul(root, 2);
    }
    return r;
}
function rsRemainder(data, div) {
    const r = new Array(div.length).fill(0);
    for (const b of data) {
        const f = b ^ r.shift();
        r.push(0);
        div.forEach((c, i) => (r[i] ^= gfMul(c, f)));
    }
    return r;
}
/** QR modül matrisi (true = koyu). Bayt kipi (UTF-8), en küçük uygun sürüm (1–10); sığmazsa hata */
export function bizmoQr(text, opts = {}) {
    const e = opts.ecc ?? "M";
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = Math.max(1, opts.minVersion ?? 1);
    for (; ver <= 10; ver++)
        if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(ver, e) * 8)
            break;
    if (ver > 10)
        throw new Error(`QR için metin çok uzun (${bytes.length} bayt; ${e} düzeyinde en fazla ${dataCodewords(10, e) - 3} bayt)`);
    const size = ver * 4 + 17;
    // Bit dizisi: kip (0100) + uzunluk + veri + bitiş + dolgu
    const bits = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--)
        bits.push((val >>> i) & 1); };
    put(4, 4);
    put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach((b) => put(b, 8));
    const cap = dataCodewords(ver, e) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11)
        put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8)
        data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
    // Bloklara böl, hata düzeltme ekle, dönüşümlü diz
    const nBlocks = ECC_BLOCKS[e][ver], eccLen = ECC_PER_BLOCK[e][ver], raw = Math.floor(rawModules(ver) / 8);
    const nShort = nBlocks - (raw % nBlocks), shortLen = Math.floor(raw / nBlocks), div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nBlocks; i++) {
        const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
        k += dat.length;
        const ecc = rsRemainder(dat, div);
        if (i < nShort)
            dat.push(0);
        blocks.push(dat.concat(ecc));
    }
    const codewords = [];
    for (let i = 0; i < blocks[0].length; i++)
        blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort)
            codewords.push(b[i]); });
    // Matris: işlev desenleri
    const M = Array.from({ length: size }, () => new Array(size).fill(false));
    const F = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = (x, y, dark) => { M[y][x] = dark; F[y][x] = true; };
    for (let i = 0; i < size; i++) {
        fn(6, i, i % 2 === 0);
        fn(i, 6, i % 2 === 0);
    }
    const finder = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++)
            for (let dx = -4; dx <= 4; dx++) {
                const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
                if (x >= 0 && x < size && y >= 0 && y < size)
                    fn(x, y, d !== 2 && d !== 4);
            }
    };
    finder(3, 3);
    finder(size - 4, 3);
    finder(3, size - 4);
    if (ver >= 2) {
        const n = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
        const pos = [6];
        for (let p = size - 7; pos.length < n; p -= step)
            pos.splice(1, 0, p);
        for (const ay of pos)
            for (const ax of pos) {
                if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6))
                    continue;
                for (let dy = -2; dy <= 2; dy++)
                    for (let dx = -2; dx <= 2; dx++)
                        fn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
            }
    }
    const format = (mask) => {
        const d = (ECC_FORMAT[e] << 3) | mask;
        let r = d;
        for (let i = 0; i < 10; i++)
            r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
        for (let i = 0; i <= 5; i++)
            fn(8, i, bit(i));
        fn(8, 7, bit(6));
        fn(8, 8, bit(7));
        fn(7, 8, bit(8));
        for (let i = 9; i < 15; i++)
            fn(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++)
            fn(size - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++)
            fn(8, size - 15 + i, bit(i));
        fn(8, size - 8, true);
    };
    format(0);
    if (ver >= 7) {
        let r = ver;
        for (let i = 0; i < 12; i++)
            r = (r << 1) ^ ((r >>> 11) * 0x1f25);
        const b = (ver << 12) | r;
        for (let i = 0; i < 18; i++) {
            const dark = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3);
            fn(a, c, dark);
            fn(c, a, dark);
        }
    }
    // Veri modülleri: sağdan sola ikişer sütun, zikzak
    let k = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6)
            right = 5;
        for (let v = 0; v < size; v++)
            for (let j = 0; j < 2; j++) {
                const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
                if (!F[y][x] && k < codewords.length * 8) {
                    M[y][x] = ((codewords[k >>> 3] >>> (7 - (k & 7))) & 1) === 1;
                    k++;
                }
            }
    }
    // Maske: 8 desenin en düşük cezalısı
    const MASKS = [
        (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
        (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
    ];
    const apply = (mi) => { for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
            if (!F[y][x] && MASKS[mi](x, y))
                M[y][x] = !M[y][x]; };
    const penalty = () => {
        let p = 0, dark = 0;
        const lines = [];
        for (let y = 0; y < size; y++) {
            lines.push(M[y].map((b) => (b ? "1" : "0")).join(""));
        }
        for (let x = 0; x < size; x++)
            lines.push(M.map((row) => (row[x] ? "1" : "0")).join(""));
        for (const l of lines) {
            for (const run of l.match(/0{5,}|1{5,}/g) ?? [])
                p += run.length - 2;
            p += 40 * ((l.match(/(?=10111010000)/g) ?? []).length + (l.match(/(?=00001011101)/g) ?? []).length);
        }
        for (let y = 0; y < size - 1; y++)
            for (let x = 0; x < size - 1; x++) {
                const c = M[y][x];
                if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1])
                    p += 3;
            }
        for (const row of M)
            for (const b of row)
                if (b)
                    dark++;
        const total = size * size;
        p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
        return p;
    };
    let best = 0, bestP = Infinity;
    for (let mi = 0; mi < 8; mi++) {
        apply(mi);
        format(mi);
        const p = penalty();
        if (p < bestP) {
            bestP = p;
            best = mi;
        }
        apply(mi); // geri al (XOR)
    }
    apply(best);
    format(best);
    return { size, version: ver, ecc: e, modules: M };
}
/** QR SVG (sessiz bölge 4 modül). size: piksel / viewBox kenarı */
export function bizmoQrSvg(text, opts = {}) {
    const q = bizmoQr(text, opts), Q = 4, n = q.size + 2 * Q;
    let d = "";
    q.modules.forEach((row, y) => {
        for (let x = 0; x < row.length;) {
            if (!row[x]) {
                x++;
                continue;
            }
            let w = 1;
            while (row[x + w])
                w++;
            d += `M${x + Q} ${y + Q}h${w}v1h${-w}z`;
            x += w;
        }
    });
    const px = opts.size ?? n * 4;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="bz-barcode" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" role="img" aria-label="${escAttr(opts.label ?? text)}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="${opts.color ?? "#000"}"/></svg>`;
}
const escAttr = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/**
 * ZPL II etiketi: konum ve ölçüler mm ile (dpi'ye göre noktaya çevrilir: 203 dpi = 8 nokta/mm, 300 = 12, 600 = 24).
 * Türkçe metin için ^CI28 (UTF-8) kullanılır; yazıcıda Türkçe karakter içeren bir yazı tipi olmalıdır (ör. yüklü TrueType),
 * ilk kurulumda deneme etiketi basın. Alan verisindeki ^ ve ~ ^FH ile kaçırılır.
 */
export function bizmoZpl(o, items) {
    const dpmm = (o.dpi ?? 203) === 203 ? 8 : o.dpi === 300 ? 12 : 24;
    const d = (mm) => Math.round(mm * dpmm);
    const fd = (t) => `^FH_^FD${t.replace(/_/g, "_5F").replace(/\^/g, "_5E").replace(/~/g, "_7E")}^FS`;
    const out = ["^XA", "^CI28", `^PW${d(o.widthMm)}`, `^LL${d(o.heightMm)}`, "^LH0,0"];
    for (const it of items) {
        if (it.type === "text") {
            const h = d(it.h);
            out.push(`^FO${d(it.x)},${d(it.y)}^A0N,${h},${it.w ? d(it.w) : h}` + (it.block ? `^FB${d(it.block.width)},${it.block.lines ?? 1},0,${it.block.align ?? "L"}` : "") + fd(it.text));
        }
        else if (it.type === "code128") {
            const mod = Math.max(1, Math.round((it.module ?? 0.25) * dpmm));
            // GS1: D kipi "(01)…(10)…" biçimini kendisi FNC1'e çevirir (gs1Data(ai).hri verin); düz veride A kipi en kısa kodlamayı seçer
            const data = it.gs1 ? it.data.replace(/\s+/g, "") : it.data;
            out.push(`^BY${mod},3^FO${d(it.x)},${d(it.y)}^BCN,${d(it.h)},${it.hri === false ? "N" : "Y"},N,N,${it.gs1 ? "D" : "A"}` + fd(data));
        }
        else if (it.type === "qr") {
            out.push(`^FO${d(it.x)},${d(it.y)}^BQN,2,${it.mag ?? 4}` + fd(`${it.ecc ?? "M"}A,${it.data}`));
        }
        else {
            const t = d(it.t ?? 0.4);
            out.push(`^FO${d(it.x)},${d(it.y)}^GB${d(it.w)},${d(it.h)},${it.fill ? Math.min(d(it.w), d(it.h)) : t}^FS`);
        }
    }
    if (o.copies && o.copies > 1)
        out.push(`^PQ${o.copies}`);
    out.push("^XZ");
    return out.join("\n");
}
// ───────────────────────── Yazdırma ─────────────────────────
/**
 * Yalnız verilen öğeyi yazdırır: gizli bir çerçeveye sayfanın stil sayfalarıyla kopyalar, yazı tipleri yüklenince
 * yazdırma penceresini açar, sonra çerçeveyi kaldırır. Etiketlerde sayfa boyutu `.bz-label` ölçüsünden gelir (@page).
 */
export function bizmoPrint(target, opts = {}) {
    return new Promise((resolve) => {
        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.tabIndex = -1;
        Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
        document.body.appendChild(frame);
        const doc = frame.contentDocument;
        const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((n) => n.outerHTML).join("");
        const body = typeof target === "string" ? target : target.outerHTML;
        doc.open();
        doc.write(`<!doctype html><html lang="${document.documentElement.lang || "tr"}" data-theme="light"><head><meta charset="utf-8"><base href="${document.baseURI}"><title>${escAttr(opts.title ?? document.title)}</title>${styles}</head><body class="bz-root bz-body bz-print-frame">${body}</body></html>`);
        doc.close();
        const done = () => { frame.remove(); resolve(); };
        const go = async () => {
            try {
                await doc.fonts?.ready;
            }
            catch { /* yazı tipi yüklenemese de yazdır */ }
            const w = frame.contentWindow;
            w.addEventListener("afterprint", () => setTimeout(done, 100), { once: true });
            w.focus();
            w.print();
            // Bazı tarayıcılar afterprint göndermez
            setTimeout(() => frame.isConnected && done(), 60_000);
        };
        if (doc.readyState === "complete")
            void go();
        else
            frame.addEventListener("load", () => void go(), { once: true });
    });
}
