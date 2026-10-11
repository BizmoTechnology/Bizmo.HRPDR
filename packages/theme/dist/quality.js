/**
 * Bizmo Universal Theme · kalite yardımcıları (SPC, kontrol noktası, uygunsuzluk, 8D) — bağımlılıksız
 *
 *   SPC       spcXbarR(altgruplar, { lsl, usl })   → X̄, R, MÇ / ÜKS / AKS, σ, Cp, Cpk, Pp, Ppk, Nelson ihlalleri
 *             nelsonRules(değerler, mç, σ, kurallar) · bizmoSpcChart(kap, { result, labels, unit })   X̄ ve R grafiği (SVG)
 *             spcTableHtml(result, labels) tablo görünümü · capability(cpk) → yeterli / sınırda / yetersiz
 *   Kontrol   QualityCheck { item, nominal, lsl, usl, unit, critical } · toleranceText · checkResult · bizmoTolerance (ölçü göstergesi)
 *             toDocQuality(kontroller) → docs.ts iş emri kalite bölümü (açık uygunsuzluk ve kritik karakteristik işaretli)
 *   NCR / 8D  ncrFromCheck(kontrol, ölçüm, bağlam) · EIGHT_D · eightDProgress(adımlar) · bizmo8dHtml(adımlar)
 *
 * Kurallar (DESIGN.md §44): kontrol sınırı süreçten (veriden), tolerans müşteriden (resimden) gelir — ikisi ayrı çizilir ve
 * karıştırılmaz. İhlal rengi tek başına değil: elmas işaret + kural numarası + metin. Kişi adı yerine rol (KVKK).
 */
import { bizmoAnnounce } from "./records.js";
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n, digits = 3) => (Number.isFinite(n) ? new Intl.NumberFormat("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n) : "—");
// ───────── SPC ─────────
/** X̄-R sabitleri (n = alt grup büyüklüğü 2–10) */
export const SPC_CONST = {
    2: { A2: 1.88, D3: 0, D4: 3.267, d2: 1.128 }, 3: { A2: 1.023, D3: 0, D4: 2.574, d2: 1.693 }, 4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
    5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 }, 6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 }, 7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
    8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 }, 9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.97 }, 10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
};
export const NELSON_TEXT = {
    1: "Kontrol sınırı dışında (3σ)",
    2: "9 nokta art arda merkezin aynı yanında (kayma)",
    3: "6 nokta art arda sürekli artıyor ya da azalıyor (eğilim)",
    4: "14 nokta art arda bir artıp bir azalıyor",
    5: "3 noktadan 2'si 2σ dışında, aynı yanda",
    6: "5 noktadan 4'ü 1σ dışında, aynı yanda",
    7: "15 nokta art arda 1σ içinde (tabakalaşma)",
    8: "8 nokta art arda 1σ dışında, iki yanda (karışım)",
};
/**
 * Nelson kuralları (1–8). σ çizilen istatistiğin standart sapmasıdır (X̄ için (ÜKS − MÇ) / 3).
 * İhlal, deseni tamamlayan noktaya yazılır; points desenin tüm noktalarıdır. Varsayılan kurallar 1, 2, 3, 5, 6.
 */
