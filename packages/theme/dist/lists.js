/**
 * Bizmo Universal Theme · liste ekranı yardımcıları (süzgeç, görünüm, sütun, dışa / içe aktarma) — bağımlılıksız
 *
 *   Süzgeç   FilterGroup (VE / VEYA, en çok 2 düzey) · OPERATORS[tür]
 *            filterSummary(grup, alanlar)  → 'Durum: Onaylandı, Bekliyor ve (Tutar > ₺10.000,00 veya Müşteri içerir "Acar")'
 *            filterChips(grup, alanlar) · removeRule(grup, i) · matchFilter(satır, grup, alanlar) · ruleCount(grup)
 *            bizmoFilterBar(kap, { fields, value, quick, onChange })   hap süzgeç çubuğu (.bz-fbar · birincil)
 *            bizmoFilterBuilder(kap, { fields, value, onChange })        gelişmiş oluşturucu, iç içe VE / VEYA (.bz-qb)
 *            DATE_PERIODS: gecikmiş · bugün · bu hafta · gelecek 7 gün · bu ay …
 *   Görünüm  ListView { name, scope: mine | shared | system, state } · viewDirty · viewChanges · viewHasPersonal · localViewStore
 *   Sütun    bizmoColumnChooser(kap, { columns, defaults, onChange })   (.bz-colpick) · toAgColumnState / fromAgColumnState
 *   Dışa     toCsv(satırlar, sütunlar) · toXlsx(satırlar, sütunlar) · bizmoDownload(veri, ad) · exportAudit(…) (yalnız metadata)
 *   İçe      decodeText(bayt) · parseCsv(metin) · readXlsx(bayt) · parseNumberTr · parseDateTr · autoMap(başlıklar, alanlar) · validateImport(…)
 *
 * Kurallar (DESIGN.md §42): kişisel veri alanı süzgeçte yalnız "eşittir / boş / dolu"; kişisel değer içeren süzgeç paylaşılan
 * görünüme kaydedilmez; dışa aktarmada kişisel sütunlar varsayılan maskeli, aktarma denetim kaydına içerik değil metadata yazar.
 * CSV'de formül enjeksiyonu (=, +, -, @ ile başlayan metin) etkisizleştirilir. XLSX bağımlılıksız yazılır ve okunur.
 */
import { formatFieldValue } from "./records.js";
import { bizmoMask, isValidIban, isValidTckn } from "./privacy.js";
import { bizmoDatePicker } from "./pickers.js";
const O = (op, label, arity) => ({ op, label, arity });
const EMPTY_OPS = [O("empty", "boş", 0), O("notEmpty", "dolu", 0)];
export const OPERATORS = {
    text: [O("contains", "içerir", 1), O("notContains", "içermez", 1), O("eq", "tam olarak", 1), O("neq", "değildir", 1), O("starts", "ile başlar", 1), ...EMPTY_OPS],
    number: [O("eq", "=", 1), O("neq", "≠", 1), O("gt", ">", 1), O("gte", "≥", 1), O("lt", "<", 1), O("lte", "≤", 1), O("between", "arasında", 2), ...EMPTY_OPS],
    money: [O("eq", "=", 1), O("neq", "≠", 1), O("gt", ">", 1), O("gte", "≥", 1), O("lt", "<", 1), O("lte", "≤", 1), O("between", "arasında", 2), ...EMPTY_OPS],
    date: [O("period", "dönem", "period"), O("on", "günü", 1), O("before", "öncesi", 1), O("after", "sonrası", 1), O("between", "arasında", 2), O("last", "son … gün", "days"), ...EMPTY_OPS],
    enum: [O("in", "şunlardan biri", "list"), O("notIn", "şunlar hariç", "list"), ...EMPTY_OPS],
    bool: [O("isTrue", "evet", 0), O("isFalse", "hayır", 0)],
};
/** Tarih dönemleri (hafta pazartesi başlar): değer anahtarı süzgeçte saklanır, aralık her değerlendirmede bugüne göre hesaplanır */
export const DATE_PERIODS = {
    overdue: { label: "gecikmiş (bugünden önce)", range: (t) => [null, addDays(t, -1)] },
    today: { label: "bugün", range: (t) => [t, t] },
    thisWeek: { label: "bu hafta", range: (t) => [addDays(t, -((t.getDay() + 6) % 7)), addDays(t, 6 - ((t.getDay() + 6) % 7))] },
    next7: { label: "gelecek 7 gün", range: (t) => [t, addDays(t, 6)] },
    nextWeek: { label: "gelecek hafta", range: (t) => [addDays(t, 7 - ((t.getDay() + 6) % 7)), addDays(t, 13 - ((t.getDay() + 6) % 7))] },
    thisMonth: { label: "bu ay", range: (t) => [new Date(t.getFullYear(), t.getMonth(), 1), new Date(t.getFullYear(), t.getMonth() + 1, 0)] },
    last7: { label: "son 7 gün", range: (t) => [addDays(t, -6), t] },
    lastMonth: { label: "geçen ay", range: (t) => [new Date(t.getFullYear(), t.getMonth() - 1, 1), new Date(t.getFullYear(), t.getMonth(), 0)] },
};
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
/** Kişisel veri alanında yalnız tam eşleşme ve boş / dolu (kısmi arama veriyi tahmin ettirir) */
const PERSONAL_OPS = [O("eq", "tam olarak", 1), ...EMPTY_OPS];
export const isGroup = (x) => "rules" in x;
export const opsFor = (f) => (f.personal ? PERSONAL_OPS : OPERATORS[f.type ?? "text"]);
const opDef = (f, op) => opsFor(f).find((o) => o.op === op) ?? OPERATORS[f.type ?? "text"].find((o) => o.op === op);
const blank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
/** Kural eksiksiz mi (değeri girilmiş mi) — eksik kural özete ve süzmeye katılmaz */
export function ruleComplete(r, fields) {
    const f = fields.find((x) => x.key === r.field);
    const d = f && opDef(f, r.op);
    if (!d)
        return false;
    if (d.arity === 0)
        return true;
    if (d.arity === 2)
        return !blank(r.value) && !blank(r.value2);
    return !blank(r.value);
}
export function ruleCount(g, fields) {
    return g.rules.reduce((n, r) => n + (isGroup(r) ? ruleCount(r, fields) : !fields || ruleComplete(r, fields) ? 1 : 0), 0);
}
const showValue = (f, v) => {
    const t = f.type ?? "text";
    if (t === "text")
        return `"${String(v)}"`;
    if (t === "enum")
        return f.options?.[String(v)] ?? String(v);
    return formatFieldValue(v, { kind: t === "money" ? "money" : t === "date" ? "date" : "number", unit: f.unit }) || String(v);
};
function ruleText(r, fields) {
    const f = fields.find((x) => x.key === r.field);
    if (!f || !ruleComplete(r, fields))
        return "";
    const d = opDef(f, r.op);
    const v = (x) => showValue(f, x);
    switch (r.op) {
        case "in": return `${f.label}: ${r.value.map(v).join(", ")}`;
        case "notIn": return `${f.label}: ${r.value.map(v).join(", ")} hariç`;
        case "isTrue": return `${f.label}: evet`;
        case "isFalse": return `${f.label}: hayır`;
        case "empty":
        case "notEmpty": return `${f.label} ${d.label}`;
        case "between": return `${f.label} ${v(r.value)} – ${v(r.value2)} arasında`;
        case "on": return `${f.label} ${v(r.value)}`;
        case "before":
        case "after": return `${f.label} ${v(r.value)} ${d.label}`;
        case "last": return `${f.label} son ${Number(r.value)} gün`;
        case "period": return `${f.label} ${DATE_PERIODS[String(r.value)]?.label ?? String(r.value)}`;
        default: return `${f.label} ${d.label} ${v(r.value)}`;
    }
}
/** Okunur özet: "ve" / "veya", iç grup parantezli. Boş süzgeç → "" */
export function filterSummary(g, fields, nested = false) {
    const parts = g.rules.map((r) => (isGroup(r) ? filterSummary(r, fields, true) : ruleText(r, fields))).filter(Boolean);
    const s = parts.join(g.join === "and" ? " ve " : " veya ");
    return nested && parts.length > 1 ? `(${s})` : s;
}
/** Üst düzey kurallar çip olarak (iç grup tek çip); i ile removeRule'a verilir */
export function filterChips(g, fields) {
    return g.rules.map((r, i) => ({ i, text: isGroup(r) ? filterSummary(r, fields, true) : ruleText(r, fields), group: isGroup(r) })).filter((c) => c.text);
}
export const removeRule = (g, i) => ({ ...g, rules: g.rules.filter((_, k) => k !== i) });
// Karşılaştırma yardımcıları
const trLower = (v) => String(v ?? "").toLocaleLowerCase("tr-TR");
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function toDay(v) {
    if (blank(v))
        return null;
    if (v instanceof Date)
        return Number.isNaN(+v) ? null : ymd(v);
    if (typeof v === "number")
        return ymd(new Date(v));
    return parseDateTr(String(v));
}
const toNum = (v) => (typeof v === "number" ? v : parseNumberTr(String(v ?? "")));
function test(row, r, f, now) {
    const raw = f.get ? f.get(row) : row?.[f.key];
    const t = f.type ?? "text";
    if (r.op === "empty")
        return blank(raw);
    if (r.op === "notEmpty")
        return !blank(raw);
    if (r.op === "isTrue")
        return !!raw;
    if (r.op === "isFalse")
        return !raw;
    if (r.op === "in" || r.op === "notIn") {
        const set = new Set(r.value.map(String)), hit = !blank(raw) && set.has(String(raw));
        return r.op === "in" ? hit : !hit;
    }
    if (t === "number" || t === "money") {
        const a = toNum(raw), b = toNum(r.value), c = toNum(r.value2);
        if (Number.isNaN(a))
            return r.op === "neq";
        switch (r.op) {
            case "eq": return a === b;
            case "neq": return a !== b;
            case "gt": return a > b;
            case "gte": return a >= b;
            case "lt": return a < b;
            case "lte": return a <= b;
            case "between": return a >= Math.min(b, c) && a <= Math.max(b, c);
        }
        return false;
    }
    if (t === "date") {
        const a = toDay(raw);
        if (!a)
            return false;
        const b = toDay(r.value), c = toDay(r.value2);
        switch (r.op) {
            case "on": return a === b;
            case "before": return !!b && a < b;
            case "after": return !!b && a > b;
            case "between": return !!b && !!c && a >= (b < c ? b : c) && a <= (b < c ? c : b);
            case "last": {
                const from = ymd(new Date(now - Number(r.value) * 86_400_000));
                return a >= from && a <= ymd(new Date(now));
            }
            case "period": {
                const p = DATE_PERIODS[String(r.value)];
                if (!p)
                    return false;
                const t = new Date(now), [from, to] = p.range(new Date(t.getFullYear(), t.getMonth(), t.getDate()));
                return (!from || a >= ymd(from)) && (!to || a <= ymd(to));
            }
        }
        return false;
    }
    const a = trLower(raw), b = trLower(r.value);
    switch (r.op) {
        case "contains": return a.includes(b);
        case "notContains": return !a.includes(b);
        case "eq": return a === b;
        case "neq": return a !== b;
        case "starts": return a.startsWith(b);
    }
    return false;
}
/** İstemci tarafında süzme (küçük listeler, önizleme). Büyük listede süzgeç sunucuya JSON olarak gider. */
export function matchFilter(row, g, fields, now = Date.now()) {
    const results = g.rules
        .map((r) => {
        if (isGroup(r))
            return r.rules.length ? matchFilter(row, r, fields, now) : null;
        const f = fields.find((x) => x.key === r.field);
        return f && ruleComplete(r, fields) ? test(row, r, f, now) : null;
    })
        .filter((x) => x !== null);
    if (!results.length)
        return true;
    return g.join === "and" ? results.every(Boolean) : results.some(Boolean);
}
// ───────── Süzgeç oluşturucu (DOM) ─────────
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SVG = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I_X = SVG('<path d="M18 6 6 18M6 6l12 12"/>');
const I_PLUS = SVG('<path d="M12 5v14M5 12h14"/>');
const I_UP = SVG('<path d="m6 15 6-6 6 6"/>');
const I_DOWN = SVG('<path d="m6 9 6 6 6-6"/>');
const I_PIN = SVG('<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6Z"/><path d="M12 15v5"/>');
const I_SEARCH = SVG('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>');
const clone = (x) => JSON.parse(JSON.stringify(x));
const fromIso = (s) => { const d = toDay(s); if (!d)
    return null; const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd); };
