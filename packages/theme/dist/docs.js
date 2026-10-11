/**
 * Bizmo Universal Theme · belge şablonları (iş emri, stok kartı, toplama listesi) — tipli veriden `.bz-doc` HTML'i üretir
 *
 *   el.innerHTML = bizmoWorkOrderDoc(order);                 ekranda kâğıt görünümü
 *   bizmoPrint(bizmoStockCardDoc(item), { title: "Stok kartı" });   (labels.ts) yalnız belgeyi yazdırır
 *
 * İlkeler (DESIGN.md §38.1): yalın (ince çizgi, kutu yok, tek renk marka düğümü), siyah-beyaz baskıda da okunur, mürekkep
 * dostu; üretime uygun: belge numarası barkodlu (el terminaliyle okutulur, §37), sahada okunacak bilgi büyük, elle doldurulacak
 * alanlar geniş, onay kutusu ve paraf sütunu, kalite kontrol noktaları; altta doküman kontrolü (form no · revizyon · yürürlük).
 * Tüm metin kaçırılır (XSS); sayı ve tarihler tr-TR. Kişi adı yerine rol ve paraf (KVKK).
 */
import { bizmoCode128Svg, bizmoQrSvg } from "./labels.js";
import { glyphSvg } from "./icons.js";
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const num = (n) => (n == null || Number.isNaN(n) ? "—" : nf.format(n));
const day = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
const stamp = () => new Date().toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
// ───────── Ortak parçalar ─────────
/** Başlık: marka + belge türü + başlık / alt başlık; sağda belge numarası Code 128 (sahada okutulur) ve isteğe bağlı QR */
function head(o) {
    const brand = `<div class="bz-doc__brand">${glyphSvg(o.org.glyph ?? "factory", { size: 22, node: "var(--_node)" })}<div>${esc(o.org.name)}${o.org.unit ? `<small>${esc(o.org.unit)}</small>` : ""}</div></div>`;
    let bar = "";
    try {
        bar = bizmoCode128Svg(o.number, { height: 40, module: 1, label: `${o.kind} ${o.number}` });
    }
    catch { /* Code 128 dışı karakter: yalnız numara yazılır */ }
    return `<header class="bz-doc__head">
    <div>${brand}<div class="bz-doc__kind">${esc(o.kind)}</div><h1 class="bz-doc__title">${esc(o.title)}</h1>${o.subtitle ? `<div class="bz-doc__subtitle">${esc(o.subtitle)}</div>` : ""}</div>
    <div class="bz-doc__id">${o.qr ? `<div class="bz-doc__qr">${bizmoQrSvg(o.qr, { ecc: "M", size: 83, label: `QR: ${o.number}` })}</div>` : ""}<div class="bz-doc__idcode">${bar}<div class="bz-doc__number">${esc(o.number)}</div></div></div>
  </header>`;
}
/** Künye şeridi: etiket üstte, değer altta, ince ayraçlı tek satır */
const facts = (items) => `<dl class="bz-doc__facts">${items.map(([k, v, strong]) => `<div><dt class="bz-doc__label">${esc(k)}</dt><dd class="bz-doc__value${strong ? " bz-doc__value--strong" : ""}">${v}</dd></div>`).join("")}</dl>`;
const section = (n, title, aside = "") => `<h2 class="bz-doc__section"><span>${String(n).padStart(2, "0")}</span>${esc(title)}${aside ? `<small>${aside}</small>` : ""}</h2>`;
/** Belgede durum etiketi (çerçeveli); öncelik ve stok için temanın rozetleri — baskıda kendiliğinden çerçeveli olur */
export const docTag = (text, tone) => `<span class="bz-doc__tag"${tone ? ` data-tone="${tone}"` : ""}>${esc(text)}</span>`;
const priority = (level, text) => `<span class="bz-priority" data-level="${level}"><i></i><i></i><i></i>${esc(text)}</span>`;
const stockBadge = (level, text) => `<span class="bz-stock" data-level="${level}">${esc(text)}</span>`;
const sign = (roles) => `<div class="bz-doc__sign" style="--cols: ${roles.length}">${roles.map((r) => `<div><b>${esc(r)}</b><small>Paraf · tarih</small></div>`).join("")}</div>`;
const foot = (control) => `<footer class="bz-doc__foot"><span>${control ? `Form ${esc(control.form)} · Rev. ${esc(control.rev)} · Yürürlük ${esc(control.date)}` : "Bizmo.OS"}</span><span>bizmo.com.tr</span><span>Yazdırılma ${stamp()}</span></footer>`;
/**
 * İş emri: ürün + miktar büyük, operasyonlar (hazırlık / işleme süresi, başlangıç-bitiş, iyi / hurda, paraf), malzeme (göz, lot),
 * kalite kontrol noktaları. size "a5": makinede poşette duran iş takip kartı — operasyon, kalite ve imza; malzeme toplama
 * listesiyle (bizmoPickListDoc) ayrı basılır.
 */