export function nelsonRules(v, cl, sigma, rules = [1, 2, 3, 5, 6]) {
    const out = [];
    const z = v.map((x) => (sigma > 0 ? (x - cl) / sigma : 0));
    const seen = new Set();
    const hit = (rule, index, points) => { const k = `${rule}:${index}`; if (!seen.has(k)) {
        seen.add(k);
        out.push({ index, rule, text: NELSON_TEXT[rule], points });
    } };
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
    const sign = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
    for (let i = 0; i < v.length; i++) {
        if (rules.includes(1) && Math.abs(z[i]) > 3)
            hit(1, i, [i]);
        if (rules.includes(2) && i >= 8) {
            const s = range(i - 8, i).map((k) => sign(z[k]));
            if (s[0] !== 0 && s.every((x) => x === s[0]))
                hit(2, i, range(i - 8, i));
        }
        if (rules.includes(3) && i >= 5) {
            const d = range(i - 4, i).map((k) => sign(v[k] - v[k - 1]));
            if (d[0] !== 0 && d.every((x) => x === d[0]))
                hit(3, i, range(i - 5, i));
        }
        if (rules.includes(4) && i >= 13) {
            const d = range(i - 12, i).map((k) => sign(v[k] - v[k - 1]));
            if (d.every((x, k) => x !== 0 && (k === 0 || x === -d[k - 1])))
                hit(4, i, range(i - 13, i));
        }
        if (rules.includes(5) && i >= 2)
            for (const s of [1, -1]) {
                const w = range(i - 2, i).filter((k) => z[k] * s > 2);
                if (w.length >= 2 && z[i] * s > 2)
                    hit(5, i, w);
            }
        if (rules.includes(6) && i >= 4)
            for (const s of [1, -1]) {
                const w = range(i - 4, i).filter((k) => z[k] * s > 1);
                if (w.length >= 4 && z[i] * s > 1)
                    hit(6, i, w);
            }
        if (rules.includes(7) && i >= 14 && range(i - 14, i).every((k) => Math.abs(z[k]) < 1))
            hit(7, i, range(i - 14, i));
        if (rules.includes(8) && i >= 7) {
            const w = range(i - 7, i);
            if (w.every((k) => Math.abs(z[k]) > 1) && w.some((k) => z[k] > 0) && w.some((k) => z[k] < 0))
                hit(8, i, w);
        }
    }
    return out.sort((a, b) => a.index - b.index || a.rule - b.rule);
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
/**
 * X̄-R kontrol grafiği hesabı. limits verilirse (I. evrede belirlenmiş sınırlar) yeniden hesaplanmaz — II. evre izleme.
 * Alt grup büyüklüğü 2–10, tüm alt gruplar eşit büyüklükte olmalı.
 */
export function spcXbarR(subgroups, spec = {}, o = {}) {
    const groups = subgroups.filter((g) => g.length);
    if (!groups.length)
        throw new Error("Alt grup yok");
    const n = groups[0].length;
    if (!SPC_CONST[n])
        throw new Error(`Alt grup büyüklüğü 2–10 olmalı (${n})`);
    if (groups.some((g) => g.length !== n))
        throw new Error("Alt gruplar eşit büyüklükte olmalı");
    const { A2, D3, D4, d2 } = SPC_CONST[n];
    const xbar = groups.map(mean), r = groups.map((g) => Math.max(...g) - Math.min(...g));
    const cl = o.limits?.cl ?? mean(xbar), rbar = o.limits?.rbar ?? mean(r);
    const ucl = cl + A2 * rbar, lcl = cl - A2 * rbar, uclR = D4 * rbar, lclR = D3 * rbar;
    const sigma = rbar / d2;
    const all = groups.flat(), mu = mean(all);
    const sigmaTotal = Math.sqrt(all.reduce((s, x) => s + (x - mu) ** 2, 0) / Math.max(1, all.length - 1));
    const { lsl, usl } = spec;
    const both = lsl !== undefined && usl !== undefined;
    const k = (s) => Math.min(usl !== undefined ? (usl - cl) / (3 * s) : Infinity, lsl !== undefined ? (cl - lsl) / (3 * s) : Infinity);
    const kk = (s) => Math.min(usl !== undefined ? (usl - mu) / (3 * s) : Infinity, lsl !== undefined ? (mu - lsl) / (3 * s) : Infinity);
    const r2 = (x) => Math.round(x * 100) / 100;
    return {
        n, xbar, r, cl, ucl, lcl, rbar, uclR, lclR, sigma, sigmaTotal, spec,
        cp: both && sigma > 0 ? r2((usl - lsl) / (6 * sigma)) : null,
        cpk: (lsl !== undefined || usl !== undefined) && sigma > 0 ? r2(k(sigma)) : null,
        pp: both && sigmaTotal > 0 ? r2((usl - lsl) / (6 * sigmaTotal)) : null,
        ppk: (lsl !== undefined || usl !== undefined) && sigmaTotal > 0 ? r2(kk(sigmaTotal)) : null,
        violations: nelsonRules(xbar, cl, (ucl - cl) / 3, o.rules),
        // R grafiğinde yalnız sınır dışı (kural 1) — dağılım değişimi
        violationsR: r.map((x, i) => (x > uclR || x < lclR ? { index: i, rule: 1, text: "Değişkenlik kontrol sınırı dışında", points: [i] } : null)).filter((x) => !!x),
    };
}
/** Yeterlilik yorumu: Cpk ≥ 1,33 yeterli · 1,00–1,33 sınırda · < 1,00 yetersiz (otomotivde kritik karakteristik için ≥ 1,67 istenebilir) */
export function capability(cpk, required = 1.33) {
    if (cpk === null)
        return { state: "na", text: "Tolerans yok" };
    if (cpk >= required)
        return { state: "ok", text: "Yeterli" };
    if (cpk >= 1)
        return { state: "warn", text: "Sınırda" };
    return { state: "bad", text: "Yetersiz" };
}
/** Tablo görünümü (grafiğin erişilebilir eşi): alt grup, ölçümler, X̄, R, ihlaller */
export function spcTableHtml(res, subgroups, labels = [], digits = 3) {
    const v = new Map();
    for (const x of [...res.violations, ...res.violationsR.map((y) => ({ ...y, text: `R: ${y.text}` }))])
        v.set(x.index, [...(v.get(x.index) ?? []), `${x.rule}. ${x.text}`]);
    return `<table class="bz-table bz-table--compact bz-spc__table"><thead><tr><th>Alt grup</th><th>Ölçümler</th><th class="is-num">X̄</th><th class="is-num">R</th><th>İhlal</th></tr></thead><tbody>${res.xbar.map((x, i) => `<tr${v.has(i) ? ' data-tone="danger"' : ""}><td class="bz-tabular">${i + 1}${labels[i] ? ` · ${esc(labels[i])}` : ""}</td><td class="bz-tabular">${subgroups[i].map((m) => fmt(m, digits)).join(" · ")}</td><td class="is-num">${fmt(x, digits)}</td><td class="is-num">${fmt(res.r[i], digits)}</td><td>${v.has(i) ? esc(v.get(i).join("; ")) : "—"}</td></tr>`).join("")}</tbody></table>`;
}
/** Okunur eksen adımları (1 / 2 / 2,5 / 5 × 10^k) */
function ticks(min, max, count = 4) {
    const span = max - min || 1, raw = span / count, p = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
    const out = [];
    for (let t = Math.ceil(min / step) * step; t <= max + step * 1e-9; t += step)
        out.push(Math.round(t / step) * step);
    return { out, step };
}
/**
 * X̄ ve R kontrol grafikleri (SVG, iki ayrı grafik — tek eksen kuralı). MÇ düz, ÜKS / AKS kesikli, ÜTS / ATS noktalı ve
 * doğrudan etiketli; ölçüm çizgisi 2px, nokta 8px; ihlal elmas + kural numarası. Üzerine gelince dikey çizgi ve ayrıntı.
 */
export function bizmoSpcChart(host, o) {
    const res = o.result, digits = o.digits ?? 3, labels = o.labels ?? [];
    let ro = null;
    const vmap = new Map();
    res.violations.forEach((x) => vmap.set(x.index, [...(vmap.get(x.index) ?? []), x]));
    const rmap = new Map();
    res.violationsR.forEach((x) => rmap.set(x.index, [...(rmap.get(x.index) ?? []), x]));
    function chart(name, values, lines, viol, W, H) {
        const L = 52, R = 92, T = 12, B = 24;
        const pw = W - L - R, ph = H - T - B;
        const all = [...values, ...lines.map((l) => l.y)];
        let lo = Math.min(...all), hi = Math.max(...all);
        const padY = (hi - lo || 1) * 0.08;
        lo -= padY;
        hi += padY;
        // Uçlarda 12px iç boşluk: son noktanın kural etiketi sınır etiketine değmez
        const IN = 12, x = (i) => L + IN + (values.length > 1 ? (i * (pw - 2 * IN)) / (values.length - 1) : pw / 2 - IN);
        const y = (v) => T + (1 - (v - lo) / (hi - lo)) * ph;
        const tk = ticks(lo, hi);
        const tdig = Math.min(digits, (String(+tk.step.toPrecision(6)).split(".")[1] ?? "").length);
        const grid = tk.out.map((t) => `<line class="bz-spc__grid" x1="${L}" x2="${L + pw}" y1="${y(t)}" y2="${y(t)}"/><text class="bz-spc__tick" x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t, tdig)}</text>`).join("");
        // Doğrudan etiketler çakışmasın: dikeyde en az 13px aralık
        const placed = [];
        const labelY = (yy) => { let v = yy; for (let k = 0; k < 6 && placed.some((p) => Math.abs(p - v) < 13); k++)
            v += placed.some((p) => p > v) ? -13 : 13; placed.push(v); return v; };
        const lineSvg = [...lines].sort((a, b) => (a.kind === "cl" ? -1 : b.kind === "cl" ? 1 : 0)).map((l) => `<line class="bz-spc__${l.kind}" x1="${L}" x2="${L + pw}" y1="${y(l.y)}" y2="${y(l.y)}"/><text class="bz-spc__lbl bz-spc__lbl--${l.kind}" x="${L + pw + 8}" y="${labelY(y(l.y)) + 4}">${esc(l.label)}</text>`).join("");
        const path = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
        const dots = values.map((v, i) => viol.has(i)
            ? `<path class="bz-spc__viol" d="M${x(i)} ${y(v) - 7}L${x(i) + 7} ${y(v)}L${x(i)} ${y(v) + 7}L${x(i) - 7} ${y(v)}Z"/><text class="bz-spc__rule" x="${x(i)}" y="${y(v) - 11}" text-anchor="middle">${[...new Set(viol.get(i).map((q) => q.rule))].join(",")}</text>`
            : `<circle class="bz-spc__dot" cx="${x(i)}" cy="${y(v)}" r="4"/>`).join("");
        const every = Math.max(1, Math.ceil(values.length / Math.max(2, Math.floor(pw / 56))));
        const xl = values.map((_, i) => (i % every === 0 || i === values.length - 1 ? `<text class="bz-spc__tick" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(labels[i] ?? String(i + 1))}</text>` : "")).join("");
        const n = viol.size;
        const aria = `${name} kontrol grafiği: ${values.length} alt grup, MÇ ${fmt(lines.find((l) => l.kind === "cl").y, digits)}${n ? `, ${n} noktada ihlal` : ", ihlal yok"}`;
        return `<svg class="bz-spc__svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(aria)}" data-chart="${name}">
      ${grid}<line class="bz-spc__axis" x1="${L}" x2="${L}" y1="${T}" y2="${T + ph}"/>${lineSvg}
      <path class="bz-spc__line" d="${path}"/>${dots}${xl}
      <line class="bz-spc__cross" x1="0" x2="0" y1="${T}" y2="${T + ph}" visibility="hidden"/>
      <rect class="bz-spc__hit" x="${L - 6}" y="${T}" width="${pw + 12}" height="${ph}" data-l="${L + IN}" data-pw="${pw - 2 * IN}"/>
    </svg>`;
    }
    function render() {
        const W = Math.max(320, Math.floor(host.clientWidth || 640));
        const u = o.unit ? ` ${o.unit}` : "";
        const xLines = [
            { y: res.cl, kind: "cl", label: `MÇ ${fmt(res.cl, digits)}` },
            { y: res.ucl, kind: "limit", label: `ÜKS ${fmt(res.ucl, digits)}` },
            { y: res.lcl, kind: "limit", label: `AKS ${fmt(res.lcl, digits)}` },
            ...(res.spec.usl !== undefined ? [{ y: res.spec.usl, kind: "spec", label: `ÜTS ${fmt(res.spec.usl, digits)}` }] : []),
            ...(res.spec.lsl !== undefined ? [{ y: res.spec.lsl, kind: "spec", label: `ATS ${fmt(res.spec.lsl, digits)}` }] : []),
        ];
        const rLines = [
            { y: res.rbar, kind: "cl", label: `R̄ ${fmt(res.rbar, digits)}` },
            { y: res.uclR, kind: "limit", label: `ÜKS ${fmt(res.uclR, digits)}` },
            ...(res.lclR > 0 ? [{ y: res.lclR, kind: "limit", label: `AKS ${fmt(res.lclR, digits)}` }] : []),
        ];
        host.innerHTML = `<div class="bz-spc">
      <div class="bz-spc__title">X̄ · alt grup ortalaması${esc(u)}</div>${chart("X̄", res.xbar, xLines, vmap, W, 240)}
      <div class="bz-spc__title">R · alt grup açıklığı${esc(u)}</div>${chart("R", res.r, rLines, rmap, W, 150)}
      <div class="bz-spc__tip" role="status" hidden></div>
    </div>`;
    }
    // Üzerine gelme: en yakın alt grup; her iki grafikte dikey çizgi + ayrıntı kutusu
    const onMove = (e) => {
        const hit = e.target.closest?.(".bz-spc__hit");
        const tip = host.querySelector(".bz-spc__tip");
        if (!hit || !tip)
            return;
        const svg = hit.ownerSVGElement, box = svg.getBoundingClientRect();
        const L = +hit.dataset.l, pw = +hit.dataset.pw, n = res.xbar.length;
        const sx = ((e.clientX - box.left) / box.width) * +svg.viewBox.baseVal.width;
        const i = Math.max(0, Math.min(n - 1, Math.round(((sx - L) / pw) * (n - 1))));
        const cx = L + (n > 1 ? (i * pw) / (n - 1) : pw / 2);
        host.querySelectorAll(".bz-spc__cross").forEach((c) => { c.setAttribute("x1", String(cx)); c.setAttribute("x2", String(cx)); c.setAttribute("visibility", "visible"); });
        const vs = [...(vmap.get(i) ?? []), ...(rmap.get(i) ?? []).map((q) => ({ ...q, text: `R: ${q.text}` }))];
        tip.hidden = false;
        tip.innerHTML = `<b>Alt grup ${i + 1}${labels[i] ? ` · ${esc(labels[i])}` : ""}</b><span>X̄ ${fmt(res.xbar[i], digits)} · R ${fmt(res.r[i], digits)}</span><span class="bz-spc__vals">${o.subgroups[i].map((m) => fmt(m, digits)).join(" · ")}</span>${vs.map((q) => `<span class="bz-spc__tipviol">◆ ${q.rule}. ${esc(q.text)}</span>`).join("")}`;
        const hb = host.getBoundingClientRect(), px = (cx / +svg.viewBox.baseVal.width) * box.width + box.left - hb.left;
        tip.style.left = `${Math.min(hb.width - tip.offsetWidth - 4, Math.max(4, px + 12))}px`;
        tip.style.top = `${box.top - hb.top + 8}px`;
    };
    const onLeave = () => { host.querySelectorAll(".bz-spc__cross").forEach((c) => c.setAttribute("visibility", "hidden")); const t = host.querySelector(".bz-spc__tip"); if (t)
        t.hidden = true; };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    render();
    let w = host.clientWidth;
    if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => { if (Math.abs(host.clientWidth - w) > 2) {
            w = host.clientWidth;
            render();
        } });
        ro.observe(host);
    }
    return { destroy() { ro?.disconnect(); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave); host.innerHTML = ""; } };
}
/** "Ø120 ±0,05 mm" · "119,95 – 120,05 mm" · "≤ 0,8 µm" · ölçüsüz kriter */
export function toleranceText(c) {
    const d = c.digits ?? 2, u = c.unit ? ` ${c.unit}` : "";
    if (c.lsl === undefined && c.usl === undefined)
        return c.criterion ?? "—";
    if (c.lsl === undefined)
        return `≤ ${fmt(c.usl, d)}${u}`;
    if (c.usl === undefined)
        return `≥ ${fmt(c.lsl, d)}${u}`;
    if (c.nominal !== undefined && Math.abs(c.usl - c.nominal - (c.nominal - c.lsl)) < 1e-9)
        return `${fmt(c.nominal, d)} ±${fmt(c.usl - c.nominal, d)}${u}`;
    if (c.nominal !== undefined)
        return `${fmt(c.nominal, d)} +${fmt(c.usl - c.nominal, d)} / −${fmt(c.nominal - c.lsl, d)}${u}`;
    return `${fmt(c.lsl, d)} – ${fmt(c.usl, d)}${u}`;
}
/** Ölçüm sonucu: uygun mu, toleransa göre konum (0 = ATS, 1 = ÜTS), sınıra yakınlık (%10 içinde); label kısa (rozet), text tam (sapmayla) */
export function checkResult(c, value) {
    if (value === null || value === undefined || (typeof value === "number" && Number.isNaN(value)))
        return { state: "empty", ok: null, pos: null, label: "Ölçülmedi", text: "Ölçülmedi" };
    if (typeof value === "boolean")
        return { state: value ? "ok" : "bad", ok: value, pos: null, label: value ? "Uygun" : "Uygun değil", text: value ? "Uygun" : "Uygun değil" };
    const lo = c.lsl ?? -Infinity, hi = c.usl ?? Infinity;
    const ok = value >= lo && value <= hi;
    const width = Number.isFinite(lo) && Number.isFinite(hi) ? hi - lo : null;
    const pos = width ? (value - lo) / width : null;
    const near = ok && width !== null && (pos < 0.1 || pos > 0.9);
    const dev = value > hi ? value - hi : value < lo ? value - lo : 0;
    const d = c.digits ?? 2, u = c.unit ? ` ${c.unit}` : "";
    return { state: ok ? (near ? "near" : "ok") : "bad", ok, pos, deviation: dev, label: ok ? (near ? "Sınırda" : "Uygun") : "Uygun değil", text: ok ? (near ? "Uygun · sınıra yakın" : "Uygun") : `Uygun değil · ${dev > 0 ? "+" : "−"}${fmt(Math.abs(dev), d)}${u} ${dev > 0 ? "üstte" : "altta"}` };
}
/** Ölçü göstergesi: tolerans bandı (ATS–ÜTS), nominal çizgisi, ölçülen değer işareti; dışarıdaysa uçta ok + kırmızı */
export function bizmoTolerance(c, value) {
    const r = checkResult(c, value ?? null);
    if (r.pos === null || r.pos === undefined)
        return "";
    const p = Math.max(-0.08, Math.min(1.08, r.pos));
    const nom = c.nominal !== undefined && c.lsl !== undefined && c.usl !== undefined ? (c.nominal - c.lsl) / (c.usl - c.lsl) : null;
    return `<span class="bz-tol" data-state="${r.state}" style="--_pos:${(p * 100).toFixed(1)}%${nom !== null ? `;--_nom:${(nom * 100).toFixed(1)}%` : ""}" role="img" aria-label="${esc(`${c.item}: ${fmt(value, c.digits ?? 2)}${c.unit ? ` ${c.unit}` : ""} · tolerans ${toleranceText(c)} · ${r.text}`)}"><span class="bz-tol__band"></span>${nom !== null ? '<span class="bz-tol__nom"></span>' : ""}<span class="bz-tol__mark"></span></span>`;
}
/**
 * İş emri belgesinin kalite bölümü için (docs.ts WorkOrder.quality): tolerans metni, kritik karakteristik ◆ ve
 * açık uygunsuzluk numarası kalemin yanına yazılır.
 */