/**
 * Görsel süzgeç oluşturucu: alan · koşul · değer satırları, VE / VEYA grupları (maxDepth 2 = ana grup + bir iç grup).
 * Değer türüne göre giriş: metin, sayı (tr-TR ondalık virgül), tarih (temanın seçicisi), liste (çoklu seçim çipleri).
 */
export function bizmoFilterBuilder(host, o) {
    let state = clone(o.value ?? { join: "and", rules: [] });
    const maxDepth = o.maxDepth ?? 2;
    const fields = o.fields;
    const emit = () => o.onChange?.(clone(state));
    const at = (path) => path.reduce((g, i) => g.rules[i], state);
    const valueHtml = (r, f, id) => {
        const d = opDef(f, r.op);
        if (!d || d.arity === 0)
            return "";
        const t = f.type ?? "text";
        const num = t === "number" || t === "money";
        const inp = (v, which, label) => `<input class="bz-field bz-field--sm" data-v="${which}" aria-label="${esc(label)}" value="${esc(blank(v) ? "" : num ? String(v).replace(".", ",") : v)}"${num ? ' inputmode="decimal"' : ""} placeholder="${num ? "0" : "Değer"}" />`;
        if (d.arity === "list") {
            const sel = new Set((r.value ?? []).map(String));
            return `<span class="bz-qb__options" role="group" aria-label="${esc(f.label)} değerleri">${Object.entries(f.options ?? {}).map(([k, l]) => `<button type="button" class="bz-chip bz-qb__option" data-opt="${esc(k)}" aria-pressed="${sel.has(k)}">${esc(l)}</button>`).join("")}</span>`;
        }
        if (d.arity === "period")
            return `<select class="bz-field bz-field--sm" data-v="value" aria-label="${esc(f.label)} dönemi"><option value="">Dönem seçin</option>${Object.entries(DATE_PERIODS).map(([k, p]) => `<option value="${k}"${r.value === k ? " selected" : ""}>${esc(p.label)}</option>`).join("")}</select>`;
        if (d.arity === "days")
            return `<span class="bz-qb__pair"><input class="bz-field bz-field--sm bz-qb__days" data-v="value" inputmode="numeric" aria-label="Gün sayısı" value="${esc(r.value ?? "")}" placeholder="7" /><span>gün</span></span>`;
        if (t === "date") {
            return d.arity === 2
                ? `<button type="button" class="bz-picker bz-qb__picker" data-picker="range" id="${id}-d" aria-label="${esc(f.label)} tarih aralığı"></button>`
                : `<button type="button" class="bz-picker bz-qb__picker" data-picker="single" id="${id}-d" aria-label="${esc(f.label)} tarihi"></button>`;
        }
        if (d.arity === 2)
            return `<span class="bz-qb__pair">${inp(r.value, "value", `${f.label} en az`)}<span aria-hidden="true">–</span>${inp(r.value2, "value2", `${f.label} en çok`)}</span>`;
        return inp(r.value, "value", `${f.label} değeri`);
    };
    const ruleHtml = (r, path, first, join) => {
        const f = fields.find((x) => x.key === r.field) ?? fields[0];
        const id = `qb-${path.join("-")}`;
        return `<li class="bz-qb__rule" data-path="${path.join(".")}">
      <span class="bz-qb__join">${first ? "Eğer" : join === "and" ? "ve" : "veya"}</span>
      <select class="bz-field bz-field--sm" data-role="field" aria-label="Alan">${fields.map((x) => `<option value="${esc(x.key)}"${x.key === f.key ? " selected" : ""}>${esc(x.label)}</option>`).join("")}</select>
      <select class="bz-field bz-field--sm" data-role="op" aria-label="Koşul">${opsFor(f).map((d) => `<option value="${d.op}"${d.op === r.op ? " selected" : ""}>${esc(d.label)}</option>`).join("")}</select>
      <span class="bz-qb__value">${valueHtml(r, f, id)}</span>
      <button type="button" class="bz-icon-btn bz-icon-btn--sm bz-qb__remove" data-role="remove" aria-label="Koşulu kaldır: ${esc(f.label)}">${I_X}</button>
    </li>`;
    };
    const groupHtml = (g, path) => {
        const depth = path.length;
        const rules = g.rules.map((r, i) => (isGroup(r) ? `<li class="bz-qb__nested" data-path="${[...path, i].join(".")}"><span class="bz-qb__join">${i === 0 ? "Eğer" : g.join === "and" ? "ve" : "veya"}</span>${groupHtml(r, [...path, i])}</li>` : ruleHtml(r, [...path, i], i === 0, g.join))).join("");
        return `<div class="bz-qb__group" data-join="${g.join}" data-depth="${depth}" data-path="${path.join(".")}">
      <div class="bz-qb__head">
        <span class="bz-segmented bz-qb__joins" role="group" aria-label="${depth ? "İç grup birleşimi" : "Koşul birleşimi"}"><button type="button" data-join="and" aria-pressed="${g.join === "and"}">VE</button><button type="button" data-join="or" aria-pressed="${g.join === "or"}">VEYA</button></span>
        <span class="bz-qb__hint">${g.join === "and" ? "Tüm koşullar sağlansın" : "Koşullardan biri yeter"}</span>
        ${depth ? `<button type="button" class="bz-icon-btn bz-icon-btn--sm bz-qb__remove" data-role="remove-group" aria-label="Grubu kaldır">${I_X}</button>` : ""}
      </div>
      ${rules ? `<ol class="bz-qb__rules">${rules}</ol>` : `<p class="bz-qb__empty">Koşul yok — tüm kayıtlar listelenir.</p>`}
      <div class="bz-qb__add"><button type="button" class="bz-chip bz-chip--add" data-role="add-rule">${I_PLUS}Koşul</button>${depth + 1 < maxDepth ? `<button type="button" class="bz-chip bz-chip--add" data-role="add-group">${I_PLUS}Grup</button>` : ""}</div>
    </div>`;
    };
    const pickers = [];
    const closePickers = () => { pickers.forEach((p) => { try {
        p.close();
    }
    catch { /* kapalı */ } }); pickers.length = 0; };
    function render() {
        closePickers();
        host.innerHTML = `<div class="bz-qb" role="group" aria-label="${esc(o.label ?? "Süzgeç")}">${groupHtml(state, [])}</div>`;
        host.querySelectorAll("[data-picker]").forEach((btn) => {
            const path = btn.closest(".bz-qb__rule").dataset.path.split(".").map(Number);
            const r = at(path);
            const range = btn.dataset.picker === "range";
            const p = bizmoDatePicker(btn, {
                mode: range ? "range" : "single",
                value: range ? { start: fromIso(r.value), end: fromIso(r.value2) } : fromIso(r.value),
                placeholder: range ? "Tarih aralığı" : "Tarih seçin",
                onChange: (v) => {
                    if (range) {
                        r.value = v?.start ? ymd(v.start) : null;
                        r.value2 = v?.end ? ymd(v.end) : null;
                    }
                    else
                        r.value = v ? ymd(v) : null;
                    emit();
                },
            });
            pickers.push(p);
        });
    }
    const defaultRule = (f) => ({ field: f.key, op: opsFor(f)[0].op });
    host.addEventListener("click", (e) => {
        const t = e.target.closest("button");
        if (!t || !host.contains(t))
            return;
        const holder = t.closest("[data-path]");
        const path = holder?.dataset.path ? holder.dataset.path.split(".").map(Number) : [];
        const groupPath = t.closest(".bz-qb__group")?.dataset.path;
        const gp = groupPath ? groupPath.split(".").map(Number) : [];
        if (t.dataset.join) {
            at(gp).join = t.dataset.join;
            render();
            emit();
            host.querySelector(`.bz-qb__group[data-path="${gp.join(".")}"] [data-join="${t.dataset.join}"]`)?.focus();
            return;
        }
        if (t.dataset.opt !== undefined) {
            const r = at(path);
            const set = new Set((r.value ?? []).map(String));
            set.has(t.dataset.opt) ? set.delete(t.dataset.opt) : set.add(t.dataset.opt);
            r.value = [...set];
            t.setAttribute("aria-pressed", String(set.has(t.dataset.opt)));
            emit();
            return;
        }
        const role = t.dataset.role;
        if (role === "add-rule") {
            at(gp).rules.push(defaultRule(fields[0]));
            render();
            emit();
            focusLast(gp);
        }
        else if (role === "add-group") {
            at(gp).rules.push({ join: gp.length ? "and" : state.join === "and" ? "or" : "and", rules: [defaultRule(fields[0])] });
            render();
            emit();
        }
        else if (role === "remove" || role === "remove-group") {
            const p = role === "remove" ? path : gp;
            const parent = at(p.slice(0, -1));
            parent.rules.splice(p[p.length - 1], 1);
            render();
            emit();
            host.querySelector('[data-role="add-rule"]')?.focus();
        }
    });
    const focusLast = (gp) => {
        const g = host.querySelector(`.bz-qb__group[data-path="${gp.join(".")}"]`);
        const rows = g?.querySelectorAll(":scope > .bz-qb__rules > .bz-qb__rule");
        rows?.[rows.length - 1]?.querySelector("select")?.focus();
    };
    host.addEventListener("change", (e) => {
        const el = e.target;
        const row = el.closest(".bz-qb__rule");
        if (!row || !el.dataset.role)
            return;
        const path = row.dataset.path.split(".").map(Number);
        const r = at(path);
        if (el.dataset.role === "field") {
            const f = fields.find((x) => x.key === el.value);
            Object.assign(r, defaultRule(f), { value: undefined, value2: undefined });
        }
        else {
            const f = fields.find((x) => x.key === r.field);
            const before = opDef(f, r.op)?.arity, after = opDef(f, el.value)?.arity;
            r.op = el.value;
            if (before !== after) {
                r.value = undefined;
                r.value2 = undefined;
            }
        }
        render();
        emit();
        host.querySelector(`.bz-qb__rule[data-path="${path.join(".")}"] [data-role="${el.dataset.role}"]`)?.focus();
    });
    host.addEventListener("input", (e) => {
        const el = e.target;
        if (!el.dataset.v)
            return;
        const row = el.closest(".bz-qb__rule");
        const r = at(row.dataset.path.split(".").map(Number));
        const f = fields.find((x) => x.key === r.field);
        const t = f.type ?? "text", num = t === "number" || t === "money" || el.classList.contains("bz-qb__days");
        const v = el.value.trim() === "" ? undefined : num ? parseNumberTr(el.value) : el.value;
        el.setAttribute("aria-invalid", String(num && v !== undefined && Number.isNaN(v)));
        r[el.dataset.v] = typeof v === "number" && Number.isNaN(v) ? undefined : v;
        emit();
    });
    render();
    return {
        get: () => clone(state),
        set: (g) => { state = clone(g); render(); },
        destroy: () => { closePickers(); host.innerHTML = ""; },
    };
}
/** Hapta kısa koşul metni: "=", "≠", "≥", "içerir", "arasında"… (liste tek değerse "=", çoksa "şunlardan biri") */
function pillOp(r, f) {
    const n = Array.isArray(r.value) ? r.value.length : 0;
    switch (r.op) {
        case "in": return n > 1 ? "şunlardan biri" : "=";
        case "notIn": return n > 1 ? "şunlar hariç" : "≠";
        case "on":
        case "period": return "=";
        case "before": return "<";
        case "after": return ">";
        case "last": return "son";
        case "isTrue":
        case "isFalse": return "=";
        default: return opDef(f, r.op)?.label ?? r.op;
    }
}
/** Hapta değer özeti: ilk iki seçenek + "+2", tarih "11 Eki – 10 Kas", dönem adı; eksikse "" */
function pillValue(r, f) {
    const t = f.type ?? "text";
    const day = (v) => { const d = fromIso(v); return d ? d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : ""; };
    const num = (v) => formatFieldValue(v, { kind: t === "money" ? "money" : "number", unit: f.unit, digits: t === "money" ? 0 : undefined });
    if (!ruleComplete(r, [f]))
        return "";
    switch (r.op) {
        case "in":
        case "notIn": {
            const l = r.value.map((v) => f.options?.[v] ?? v);
            return l.length > 2 ? `${l.slice(0, 2).join(", ")} +${l.length - 2}` : l.join(", ");
        }
        case "isTrue": return "Evet";
        case "isFalse": return "Hayır";
        case "empty": return "boş";
        case "notEmpty": return "dolu";
        case "period": return DATE_PERIODS[String(r.value)]?.label ?? String(r.value);
        case "last": return `${r.value} gün`;
        case "between": return t === "date" ? `${day(r.value)} – ${day(r.value2)}` : `${num(r.value)} – ${num(r.value2)}`;
        default: return t === "date" ? day(r.value) : t === "number" || t === "money" ? num(r.value) : `“${String(r.value)}”`;
    }
}
const TYPE_ICON = {
    text: SVG('<path d="M5 6h14M12 6v13M9 19h6"/>'),
    number: SVG('<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>'),
    money: SVG('<path d="M7 8h7a3 3 0 0 1 0 6H8M8 4v16M6 16h9"/>'),
    date: SVG('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>'),
    enum: SVG('<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    bool: SVG('<rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="16" cy="12" r="3"/>'),
};
const I_CHECK = SVG('<path d="m5 12 5 5 9-10"/>');
const I_FILTER = SVG('<path d="M4 5h16l-6 7.5V19l-4-2v-4.5L4 5Z"/>');
/**
 * Pratik süzgeç çubuğu (Linear / Notion tarzı): her koşul bir hap — [Alan] [koşul] [değer] [×]; her parça tıklanınca küçük
 * pencere açar. "+ Süzgeç" alan arar (yaz-süz, ↑↓, Enter), seçilen alanda doğrudan değer penceresi açılır. Liste değeri onay
 * kutulu (aramalı), tarih için hazır dönemler (bugün, bu hafta, gecikmiş…) ve özel aralık, sayıda tek / iki alan.
 * Hızlı süzgeç çipleri tek dokunuşla ekler / kaldırır. İki ve daha çok koşulda "Tümü / Herhangi biri" birleşimi.
 * İç gruplar (gelişmiş) tek hap olarak görünür; tıklanınca onAdvanced çağrılır. Değer girilmemiş hap kesikli ve uygulanmaz.
 */
export function bizmoFilterBar(host, o) {
    let state = clone(o.value ?? { join: "and", rules: [] });
    const fields = o.fields;
    const F = (k) => fields.find((x) => x.key === k);
    const emit = () => o.onChange?.(clone(state));
    let pop = null;
    const pickers = [];
    const same = (a, b) => stable(a) === stable(b);
    const quickOn = (q) => q.rules.every((r) => state.rules.some((x) => !isGroup(x) && same(x, r)));
    function render(focus) {
        const n = state.rules.length;
        const quick = (o.quick ?? []).map((q) => `<button type="button" class="bz-fbar__quick" data-quick="${esc(q.id)}" aria-pressed="${quickOn(q)}">${quickOn(q) ? I_CHECK : ""}${esc(q.label)}</button>`).join("");
        const pills = state.rules.map((r, i) => {
            if (isGroup(r)) {
                const text = filterSummary(r, fields, true) || "Boş grup";
                return `<div class="bz-fpill" data-group="true" data-i="${i}" role="group" aria-label="${esc(`Gelişmiş süzgeç: ${text}`)}"><button type="button" class="bz-fpill__part bz-fpill__value" data-part="group" title="${esc(text)}">${I_FILTER}<span>${esc(text)}</span></button><button type="button" class="bz-fpill__x" data-part="remove" aria-label="${esc(`Süzgeci kaldır: ${text}`)}">${I_X}</button></div>`;
            }
            const f = F(r.field), v = pillValue(r, f), full = filterSummary({ join: "and", rules: [r] }, fields) || `${f.label}: değer seçilmedi`;
            return `<div class="bz-fpill"${v ? "" : ' data-incomplete="true"'} data-i="${i}" role="group" aria-label="${esc(`Süzgeç: ${full}`)}">
        <button type="button" class="bz-fpill__part bz-fpill__field" data-part="field" aria-label="${esc(`Alanı değiştir: ${f.label}`)}">${TYPE_ICON[f.type ?? "text"]}<span>${esc(f.label)}</span></button>
        <button type="button" class="bz-fpill__part bz-fpill__op" data-part="op" aria-label="${esc(`Koşulu değiştir: ${pillOp(r, f)}`)}">${esc(pillOp(r, f))}</button>
        <button type="button" class="bz-fpill__part bz-fpill__value" data-part="value" aria-label="${esc(`Değeri değiştir: ${v || "seçilmedi"}`)}" title="${esc(full)}"><span>${esc(v || "değer seçin")}</span></button>
        <button type="button" class="bz-fpill__x" data-part="remove" aria-label="${esc(`Süzgeci kaldır: ${full}`)}">${I_X}</button>
      </div>`;
        }).join("");
        host.innerHTML = `<div class="bz-fbar" role="group" aria-label="${esc(o.label ?? "Süzgeçler")}">
      ${quick ? `<div class="bz-fbar__quicks" role="group" aria-label="Hızlı süzgeçler">${quick}</div>` : ""}
      ${pills}
      <button type="button" class="bz-fbar__add" data-part="add" aria-haspopup="dialog">${I_PLUS}${n ? "" : "Süzgeç"}<span class="bz-sr-only">${n ? "Süzgeç ekle" : ""}</span></button>
      ${n > 1 ? `<button type="button" class="bz-fbar__join" data-part="join" aria-label="Birleşim: ${state.join === "and" ? "tüm koşullar" : "koşullardan biri"} · değiştir">${state.join === "and" ? "Tümü sağlansın" : "Herhangi biri"}</button>` : ""}
      ${n ? '<button type="button" class="bz-fbar__clear" data-part="clear">Temizle</button>' : ""}
      ${o.onAdvanced ? '<button type="button" class="bz-fbar__adv" data-part="advanced">Gelişmiş</button>' : ""}
    </div>`;
        if (focus)
            (host.querySelector(`.bz-fpill[data-i="${focus.i}"] [data-part="${focus.part}"]`) ?? host.querySelector('[data-part="add"]'))?.focus();
    }
    // Açılır pencere: çubuğun altında, dışarı tık / Esc kapatır, odak tetikleyiciye döner
    function closePop(refocus = false) {
        pickers.forEach((p) => { try {
            p.close();
        }
        catch { /* kapalı */ } });
        pickers.length = 0;
        if (!pop)
            return;
        const a = pop.anchor;
        pop.off();
        pop.el.remove();
        pop = null;
        if (refocus && a.isConnected)
            a.focus();
    }
    function openPop(anchor, build, label) {
        closePop();
        const el = document.createElement("div");
        el.className = "bz-fpop";
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", label);
        document.body.append(el);
        build(el);
        const place = () => { const r = anchor.getBoundingClientRect(); el.style.left = `${Math.max(8, Math.min(r.left, innerWidth - el.offsetWidth - 8))}px`; el.style.top = `${Math.min(r.bottom + 6, innerHeight - el.offsetHeight - 8)}px`; };
        place();
        const outside = (e) => { const t = e.target; if (!el.contains(t) && !anchor.contains(t) && !t.closest?.(".bz-picker-pop"))
            closePop(); };
        const key = (e) => { if (e.key === "Escape" && !document.querySelector(".bz-picker-pop")) {
            e.stopPropagation();
            closePop(true);
        } };
        const onScroll = () => place();
        setTimeout(() => document.addEventListener("pointerdown", outside), 0);
        document.addEventListener("keydown", key, true);
        window.addEventListener("resize", onScroll);
        window.addEventListener("scroll", onScroll, true);
        pop = { el, anchor, off: () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key, true); window.removeEventListener("resize", onScroll); window.removeEventListener("scroll", onScroll, true); } };
        (el.querySelector("[data-autofocus]") ?? el.querySelector("input, button"))?.focus();
    }
    // Ok tuşlarıyla gezilen seçenek listesi (alan ve koşul seçimi)
    const listNav = (el) => el.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp")
            return;
        const items = [...el.querySelectorAll(".bz-fpop__item:not([hidden])")];
        const i = items.indexOf(document.activeElement);
        e.preventDefault();
        items[e.key === "ArrowDown" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1)]?.focus();
    });
    function fieldMenu(anchor, onPick, current) {
        openPop(anchor, (el) => {
            el.innerHTML = `<label class="bz-fpop__search">${I_SEARCH}<input type="search" placeholder="Alan ara" aria-label="Alan ara" data-autofocus /></label>
        <div class="bz-fpop__list" role="listbox" aria-label="Alanlar">${fields.map((f) => `<button type="button" class="bz-fpop__item" role="option" data-key="${esc(f.key)}" aria-selected="${f.key === current}">${TYPE_ICON[f.type ?? "text"]}<span>${esc(f.label)}</span>${f.personal ? '<small>kişisel</small>' : ""}</button>`).join("")}</div>`;
            const input = el.querySelector("input");
            input.addEventListener("input", () => { const q = input.value.toLocaleLowerCase("tr-TR"); el.querySelectorAll(".bz-fpop__item").forEach((b) => (b.hidden = !!q && !b.textContent.toLocaleLowerCase("tr-TR").includes(q))); });
            input.addEventListener("keydown", (e) => {
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    el.querySelector(".bz-fpop__item:not([hidden])")?.focus();
                }
                if (e.key === "Enter") {
                    e.preventDefault();
                    el.querySelector(".bz-fpop__item:not([hidden])")?.click();
                }
            });
            listNav(el);
            el.addEventListener("click", (e) => { const b = e.target.closest(".bz-fpop__item"); if (b)
                onPick(F(b.dataset.key)); });
        }, "Alan seçin");
    }
    function opMenu(anchor, i) {
        const r = state.rules[i], f = F(r.field);
        openPop(anchor, (el) => {
            el.innerHTML = `<div class="bz-fpop__list" role="listbox" aria-label="Koşul">${opsFor(f).map((d) => `<button type="button" class="bz-fpop__item" role="option" data-op="${d.op}" aria-selected="${d.op === r.op}"${d.op === r.op ? " data-autofocus" : ""}><span>${esc(d.label)}</span>${d.op === r.op ? I_CHECK : ""}</button>`).join("")}</div>`;
            listNav(el);
            el.addEventListener("click", (e) => {
                const b = e.target.closest("[data-op]");
                if (!b)
                    return;
                const before = opDef(f, r.op)?.arity, after = opDef(f, b.dataset.op)?.arity;
                r.op = b.dataset.op;
                if (before !== after) {
                    r.value = undefined;
                    r.value2 = undefined;
                }
                render();
                emit();
                const pill = host.querySelector(`.bz-fpill[data-i="${i}"]`);
                if (after === 0)
                    closePop(true);
                else
                    valueEditor(pill.querySelector('[data-part="value"]'), i);
            });
        }, "Koşul seçin");
    }
    function valueEditor(anchor, i) {
        const r = state.rules[i], f = F(r.field), d = opDef(f, r.op);
        const t = f.type ?? "text";
        const update = (focusPart = false) => { render(); emit(); if (pop) {
            const a = host.querySelector(`.bz-fpill[data-i="${i}"] [data-part="value"]`);
            if (a)
                pop.anchor = a;
            if (focusPart)
                closePop(true);
        } };
        openPop(anchor, (el) => {
            if (d.arity === "list") {
                const sel = new Set((r.value ?? []).map(String)), opts = Object.entries(f.options ?? {});
                el.innerHTML = `${opts.length > 7 ? `<label class="bz-fpop__search">${I_SEARCH}<input type="search" placeholder="${esc(f.label)} ara" aria-label="${esc(f.label)} ara" data-autofocus /></label>` : ""}
          <div class="bz-fpop__list" role="group" aria-label="${esc(f.label)}">${opts.map(([k, l], j) => `<label class="bz-fpop__item bz-fpop__check"><input type="checkbox" value="${esc(k)}"${sel.has(k) ? " checked" : ""}${j === 0 && opts.length <= 7 ? " data-autofocus" : ""} /><span>${esc(l)}</span></label>`).join("")}</div>
          <div class="bz-fpop__foot"><button type="button" class="bz-btn bz-btn--sm bz-btn--ghost" data-act="none">Seçimi temizle</button><button type="button" class="bz-btn bz-btn--sm" data-act="done">Tamam</button></div>`;
                el.querySelector('input[type="search"]')?.addEventListener("input", (e) => { const q = e.target.value.toLocaleLowerCase("tr-TR"); el.querySelectorAll(".bz-fpop__check").forEach((b) => (b.hidden = !!q && !b.textContent.toLocaleLowerCase("tr-TR").includes(q))); });
                el.addEventListener("change", () => { r.value = [...el.querySelectorAll('.bz-fpop__check input:checked')].map((x) => x.value); update(); });
                el.addEventListener("click", (e) => { const a = e.target.closest("[data-act]")?.dataset.act; if (a === "none") {
                    el.querySelectorAll(".bz-fpop__check input").forEach((x) => (x.checked = false));
                    r.value = [];
                    update();
                } if (a === "done")
                    closePop(true); });
                return;
            }
            if (d.arity === "period" || (t === "date" && (d.arity === 1 || d.arity === 2))) {
                // Tarih: hazır dönemler + özel tarih / aralık (temanın seçicisi)
                const periods = Object.entries(DATE_PERIODS).map(([k, p]) => `<button type="button" class="bz-fpop__item" data-period="${k}" aria-pressed="${r.op === "period" && r.value === k}"><span>${esc(p.label[0].toLocaleUpperCase("tr-TR") + p.label.slice(1))}</span>${r.op === "period" && r.value === k ? I_CHECK : ""}</button>`).join("");
                el.innerHTML = `<div class="bz-fpop__list" role="group" aria-label="Dönem">${periods}</div><div class="bz-fpop__sep"></div>
          <div class="bz-fpop__row"><span class="bz-fpop__label">Özel</span><button type="button" class="bz-picker bz-fpop__picker" data-custom="single" aria-label="Tek gün"></button><button type="button" class="bz-picker bz-fpop__picker" data-custom="range" aria-label="Tarih aralığı"></button></div>`;
                el.querySelector("[data-period]")?.setAttribute("data-autofocus", "");
                listNav(el);
                el.addEventListener("click", (e) => { const b = e.target.closest("[data-period]"); if (!b)
                    return; r.op = "period"; r.value = b.dataset.period; r.value2 = undefined; update(true); });
                const single = el.querySelector('[data-custom="single"]'), range = el.querySelector('[data-custom="range"]');
                pickers.push(bizmoDatePicker(single, { value: r.op === "on" ? fromIso(r.value) : null, placeholder: "Tek gün", onChange: (v) => { if (!v)
                        return; r.op = "on"; r.value = ymd(v); r.value2 = undefined; update(true); } }));
                pickers.push(bizmoDatePicker(range, { mode: "range", value: r.op === "between" ? { start: fromIso(r.value), end: fromIso(r.value2) } : { start: null, end: null }, placeholder: "Aralık", onChange: (v) => { if (!v?.start || !v?.end)
                        return; r.op = "between"; r.value = ymd(v.start); r.value2 = ymd(v.end); update(true); } }));
                return;
            }
            if (t === "bool" || r.op === "isTrue" || r.op === "isFalse") {
                el.innerHTML = `<div class="bz-fpop__list" role="group" aria-label="${esc(f.label)}"><button type="button" class="bz-fpop__item" data-bool="1" aria-pressed="${r.op === "isTrue"}" data-autofocus><span>Evet</span>${r.op === "isTrue" ? I_CHECK : ""}</button><button type="button" class="bz-fpop__item" data-bool="0" aria-pressed="${r.op === "isFalse"}"><span>Hayır</span>${r.op === "isFalse" ? I_CHECK : ""}</button></div>`;
                listNav(el);
                el.addEventListener("click", (e) => { const b = e.target.closest("[data-bool]"); if (b) {
                    r.op = b.dataset.bool === "1" ? "isTrue" : "isFalse";
                    update(true);
                } });
                return;
            }
            if (d.arity === 0) {
                el.innerHTML = `<p class="bz-fpop__hint">${esc(f.label)} ${esc(d.label)} — değer gerekmez.</p>`;
                return;
            }
            // Metin / sayı: yazdıkça uygulanır (250 ms), Enter kapatır
            const num = t === "number" || t === "money" || d.arity === "days";
            const show = (v) => (v === undefined || v === null ? "" : num ? String(v).replace(".", ",") : String(v));
            const inp = (which, ph, auto = false) => `<input class="bz-field bz-field--sm" data-v="${which}"${num ? ' inputmode="decimal"' : ""} placeholder="${esc(ph)}" aria-label="${esc(`${f.label} ${ph}`)}" value="${esc(show(r[which]))}"${auto ? " data-autofocus" : ""} />`;
            el.innerHTML = `<div class="bz-fpop__row">${d.arity === 2 ? `${inp("value", "en az", true)}<span aria-hidden="true">–</span>${inp("value2", "en çok")}` : d.arity === "days" ? `${inp("value", "7", true)}<span>gün</span>` : inp("value", t === "text" ? `${f.label} ${d.label}…` : "değer", true)}</div><p class="bz-fpop__hint">${f.personal ? "Kişisel veri: yalnız tam eşleşme aranır." : num ? "Ondalık için virgül: 12,5 · binlik ayraç gerekmez" : "Büyük / küçük harf ve Türkçe karakter duyarsız"}</p>`;
            let tm = 0;
            el.addEventListener("input", (e) => {
                const x = e.target;
                if (!x.dataset.v)
                    return;
                const v = x.value.trim() === "" ? undefined : num ? parseNumberTr(x.value) : x.value;
                const bad = num && v !== undefined && Number.isNaN(v);
                x.setAttribute("aria-invalid", String(bad));
                r[x.dataset.v] = bad ? undefined : v;
                clearTimeout(tm);
                tm = window.setTimeout(() => update(), 250);
            });
            el.addEventListener("keydown", (e) => { if (e.key === "Enter") {
                e.preventDefault();
                clearTimeout(tm);
                update(true);
            } });
        }, `${f.label} değeri`);
    }
    host.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || !host.contains(b))
            return;
        if (b.dataset.quick) {
            const q = (o.quick ?? []).find((x) => x.id === b.dataset.quick);
            if (quickOn(q))
                state.rules = state.rules.filter((x) => isGroup(x) || !q.rules.some((r) => same(x, r)));
            else
                state.rules.push(...clone(q.rules).filter((r) => !state.rules.some((x) => !isGroup(x) && same(x, r))));
            render();
            emit();
            host.querySelector(`[data-quick="${CSS.escape(q.id)}"]`)?.focus();
            return;
        }
        const part = b.dataset.part, i = Number(b.closest(".bz-fpill")?.dataset.i);
        switch (part) {
            case "add":
                fieldMenu(b, (f) => {
                    const d = opsFor(f)[0];
                    state.rules.push({ field: f.key, op: f.type === "date" ? "period" : d.op });
                    const j = state.rules.length - 1;
                    render();
                    emit();
                    valueEditor(host.querySelector(`.bz-fpill[data-i="${j}"] [data-part="value"]`), j);
                });
                break;
            case "field":
                fieldMenu(b, (f) => { state.rules[i] = { field: f.key, op: f.type === "date" ? "period" : opsFor(f)[0].op }; render(); emit(); valueEditor(host.querySelector(`.bz-fpill[data-i="${i}"] [data-part="value"]`), i); }, state.rules[i].field);
                break;
            case "op":
                opMenu(b, i);
                break;
            case "value":
                valueEditor(b, i);
                break;
            case "group":
                o.onAdvanced?.();
                break;
            case "remove":
                closePop();
                state.rules.splice(i, 1);
                render({ i: Math.min(i, state.rules.length - 1), part: "value" });
                emit();
                break;
            case "join":
                state.join = state.join === "and" ? "or" : "and";
                render();
                emit();
                host.querySelector('[data-part="join"]')?.focus();
                break;
            case "clear":
                closePop();
                state.rules = [];
                render();
                emit();
                host.querySelector('[data-part="add"]')?.focus();
                break;
            case "advanced":
                o.onAdvanced?.();
                break;
        }
    });
    // Hapın üzerindeyken Sil / Geri al tuşu hapı kaldırır
    host.addEventListener("keydown", (e) => {
        if (e.key !== "Backspace" && e.key !== "Delete")
            return;
        const pill = e.target.closest(".bz-fpill");
        if (!pill)
            return;
        e.preventDefault();
        pill.querySelector('[data-part="remove"]')?.click();
    });
    render();
    return {
        get: () => clone(state),
        set(g) { state = clone(g); closePop(); render(); },
        /** Klavye kısayolu için: "+ Süzgeç" penceresini açar (ör. F tuşu) */
        open() { host.querySelector('[data-part="add"]')?.click(); },
        destroy() { closePop(); host.innerHTML = ""; },
    };
}
const stable = (x) => JSON.stringify(x, (_, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
const colKey = (c) => c.map((x) => ({ k: x.key, v: x.visible, p: x.pinned ?? null }));
/** Eksik kuralları ve boş grupları atar — sunucuya gidecek ve karşılaştırılacak süzgeç budur */
export function pruneFilter(g, fields) {
    const rules = g.rules
        .map((r) => (isGroup(r) ? pruneFilter(r, fields) : r))
        .filter((r) => (isGroup(r) ? r.rules.length > 0 : ruleComplete(r, fields)));
    return { join: g.join, rules };
}
/**
 * Kayıtlı görünümden ne değişti: süzgeç · sütunlar · sıralama · gruplama · yoğunluk · arama (sütun genişliği sayılmaz).
 * fields verilirse yarım kalmış (değeri girilmemiş) koşul değişiklik sayılmaz.
 */
export function viewChanges(saved, cur, fields) {
    const out = [];
    const f = (g) => stable(fields ? pruneFilter(g, fields) : g);
    if (f(saved.filter) !== f(cur.filter))
        out.push("süzgeç");
    if (stable(colKey(saved.columns)) !== stable(colKey(cur.columns)))
        out.push("sütunlar");
    if (stable(saved.sort) !== stable(cur.sort))
        out.push("sıralama");
    if ((saved.group ?? null) !== (cur.group ?? null))
        out.push("gruplama");
    if ((saved.density ?? "comfortable") !== (cur.density ?? "comfortable"))
        out.push("yoğunluk");
    if ((saved.q ?? "") !== (cur.q ?? ""))
        out.push("arama");
    return out;
}
export const viewDirty = (saved, cur, fields) => viewChanges(saved, cur, fields).length > 0;
/** Süzgeçte kişisel veri değeri var mı — varsa görünüm paylaşılamaz (KVKK) */
export function viewHasPersonal(state, fields) {
    const walk = (g) => g.rules.some((r) => (isGroup(r) ? walk(r) : !!fields.find((f) => f.key === r.field)?.personal && !blank(r.value)));
    return walk(state.filter) || (!!state.q && fields.some((f) => f.personal));
}
/** "Benim görünümlerim" için tarayıcı deposu (cihaza özel). Paylaşılan ve sistem görünümleri sunucudan gelir. */
export function localViewStore(key) {
    const k = `bz-views:${key}`;
    const read = () => { try {
        return JSON.parse(localStorage.getItem(k) ?? "") ?? { views: [], def: null };
    }
    catch {
        return { views: [], def: null };
    } };
    const write = (d) => { try {
        localStorage.setItem(k, JSON.stringify(d));
    }
    catch { /* özel pencere / dolu depo: görünüm yalnız bu oturumda kalır */ } };
    return {
        list: () => read().views,
        save(v) { const d = read(); d.views = [...d.views.filter((x) => x.id !== v.id), { ...v, scope: "mine" }]; write(d); },
        remove(id) { const d = read(); d.views = d.views.filter((x) => x.id !== id); if (d.def === id)
            d.def = null; write(d); },
        getDefault: () => read().def,
        setDefault(id) { const d = read(); d.def = id; write(d); },
    };
}
// ───────── Sütun seçici (DOM) ─────────
/** AG Grid: api.applyColumnState({ state: toAgColumnState(cols), applyOrder: true }) */
export const toAgColumnState = (cols) => cols.map((c) => ({ colId: c.key, hide: !c.visible, pinned: c.pinned ?? null, ...(c.width ? { width: c.width } : {}) }));
export const fromAgColumnState = (state, labels = {}) => state.map((s) => ({ key: s.colId, label: labels[s.colId], visible: !s.hide, pinned: s.pinned === true ? "left" : (s.pinned || null), ...(s.width ? { width: s.width } : {}) }));
/**
 * Sütun seçici: göster / gizle, sırala (sürükle, ↑↓ düğmeleri ya da Alt+↑↓), sola sabitle, ara, varsayılana dön.
 * Sabit sütunlar listenin başında toplanır. En az bir sütun görünür kalır.
 */
export function bizmoColumnChooser(host, o) {
    let cols = clone(o.columns);
    let q = "";
    const emit = () => o.onChange?.(clone(cols));
    const order = () => { cols = [...cols.filter((c) => c.pinned === "left"), ...cols.filter((c) => c.pinned !== "left")]; };
    const label = (c) => c.label ?? c.key;
    function render(focusKey, focusRole) {
        const visible = cols.filter((c) => c.visible).length;
        const shown = cols.filter((c) => !q || label(c).toLocaleLowerCase("tr-TR").includes(q));
        host.innerHTML = `<div class="bz-colpick">
      <label class="bz-search bz-colpick__search">${I_SEARCH}<input type="search" placeholder="Sütun ara" aria-label="Sütun ara" value="${esc(q)}" /></label>
      <div class="bz-colpick__meta"><span>${visible} / ${cols.length} sütun görünür</span>${visible < cols.length ? '<button type="button" class="bz-colpick__link" data-role="all">Tümünü göster</button>' : ""}</div>
      <ol class="bz-colpick__list" aria-label="Sütunlar · sıralamak için sürükleyin ya da Alt+↑↓">
        ${shown.map((c) => {
            const i = cols.indexOf(c), last = i === cols.length - 1, lastVisible = c.visible && visible === 1;
            return `<li class="bz-colpick__item" data-key="${esc(c.key)}" draggable="${!q}"${c.pinned === "left" ? ' data-pinned="left"' : ""}>
            <span class="bz-colpick__grip" aria-hidden="true"></span>
            <label class="bz-check"><input type="checkbox" data-role="toggle"${c.visible ? " checked" : ""}${lastVisible ? ' disabled title="En az bir sütun görünür kalır"' : ""} />${esc(label(c))}</label>
            <span class="bz-colpick__actions">
              <button type="button" class="bz-icon-btn bz-icon-btn--sm" data-role="pin" aria-pressed="${c.pinned === "left"}" aria-label="${c.pinned === "left" ? "Sabitlemeyi kaldır" : "Sola sabitle"}: ${esc(label(c))}">${I_PIN}</button>
              <button type="button" class="bz-icon-btn bz-icon-btn--sm" data-role="up" aria-label="Yukarı taşı: ${esc(label(c))}"${i === 0 || q ? " disabled" : ""}>${I_UP}</button>
              <button type="button" class="bz-icon-btn bz-icon-btn--sm" data-role="down" aria-label="Aşağı taşı: ${esc(label(c))}"${last || q ? " disabled" : ""}>${I_DOWN}</button>
            </span>
          </li>`;
        }).join("") || '<li class="bz-colpick__none">Eşleşen sütun yok</li>'}
      </ol>
      ${o.defaults ? '<div class="bz-colpick__foot"><button type="button" class="bz-btn bz-btn--sm" data-role="reset">Varsayılana dön</button></div>' : ""}
    </div>`;
        if (focusKey)
            host.querySelector(`[data-key="${CSS.escape(focusKey)}"] [data-role="${focusRole ?? "toggle"}"]:not(:disabled)`)?.focus()
                ?? host.querySelector(`[data-key="${CSS.escape(focusKey)}"] [data-role="toggle"]`)?.focus();
    }
    const move = (key, d) => {
        const i = cols.findIndex((c) => c.key === key), j = i + d;
        if (j < 0 || j >= cols.length || (cols[i].pinned === "left") !== (cols[j].pinned === "left"))
            return false;
        [cols[i], cols[j]] = [cols[j], cols[i]];
        return true;
    };
    host.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-role]");
        if (!b)
            return;
        const key = b.closest("[data-key]")?.dataset.key ?? "";
        const c = cols.find((x) => x.key === key);
        switch (b.dataset.role) {
            case "all":
                cols.forEach((x) => (x.visible = true));
                break;
            case "reset":
                cols = clone(o.defaults);
                break;
            case "pin":
                if (c) {
                    c.pinned = c.pinned === "left" ? null : "left";
                    order();
                }
                break;
            case "up":
                move(key, -1);
                break;
            case "down":
                move(key, 1);
                break;
            default: return;
        }
        render(key || undefined, b.dataset.role);
        emit();
    });
    host.addEventListener("change", (e) => {
        const el = e.target;
        if (el.dataset.role !== "toggle")
            return;
        const key = el.closest("[data-key]").dataset.key;
        cols.find((c) => c.key === key).visible = el.checked;
        render(key);
        emit();
    });
    host.addEventListener("input", (e) => {
        const el = e.target;
        if (el.type !== "search")
            return;
        q = el.value.trim().toLocaleLowerCase("tr-TR");
        render();
        const s = host.querySelector('input[type="search"]');
        s.focus();
        s.setSelectionRange(s.value.length, s.value.length);
    });
    host.addEventListener("keydown", (e) => {
        if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown"))
            return;
        const key = e.target.closest("[data-key]")?.dataset.key;
        if (!key || q)
            return;
        e.preventDefault();
        if (move(key, e.key === "ArrowUp" ? -1 : 1)) {
            render(key, e.target.dataset.role);
            emit();
        }
    });
    // Sürükle-bırak (fare); klavye ve dokunmatik için düğmeler
    let drag = null;
    host.addEventListener("dragstart", (e) => {
        const li = e.target.closest("[data-key]");
        if (!li)
            return;
        drag = li.dataset.key;
        li.dataset.dragging = "true";
        e.dataTransfer?.setData("text/plain", drag);
        if (e.dataTransfer)
            e.dataTransfer.effectAllowed = "move";
    });
    host.addEventListener("dragover", (e) => {
        const li = e.target.closest("[data-key]");
        if (!drag || !li || li.dataset.key === drag)
            return;
        e.preventDefault();
        host.querySelectorAll("[data-drop]").forEach((x) => x.removeAttribute("data-drop"));
        const r = li.getBoundingClientRect();
        li.dataset.drop = e.clientY < r.top + r.height / 2 ? "before" : "after";
    });
    host.addEventListener("drop", (e) => {
        const li = e.target.closest("[data-key]");
        if (!drag || !li)
            return;
        e.preventDefault();
        const from = cols.findIndex((c) => c.key === drag), item = cols[from];
        const target = cols.find((c) => c.key === li.dataset.key);
        if ((item.pinned === "left") !== (target.pinned === "left"))
            item.pinned = target.pinned ?? null;
        cols.splice(from, 1);
        const to = cols.indexOf(target) + (li.dataset.drop === "after" ? 1 : 0);
        cols.splice(to, 0, item);
        drag = null;
        render(item.key);
        emit();
    });
    host.addEventListener("dragend", () => { drag = null; host.querySelectorAll("[data-drop], [data-dragging]").forEach((x) => { x.removeAttribute("data-drop"); x.removeAttribute("data-dragging"); }); });
    order();
    render();
    return { get: () => clone(cols), set: (c) => { cols = clone(c); order(); render(); }, destroy: () => (host.innerHTML = "") };
}
const cellValue = (row, c) => (c.get ? c.get(row) : row?.[c.key]);
/** Hücreyi dışa aktarılacak değere çevirir: enum → görünen ad, kişisel → maskeli (mask açıkken) */
function exportValue(row, c, mask) {
    const v = cellValue(row, c);
    if (blank(v))
        return null;
    if (c.personal && mask)
        return bizmoMask(String(v), c.personal);
    if ((c.type ?? "text") === "enum")
        return c.options?.[String(v)] ?? String(v);
    return v;
}
/** Formül enjeksiyonu: =, +, -, @, sekme, satır başı ile başlayan METİN hücresi tek tırnakla etkisizleşir (OWASP) */
const defuse = (s) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
/**
 * CSV (Türkçe Excel uyumlu varsayılan: ";" ayraç, ondalık virgül, UTF-8 BOM, tarih GG.AA.YYYY).
 * Kişisel sütunlar varsayılan maskeli (mask: false yalnız yetkili ve kayıtlı aktarımda).
 */