export function bizmoWorkOrderDoc(d, opts = {}) {
    let secNo = 0;
    const sec = (title, aside = "") => section(++secNo, title, aside);
    const pr = d.priority ?? "normal";
    const prTag = priority(pr === "kritik" ? "critical" : pr === "acil" ? "urgent" : "normal", pr === "kritik" ? "Kritik" : pr === "acil" ? "Acil" : "Normal");
    const totalMin = d.operations.reduce((a, o) => a + (o.setupMin ?? 0) + (o.runMin ?? 0), 0);
    // A5 (iş takip kartı, poşette makinede durur): süreler operasyon satırına iner, yazma sütunları kalır
    const a5 = opts.size === "a5";
    const plan = (o) => (o.setupMin != null || o.runMin != null ? `${num(o.setupMin ?? 0)} + ${num(o.runMin ?? 0)} dk` : "");
    const ops = `<table class="bz-doc__table bz-doc__table--write"><thead><tr><th style="width: ${a5 ? 7 : 9}mm">Sıra</th><th>Operasyon · istasyon</th>${a5 ? "" : `<th class="bz-doc__num" style="width: 15mm">Hazırlık</th><th class="bz-doc__num" style="width: 15mm">İşleme</th>`}<th style="width: ${a5 ? 12 : 15}mm">Başlangıç</th><th style="width: ${a5 ? 12 : 15}mm">Bitiş</th><th style="width: ${a5 ? 10 : 13}mm">İyi</th><th style="width: ${a5 ? 10 : 13}mm">Hurda</th><th style="width: ${a5 ? 11 : 14}mm">Paraf</th></tr></thead>
    <tbody>${d.operations.map((o) => `<tr><td class="bz-doc__code">${esc(o.seq)}</td><td><b>${esc(o.name)}</b><span class="bz-doc__sub">${esc(o.station)}${a5 && plan(o) ? ` · ${plan(o)}` : ""}${o.note ? ` · ${esc(o.note)}` : ""}</span></td>${a5 ? "" : `<td class="bz-doc__num">${o.setupMin != null ? `${num(o.setupMin)} dk` : "—"}</td><td class="bz-doc__num">${o.runMin != null ? `${num(o.runMin)} dk` : "—"}</td>`}<td class="bz-doc__write"></td><td class="bz-doc__write"></td><td class="bz-doc__write"></td><td class="bz-doc__write"></td><td class="bz-doc__write"></td></tr>`).join("")}</tbody></table>`;
    const mats = `<table class="bz-doc__table"><thead><tr><th>Kod</th><th>Malzeme</th><th>Göz</th><th>Lot</th><th class="bz-doc__num">Miktar</th><th style="width: 11mm">Alındı</th></tr></thead>
    <tbody>${d.materials.map((m) => `<tr><td class="bz-doc__code">${esc(m.code)}</td><td>${esc(m.name)}</td><td>${m.location ? `<span class="bz-doc__loc">${esc(m.location)}</span>` : "—"}</td><td class="bz-doc__code">${esc(m.lot ?? "—")}</td><td class="bz-doc__num">${num(m.qty)} ${esc(m.unit)}</td><td><span class="bz-doc__check"></span></td></tr>`).join("")}</tbody></table>`;
    // A5'te kontrol · tolerans · yöntem tek hücrede; ara ölçüm sütunu yok (kart tek sayfada kalır)
    // Şablonda yerinde çağrılır: bölüm numarası belgedeki sıraya göre verilir
    const qc = () => d.quality?.length
        ? a5
            ? `${sec("Kalite kontrol", "ölçülen değeri yazın")}<table class="bz-doc__table bz-doc__table--write"><thead><tr><th>Kontrol · tolerans · yöntem</th><th style="width: 16mm">1. parça</th><th style="width: 16mm">Son</th><th style="width: 10mm">Uygun</th></tr></thead>
      <tbody>${d.quality.map((q) => `<tr><td><b>${esc(q.item)}</b>${q.ncr ? ` ${docTag(q.ncr, "danger")}` : ""} <span class="bz-doc__code">${esc(q.spec)}</span><span class="bz-doc__sub">${esc([q.method, q.freq].filter(Boolean).join(" · "))}</span></td><td class="bz-doc__write"></td><td class="bz-doc__write"></td><td><span class="bz-doc__check"></span></td></tr>`).join("")}</tbody></table>`
            : `${sec("Kalite kontrol", "ölçülen değeri yazın")}<table class="bz-doc__table bz-doc__table--write"><thead><tr><th>Kontrol</th><th>Tolerans / kriter</th><th>Yöntem · sıklık</th><th style="width: 18mm">1. parça</th><th style="width: 18mm">Ara</th><th style="width: 18mm">Son</th><th style="width: 11mm">Uygun</th></tr></thead>
      <tbody>${d.quality.map((q) => `<tr><td><b>${esc(q.item)}</b>${q.ncr ? ` ${docTag(q.ncr, "danger")}` : ""}</td><td class="bz-doc__code">${esc(q.spec)}</td><td>${esc(q.method ?? "—")}${q.freq ? `<span class="bz-doc__sub">${esc(q.freq)}</span>` : ""}</td><td class="bz-doc__write"></td><td class="bz-doc__write"></td><td class="bz-doc__write"></td><td><span class="bz-doc__check"></span></td></tr>`).join("")}</tbody></table>`
        : "";
    return `<article class="bz-doc" data-size="${opts.size ?? "a4"}" aria-label="İş emri ${esc(d.no)}">
    ${head({ org: d.org, kind: a5 ? "Üretim · iş takip kartı" : "Üretim · iş emri", title: d.product.name, subtitle: `${d.product.code}${d.product.drawing ? ` · resim ${d.product.drawing}` : ""}${d.product.revision ? ` · rev. ${d.product.revision}` : ""}`, number: d.no, qr: a5 ? undefined : d.qr })}
    ${facts([["Miktar", `${num(d.quantity)} ${esc(d.unit)}`, true], ["Termin", day(d.due), true], ["Öncelik", prTag], ["Hat · vardiya", esc([d.line, d.shift].filter(Boolean).join(" · ") || "—")], ...(!a5 && d.ref ? [["Sipariş", esc(d.ref)]] : [])])}
    ${sec("Operasyonlar", `${d.operations.length} operasyon · plan ${num(totalMin)} dk${a5 ? " (hazırlık + işleme)" : ""}`)}${ops}
    ${a5 ? "" : `${sec("Malzeme", `${d.materials.length} kalem · gözden okutarak alın`)}${mats}`}
    ${!a5 && d.notes ? `${sec("Notlar")}<div class="bz-doc__notes">${esc(d.notes)}</div>` : ""}
    ${qc()}
    ${sign(d.roles ?? ["Hazırlayan", "Üretim", "Kalite"])}
    ${foot(d.control)}
  </article>`;
}
/** Stok kartı: kimlik + barkod, büyük stok rakamları ve seviye çubuğu (min · yeniden sipariş · max), göz dağılımı, hareket defteri (bakiye) */
export function bizmoStockCardDoc(d) {
    let secNo = 0;
    const sec = (title, aside = "") => section(++secNo, title, aside);
    const reserved = d.reserved ?? 0, free = d.onHand - reserved, max = Math.max(d.max ?? 0, d.onHand, 1);
    const pct = (v) => `${Math.max(0, Math.min(100, ((v ?? 0) / max) * 100)).toFixed(1)}%`;
    const below = d.reorder != null && free <= d.reorder;
    const state = free <= 0 ? stockBadge("out", "Tükendi") : d.min != null && free < d.min ? stockBadge("critical", "Kritik · min. altı") : below ? stockBadge("low", "Sipariş ver") : stockBadge("ok", "Yeterli");
    const meter = `<div class="bz-doc__meter" role="img" aria-label="Kullanılabilir ${num(free)} ${esc(d.unit)}; minimum ${num(d.min)}, yeniden sipariş ${num(d.reorder)}, maksimum ${num(d.max)}"><i style="--v: ${pct(free)}"></i>${d.min != null ? `<b style="--at: ${pct(d.min)}" data-label="Min ${num(d.min)}"></b>` : ""}${d.reorder != null ? `<b style="--at: ${pct(d.reorder)}" data-label="Sipariş ${num(d.reorder)}"></b>` : ""}${d.max != null ? `<b style="--at: ${pct(d.max)}" data-label="Max ${num(d.max)}"></b>` : ""}</div>`;
    const TYPE = { giris: "Giriş", cikis: "Çıkış", sayim: "Sayım farkı", transfer: "Transfer" };
    let bal = 0;
    const rows = [...d.movements].sort((a, b) => +new Date(a.date) - +new Date(b.date)).map((m) => {
        const sign = m.type === "cikis" ? -1 : 1;
        bal = m.balance ?? bal + sign * Math.abs(m.qty);
        return `<tr><td>${day(m.date)}</td><td class="bz-doc__code">${esc(m.doc)}</td><td>${TYPE[m.type]}</td><td class="bz-doc__num">${m.type !== "cikis" ? num(Math.abs(m.qty)) : ""}</td><td class="bz-doc__num">${m.type === "cikis" ? num(Math.abs(m.qty)) : ""}</td><td class="bz-doc__num"><b>${num(bal)}</b></td></tr>`;
    });
    let gtinBar = "";
    if (d.gtin)
        try {
            gtinBar = `<div class="bz-doc__barcode">${bizmoCode128Svg(`01${d.gtin}`, { gs1: true, height: 34, module: 1, label: `GTIN ${d.gtin}` })}<span>(01) ${esc(d.gtin)}</span></div>`;
        }
        catch { /* geçersiz GTIN: yazılmaz */ }
    return `<article class="bz-doc" data-size="a4" aria-label="Stok kartı ${esc(d.code)}">
    ${head({ org: d.org, kind: "Depo · stok kartı", title: d.name, subtitle: [d.category, d.supplier ? `tedarikçi ${d.supplier}` : ""].filter(Boolean).join(" · "), number: d.code })}
    <div class="bz-doc__stock">
      <div class="bz-doc__photo" aria-label="Ürün görseli alanı">${glyphSvg("package", { size: 30, node: "var(--_node)" })}<span>Görsel</span></div>
      <div class="bz-doc__stock-main">
        <dl class="bz-doc__figures">
          <div><dt class="bz-doc__label">Eldeki</dt><dd class="bz-doc__big">${num(d.onHand)}<small>${esc(d.unit)}</small></dd></div>
          <div><dt class="bz-doc__label">Rezerve</dt><dd class="bz-doc__big">${num(reserved)}</dd></div>
          <div><dt class="bz-doc__label">Kullanılabilir</dt><dd class="bz-doc__big">${num(free)}</dd></div>
          <div><dt class="bz-doc__label">Durum</dt><dd style="padding-top: 1.5mm">${state}</dd></div>
        </dl>
        ${meter}
      </div>
    </div>
    ${facts([["Birim", esc(d.unit)], ["Devir sınıfı", esc(d.abc ?? "—")], ["Tedarik süresi", d.leadDays != null ? `${num(d.leadDays)} gün` : "—"], ["Min / max", `${num(d.min)} / ${num(d.max)}`], ["Yeniden sipariş", num(d.reorder)]])}
    ${gtinBar}
    ${sec("Göz dağılımı", `${d.locations.length} göz`)}<table class="bz-doc__table"><thead><tr><th>Göz</th><th>Lot</th><th>SKT</th><th class="bz-doc__num">Miktar</th></tr></thead>
      <tbody>${d.locations.map((l) => `<tr><td><span class="bz-doc__loc">${esc(l.code)}</span></td><td class="bz-doc__code">${esc(l.lot ?? "—")}</td><td>${day(l.expiry)}</td><td class="bz-doc__num">${num(l.qty)} ${esc(d.unit)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="3">Toplam</td><td class="bz-doc__num">${num(d.locations.reduce((a, l) => a + l.qty, 0))} ${esc(d.unit)}</td></tr></tfoot></table>
    ${sec("Stok hareketleri", "eskiden yeniye · bakiye")}<table class="bz-doc__table"><thead><tr><th>Tarih</th><th>Belge</th><th>Tür</th><th class="bz-doc__num">Giriş</th><th class="bz-doc__num">Çıkış</th><th class="bz-doc__num">Bakiye</th></tr></thead><tbody>${rows.join("")}</tbody></table>
    ${d.notes ? `${sec("Notlar")}<div class="bz-doc__notes">${esc(d.notes)}</div>` : ""}
    ${sign(["Depo sorumlusu", "Sayım"])}
    ${foot(d.control)}
  </article>`;
}
/** Toplama listesi: göz sırasıyla (rota), her satırda göz kodu barkodlu — el terminali olmadan da okutulabilir; toplanan / eksik yazılır */
export function bizmoPickListDoc(d) {
    let secNo = 0;
    const sec = (title, aside = "") => section(++secNo, title, aside);
    const lines = [...d.lines].sort((a, b) => a.location.localeCompare(b.location, "tr", { numeric: true }));
    const bar = (code) => { try {
        return bizmoCode128Svg(code, { height: 26, module: 1, label: `Göz ${code}` });
    }
    catch {
        return "";
    } };
    return `<article class="bz-doc" data-size="a4" aria-label="Toplama listesi ${esc(d.no)}">
    ${head({ org: d.org, kind: "Depo · toplama listesi", title: d.for, number: d.no })}
    ${facts([["Satır", num(d.lines.length), true], ["Bölge", esc(d.zone ?? "—")], ["Tarih", day(d.date)], ["Teslim", day(d.due)]])}
    ${sec("Toplanacaklar", "göz sırasıyla · okutun ya da işaretleyin")}<table class="bz-doc__table bz-doc__table--write"><thead><tr><th style="width: 40mm">Göz</th><th>Malzeme</th><th>Lot</th><th class="bz-doc__num">İstenen</th><th style="width: 16mm">Toplanan</th><th style="width: 10mm">✓</th></tr></thead>
      <tbody>${lines.map((l) => `<tr><td><span class="bz-doc__loc">${esc(l.location)}</span><span class="bz-doc__locbar">${bar(l.location)}</span></td><td><b>${esc(l.name)}</b><span class="bz-doc__sub bz-doc__code">${esc(l.code)}</span></td><td class="bz-doc__code">${esc(l.lot ?? "—")}</td><td class="bz-doc__num"><b>${num(l.qty)}</b> ${esc(l.unit)}</td><td class="bz-doc__write"></td><td><span class="bz-doc__check"></span></td></tr>`).join("")}</tbody></table>
    ${sign(["Toplayan", "Kontrol"])}
    ${foot(d.control)}
  </article>`;
}