export function toDocQuality(checks) {
    return checks.map((c) => ({ item: `${c.critical ? "◆ " : ""}${c.item}`, spec: toleranceText(c), method: c.method, freq: c.freq, ncr: c.ncr }));
}
export const NCR_SEVERITY = { minor: "Minör", major: "Majör", critical: "Kritik" };
export const DISPOSITION = {
    sort: { label: "Ayıklama", hint: "%100 kontrol, uygun olan kullanılır" },
    rework: { label: "Yeniden işleme", hint: "Talimatla düzeltilir, tekrar kontrol edilir" },
    scrap: { label: "Hurda", hint: "Maliyet ve miktar kayda geçer" },
    "use-as-is": { label: "Olduğu gibi kullan", hint: "Sapma izni gerekir (müşteri / tasarım onayı)" },
    return: { label: "Tedarikçiye iade", hint: "Tedarikçi NCR'ı ve 8D istenir" },
};
export const EIGHT_D = [
    { d: "D0", title: "Hazırlık ve acil önlem", hint: "Belirtiyi tanımla; ürünü ayır, stoğu blokla, acil koruma başlat" },
    { d: "D1", title: "Ekip", hint: "Süreci bilen, yetkili, çok disiplinli ekip; lider ve sponsor" },
    { d: "D2", title: "Problem tanımı", hint: "5N1K · olan / olmayan: ne, nerede, ne zaman, ne kadar" },
    { d: "D3", title: "Geçici önlem", hint: "Müşteriyi koru: ayıklama, ek kontrol; etkinliği doğrula" },
    { d: "D4", title: "Kök neden", hint: "Oluşma ve kaçma nedeni ayrı ayrı: 5 Neden, balık kılçığı; doğrulanmış" },
    { d: "D5", title: "Kalıcı düzeltici faaliyet", hint: "Kök nedeni ortadan kaldıran çözüm ve seçim gerekçesi" },
    { d: "D6", title: "Uygulama ve doğrulama", hint: "Uygula, geçici önlemi kaldır, etkinliği veriyle doğrula (SPC)" },
    { d: "D7", title: "Tekrarı önleme", hint: "FMEA, kontrol planı, talimat; benzer ürün ve süreçlere yay" },
    { d: "D8", title: "Kapanış ve takdir", hint: "Dersleri kaydet, ekibi takdir et, müşteriyi bilgilendir" },
];
/**
 * Başarısız kontrol noktasından uygunsuzluk taslağı: başlık, ölçülen / tolerans, iş emri ve lot bağı, şiddet önerisi
 * (kritik karakteristik → kritik; sapma tolerans genişliğinin yarısından büyük → majör; değilse minör). 8D, D0'da başlar.
 */