export function toCsv(rows, cols, o = {}) {
    const sep = o.sep ?? ";", dec = o.decimal ?? (sep === "," ? "." : ","), mask = o.mask ?? true;
    const q = (s) => (s.includes(sep) || /["\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const fmt = (v, c) => {
        if (v === null)
            return "";
        const t = c.type ?? "text";
        if ((t === "number" || t === "money") && typeof v === "number" && !(c.personal && mask))
            return String(v).replace(".", dec);
        if (t === "date" && !(c.personal && mask)) {
            const d = toDay(v);
            if (d) {
                const [y, m, dd] = d.split("-");
                return `${dd}.${m}.${y}`;
            }
        }
        if (t === "bool")
            return v ? "Evet" : "Hayır";
        return defuse(String(v));
    };
    const lines = [cols.map((c) => q(defuse(c.label))).join(sep), ...rows.map((r) => cols.map((c) => q(fmt(exportValue(r, c, mask), c))).join(sep))];
    return (o.bom === false ? "" : "﻿") + lines.join("\r\n") + "\r\n";
}
// CRC-32 (ZIP)
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++)
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
} return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++)
    c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
/** Sıkıştırmasız (store) ZIP — XLSX için yeterli ve her Excel / LibreOffice / Numbers açar */
function zipStore(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const f of files) {
        const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true);
        local.setUint16(8, 0, true);
        local.setUint16(10, dosTime, true);
        local.setUint16(12, dosDate, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);
        parts.push(new Uint8Array(local.buffer), name, f.data);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true);
        c.setUint16(4, 20, true);
        c.setUint16(6, 20, true);
        c.setUint16(8, 0x0800, true);
        c.setUint16(10, 0, true);
        c.setUint16(12, dosTime, true);
        c.setUint16(14, dosDate, true);
        c.setUint32(16, crc, true);
        c.setUint32(20, size, true);
        c.setUint32(24, size, true);
        c.setUint16(28, name.length, true);
        c.setUint32(42, offset, true);
        central.push(new Uint8Array(c.buffer), name);
        offset += 30 + name.length + size;
    }
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
    let p = 0;
    for (const a of all) {
        out.set(a, p);
        p += a.length;
    }
    return out;
}
const xml = (s) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const colName = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26))
    s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const excelSerial = (d) => { const [y, m, dd] = d.split("-").map(Number); return (Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 86_400_000; };
/**
 * XLSX (Office Open XML) — bağımlılıksız: kalın ve sabit başlık satırı, otomatik süzgeç, sütun genişliği,
 * sayı / tutar sayı hücresi (#,##0.00), tarih gerçek tarih hücresi (GG.AA.YYYY). Kişisel sütunlar varsayılan maskeli.
 */
export function toXlsx(rows, cols, o = {}) {
    const mask = o.mask ?? true, enc = new TextEncoder();
    const sheet = (o.sheet ?? "Liste").replace(/[\[\]:*?/\\]/g, " ").slice(0, 31) || "Liste";
    const widths = cols.map((c) => Math.min(60, Math.max(8, c.label.length + 2)));
    const cell = (v, c, r, i) => {
        const ref = `${colName(i)}${r}`, t = c.type ?? "text";
        if (v === null)
            return "";
        const str = (s) => { widths[i] = Math.min(60, Math.max(widths[i], s.length + 2)); return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(s)}</t></is></c>`; };
        if (c.personal && mask)
            return str(String(v));
        if ((t === "number" || t === "money") && typeof v === "number" && Number.isFinite(v))
            return `<c r="${ref}" s="${t === "money" ? 3 : 4}"><v>${v}</v></c>`;
        if (t === "date") {
            const d = toDay(v);
            if (d) {
                widths[i] = Math.max(widths[i], 12);
                return `<c r="${ref}" s="2"><v>${excelSerial(d)}</v></c>`;
            }
        }
        if (t === "bool")
            return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
        return str(String(v));
    };
    const head = `<row r="1">${cols.map((c, i) => `<c r="${colName(i)}1" t="inlineStr" s="1"><is><t>${xml(c.label)}</t></is></c>`).join("")}</row>`;
    const body = rows.map((row, ri) => `<row r="${ri + 2}">${cols.map((c, i) => cell(exportValue(row, c, mask), c, ri + 2, i)).join("")}</row>`).join("");
    const last = `${colName(Math.max(0, cols.length - 1))}${rows.length + 1}`;
    const files = [
        ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`],
        ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
        ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(sheet)}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${xml(sheet).replace(/'/g, "''")}'!$A$1:$${colName(Math.max(0, cols.length - 1))}$${rows.length + 1}</definedName></definedNames></workbook>`],
        ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
        ["xl/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F4"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF18232F"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`],
        ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${head}${body}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`],
    ];
    return zipStore(files.map(([name, s]) => ({ name, data: enc.encode(s) })));
}
/** Tarayıcıda dosya indirir (bağlantı tıklaması, URL hemen bırakılır) */
export function bizmoDownload(data, filename, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type ?? (filename.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : filename.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/octet-stream") });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename, rel: "noopener" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/** "siparisler-2026-10-11.xlsx": Türkçe karakterler sadeleşir, tarih eklenir */
export function exportFileName(base, ext, at = new Date()) {
    const slug = base.toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "liste";
    return `${slug}-${ymd(at)}.${ext}`;
}
/** Dışa aktarma denetim olayı — yalnız metadata: kim ve ne zaman sunucuda eklenir; değer, satır içeriği, IP yok */
export function exportAudit(o) {
    return {
        action: "export", list: o.list, format: o.format, scope: o.scope, rows: o.rows, columns: o.columns.length,
        personalColumns: o.columns.filter((c) => c.personal).map((c) => c.label), masked: o.masked,
        filter: o.filter ?? "", classification: o.classification ?? "internal", at: new Date().toISOString(),
    };
}
// ───────── İçe aktarma ─────────
/** Dosya baytlarını metne çevirir: UTF-8 (BOM'lu / BOM'suz); geçersizse Türkçe Excel'in varsayılanı Windows-1254 */
export function decodeText(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(b);
    }
    catch {
        return new TextDecoder("windows-1254").decode(b);
    }
}
/** RFC 4180 CSV: tırnaklı alan, kaçırılmış tırnak, satır içi satır sonu, BOM; ayraç (; , sekme) ilk satırdan sezilir */
export function parseCsv(text, o = {}) {
    const s = text.replace(/^﻿/, "");
    // Ayraç: ilk satırda tırnak dışında en sık geçen (; , sekme); hiçbiri yoksa ";"
    const count = (c) => { let n = 0, q = false; for (const ch of s) {
        if (ch === '"')
            q = !q;
        else if (!q && (ch === "\n" || ch === "\r"))
            break;
        else if (!q && ch === c)
            n++;
    } return n; };
    const sep = o.sep ?? ([";", ",", "\t"].map((c) => [c, count(c)]).sort((a, b) => b[1] - a[1]).find(([, n]) => n > 0)?.[0] ?? ";");
    const out = [];
    let row = [], cur = "", quoted = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (quoted) {
            if (ch === '"') {
                if (s[i + 1] === '"') {
                    cur += '"';
                    i++;
                }
                else
                    quoted = false;
            }
            else
                cur += ch;
        }
        else if (ch === '"' && cur === "")
            quoted = true;
        else if (ch === sep) {
            row.push(cur);
            cur = "";
        }
        else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && s[i + 1] === "\n")
                i++;
            row.push(cur);
            out.push(row);
            row = [];
            cur = "";
        }
        else
            cur += ch;
    }
    if (cur !== "" || row.length) {
        row.push(cur);
        out.push(row);
    }
    const rows = out.filter((r) => r.some((c) => c.trim() !== ""));
    return { sep, headers: (rows.shift() ?? []).map((h) => h.trim()), rows };
}
/** "1.234,56" · "1234,56" · "1,234.56" · "₺ 12.500" · "%12,5" → sayı; anlaşılmazsa NaN */
export function parseNumberTr(input) {
    let s = String(input ?? "").trim().replace(/[₺$€%\s ]|TL|TRY/gi, "");
    if (!s)
        return NaN;
    const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
    s = s.replace(/^[(-]|\)$/g, "");
    const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
    if (lastDot >= 0 && lastComma >= 0)
        s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
    else if (lastComma >= 0)
        s = /^\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
    else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s))
        s = s.replace(/\./g, "");
    if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.?$/.test(s))
        return NaN;
    const n = Number(s);
    return neg ? -n : n;
}
/** "31.12.2026" · "31/12/2026" · "31-12-2026" · "2026-12-31" · "31.12.26" → "2026-12-31"; geçersiz (30.02) → null */
export function parseDateTr(input) {
    const s = String(input ?? "").trim();
    let y, m, d;
    let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
    if (r)
        [y, m, d] = [+r[1], +r[2], +r[3]];
    else if ((r = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})(?:\s.*)?$/)))
        [d, m, y] = [+r[1], +r[2], r[3].length === 2 ? 2000 + +r[3] : +r[3]];
    else
        return null;
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? ymd(dt) : null;
}
// XLSX okuma: ZIP (store / deflate — tarayıcının DecompressionStream'i) + XML (düzenli ifade; makine üretimi dosya)
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
async function inflateRaw(data) {
    const ds = new DecompressionStream("deflate-raw");
    const out = new Response(new Blob([data]).stream().pipeThrough(ds));
    return new Uint8Array(await out.arrayBuffer());
}
async function unzip(buf, wanted) {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--)
        if (u32(buf, i) === 0x06054b50) {
            eocd = i;
            break;
        }
    if (eocd < 0)
        throw new Error("Dosya XLSX değil (ZIP sonu bulunamadı)");
    const count = u16(buf, eocd + 10);
    let p = u32(buf, eocd + 16);
    const dec = new TextDecoder(), out = new Map();
    for (let k = 0; k < count; k++) {
        if (u32(buf, p) !== 0x02014b50)
            throw new Error("Bozuk XLSX (merkezi dizin)");
        const method = u16(buf, p + 10), csize = u32(buf, p + 20), nlen = u16(buf, p + 28), xlen = u16(buf, p + 30), clen = u16(buf, p + 32), lho = u32(buf, p + 42);
        const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
        p += 46 + nlen + xlen + clen;
        if (!wanted(name))
            continue;
        const start = lho + 30 + u16(buf, lho + 26) + u16(buf, lho + 28);
        const raw = buf.subarray(start, start + csize);
        if (method !== 0 && method !== 8)
            throw new Error(`Desteklenmeyen sıkıştırma (${method})`);
        out.set(name, dec.decode(method === 0 ? raw : await inflateRaw(raw)));
    }
    return out;
}
const unxml = (s) => s
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[e.toLowerCase()]);
const texts = (s) => [...s.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unxml(m[1])).join("");
const colIndex = (ref) => { const l = ref.replace(/\d+/g, ""); let n = 0; for (const ch of l)
    n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
/** XLSX'in ilk sayfasını okur: başlık satırı + satırlar (metin). Tarih biçimli hücre "YYYY-AA-GG" döner. */
export async function readXlsx(data) {
    const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    const files = await unzip(buf, (n) => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/sheet\d+\.xml)$/.test(n));
    const wb = files.get("xl/workbook.xml") ?? "";
    const first = wb.match(/<sheet\s[^>]*name="([^"]*)"[^>]*r:id="([^"]+)"/) ?? wb.match(/<sheet\s[^>]*r:id="([^"]+)"[^>]*name="([^"]*)"/);
    const sheetName = first ? unxml(first[0].match(/name="([^"]*)"/)[1]) : "Sayfa1";
    const rid = first?.[0].match(/r:id="([^"]+)"/)?.[1];
    const rel = rid ? (files.get("xl/_rels/workbook.xml.rels") ?? "").match(new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1] ?? (files.get("xl/_rels/workbook.xml.rels") ?? "").match(new RegExp(`<Relationship[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1] : null;
    const path = rel ? (rel.startsWith("/") ? rel.slice(1) : `xl/${rel.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
    const sheet = files.get(path) ?? files.get("xl/worksheets/sheet1.xml");
    if (!sheet)
        throw new Error("XLSX'te sayfa bulunamadı");
    const shared = [...(files.get("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
    // Tarih biçimleri: yerleşik 14–22, 45–47 ya da d / m / y içeren özel biçim
    const styles = files.get("xl/styles.xml") ?? "";
    const custom = new Map([...styles.matchAll(/<numFmt\s[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)].map((m) => [+m[1], unxml(m[2])]));
    const xfs = (styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "").match(/<xf\s[^>]*?\/?>/g) ?? [];
    const dateStyle = xfs.map((x) => {
        const id = +(x.match(/numFmtId="(\d+)"/)?.[1] ?? 0);
        const code = custom.get(id)?.replace(/"[^"]*"|\[[^\]]*\]/g, "") ?? "";
        return (id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dmy]/i.test(code) && !/^[#0.,\s%]+$/.test(code);
    });
    const rows = [];
    for (const rm of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const row = [];
        for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
            const attrs = cm[1], inner = cm[2] ?? "";
            const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1];
            const t = attrs.match(/\bt="(\w+)"/)?.[1], s = +(attrs.match(/\bs="(\d+)"/)?.[1] ?? 0);
            const v = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
            let val = "";
            if (t === "s")
                val = shared[+(v ?? 0)] ?? "";
            else if (t === "inlineStr")
                val = texts(inner);
            else if (t === "b")
                val = v === "1" ? "Evet" : "Hayır";
            else if (v !== undefined) {
                val = unxml(v);
                if (t !== "str" && t !== "e" && dateStyle[s] && /^\d+(\.\d+)?$/.test(val)) {
                    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(+val * 86_400_000));
                    val = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
                }
            }
            const i = ref ? colIndex(ref) : row.length;
            while (row.length < i)
                row.push("");
            row[i] = val;
        }
        if (row.some((c) => c.trim() !== ""))
            rows.push(row);
    }
    const headers = (rows.shift() ?? []).map((h) => h.trim());
    return { sheet: sheetName, headers, rows: rows.map((r) => headers.map((_, i) => r[i] ?? "")) };
}
const fold = (s) => s.toLocaleLowerCase("tr-TR").replace(/[çğıöşüâîû]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" })[c]).replace(/[^a-z0-9]/g, "");
/** Dosya sütunlarını alanlarla eşler: önce ad / anahtar / takma ad tam eşleşmesi (Türkçe karakter ve boşluk duyarsız), sonra tek anlamlı kısmi eşleşme */
export function autoMap(headers, fields) {
    const used = new Set(), map = headers.map(() => null);
    const names = fields.map((f) => ({ f, keys: [f.label, f.key, ...(f.aliases ?? [])].map(fold).filter(Boolean) }));
    headers.forEach((h, i) => {
        const n = fold(h), hit = names.find((x) => !used.has(x.f.key) && x.keys.includes(n));
        if (hit) {
            map[i] = hit.f.key;
            used.add(hit.f.key);
        }
    });
    headers.forEach((h, i) => {
        if (map[i])
            return;
        const n = fold(h);
        if (n.length < 3)
            return;
        const hits = names.filter((x) => !used.has(x.f.key) && x.keys.some((k) => k.length >= 3 && (k.includes(n) || n.includes(k))));
        if (hits.length === 1) {
            map[i] = hits[0].f.key;
            used.add(hits[0].f.key);
        }
    });
    return map;
}
const BOOL = { evet: true, e: true, true: true, "1": true, x: true, var: true, hayir: false, h: false, false: false, "0": false, yok: false };
/**
 * Satırları doğrular ve türe çevirir (deneme çalıştırması: hiçbir şey yazılmaz). Satır numarası dosyadaki numaradır
 * (başlık 1. satır). key verilirse o alan var olan kayıtla eşleşince "güncelle", yoksa "yeni"; hatalı satır "atla".
 */
export function validateImport(rows, mapping, fields, o = {}) {
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const missing = fields.filter((f) => f.required && !mapping.includes(f.key)).map((f) => f.label);
    const seen = new Map();
    const out = rows.map((cells, ri) => {
        const row = ri + 2, values = {}, issues = [];
        const err = (f, message, level = "error") => issues.push({ row, field: f.key, level, message });
        mapping.forEach((key, ci) => {
            const f = key ? byKey.get(key) : undefined;
            if (!f)
                return;
            const raw = (cells[ci] ?? "").trim();
            if (!raw) {
                if (f.required)
                    err(f, `${f.label}: zorunlu alan boş`);
                values[f.key] = null;
                return;
            }
            const t = f.type ?? "text";
            let v = raw;
            if (t === "number" || t === "money") {
                const n = parseNumberTr(raw);
                if (Number.isNaN(n)) {
                    err(f, `${f.label}: sayı anlaşılmadı ("${raw}")`);
                    return;
                }
                if (f.min !== undefined && n < f.min)
                    err(f, `${f.label}: en az ${f.min} olmalı (${raw})`);
                if (f.max !== undefined && n > f.max)
                    err(f, `${f.label}: en çok ${f.max} olabilir (${raw})`);
                v = n;
            }
            else if (t === "date") {
                const d = parseDateTr(raw);
                if (!d) {
                    err(f, `${f.label}: tarih anlaşılmadı ("${raw}" · GG.AA.YYYY)`);
                    return;
                }
                v = d;
            }
            else if (t === "enum") {
                const opt = Object.entries(f.options ?? {}).find(([k, l]) => fold(k) === fold(raw) || fold(l) === fold(raw));
                if (!opt) {
                    err(f, `${f.label}: "${raw}" geçerli değil · beklenen: ${Object.values(f.options ?? {}).join(", ")}`);
                    return;
                }
                v = opt[0];
            }
            else if (t === "bool") {
                const b = BOOL[fold(raw)];
                if (b === undefined) {
                    err(f, `${f.label}: evet / hayır bekleniyor ("${raw}")`);
                    return;
                }
                v = b;
            }
            else {
                if (f.maxLength && raw.length > f.maxLength)
                    err(f, `${f.label}: en çok ${f.maxLength} karakter (${raw.length})`);
                if (f.pattern && !f.pattern.test(raw))
                    err(f, `${f.label}: biçim uygun değil ("${raw}")`);
                if (f.personal === "tckn" && !isValidTckn(raw))
                    err(f, `${f.label}: TC kimlik no doğrulanmadı`);
                if (f.personal === "iban" && !isValidIban(raw))
                    err(f, `${f.label}: IBAN doğrulanmadı`);
            }
            if (f.unique) {
                const m = seen.get(f.key) ?? new Map();
                seen.set(f.key, m);
                const k = fold(String(v)), prev = m.get(k);
                if (prev)
                    err(f, `${f.label}: dosyada tekrar (satır ${prev} ile aynı)`);
                else
                    m.set(k, row);
            }
            values[f.key] = v;
        });
        const hasError = issues.some((i) => i.level === "error");
        const action = hasError ? "skip" : o.key && values[o.key] != null && o.exists?.(String(values[o.key])) ? "update" : "create";
        return { row, values, issues, action };
    });
    const summary = { total: out.length, create: out.filter((r) => r.action === "create").length, update: out.filter((r) => r.action === "update").length, error: out.filter((r) => r.action === "skip").length, warning: out.filter((r) => r.action !== "skip" && r.issues.length).length };
    return { rows: out, missing, summary };
}