export function ncrFromCheck(c, value, ctx) {
    const r = checkResult(c, value);
    const width = c.lsl !== undefined && c.usl !== undefined ? c.usl - c.lsl : null;
    const dev = "deviation" in r ? Math.abs(r.deviation ?? 0) : 0;
    const severity = c.critical ? "critical" : width !== null && dev > width / 2 ? "major" : "minor";
    return {
        no: ctx.no,
        title: `${ctx.product ? `${ctx.product} · ` : ""}${c.item} ${typeof value === "boolean" ? "uygun değil" : "tolerans dışı"}`,
        source: "internal", severity, status: "open", check: c.id,
        measured: typeof value === "boolean" ? (value ? "Uygun" : "Uygun değil") : `${fmt(value, c.digits ?? 2)}${c.unit ? ` ${c.unit}` : ""}`,
        spec: toleranceText(c), wo: ctx.wo, lot: ctx.lot, product: ctx.product, qty: ctx.qty, unit: ctx.unit,
        steps: EIGHT_D.map((s, i) => ({ d: s.d, state: i === 0 ? "current" : "todo", owner: i === 0 ? ctx.owner : undefined, due: i === 0 ? ctx.due : undefined })),
    };
}
export function eightDProgress(steps) {
    const done = steps.filter((s) => s.state === "done").length;
    return { done, total: steps.length, current: steps.find((s) => s.state === "current" || s.state === "late")?.d ?? null, late: steps.filter((s) => s.state === "late").map((s) => s.d), pct: Math.round((done / steps.length) * 100) };
}
/** 8D adımları (dikey akson): D numarası halkada, başlık, sorumlu (rol) · termin, özet; geciken adım kırmızı + "gecikti" */
export function bizmo8dHtml(steps, o = {}) {
    return `<ol class="bz-8d">${steps.map((s) => {
        const def = EIGHT_D.find((x) => x.d === s.d);
        const state = { todo: "Bekliyor", current: "Sürüyor", done: "Tamamlandı", late: "Gecikti" }[s.state];
        const meta = [s.owner, s.state === "done" ? (s.done ? `bitti ${s.done}` : "") : s.due ? `termin ${s.due}` : ""].filter(Boolean).join(" · ");
        return `<li class="bz-8d__step" data-state="${s.state}"${s.state === "current" || s.state === "late" ? ' aria-current="step"' : ""}>
      <span class="bz-8d__mark" aria-hidden="true">${s.state === "done" ? "✓" : s.d.slice(1)}</span>
      <div class="bz-8d__body"><div class="bz-8d__head"><b>${s.d} · ${esc(def.title)}</b><span class="bz-8d__state">${state}</span></div>
      ${meta ? `<div class="bz-8d__meta">${esc(meta)}</div>` : ""}
      ${s.summary ? `<p class="bz-8d__summary">${esc(s.summary)}</p>` : s.state === "current" || s.state === "late" || o.open === s.d ? `<p class="bz-8d__hint">${esc(def.hint)}</p>` : ""}</div>
    </li>`;
    }).join("")}</ol>`;
}
/** Ekran okuyucuya kalite olayı duyurusu (ör. "Ø120 çap: uygun değil") */
export const announceCheck = (c, value) => bizmoAnnounce(`${c.item}: ${checkResult(c, value).text}`);
