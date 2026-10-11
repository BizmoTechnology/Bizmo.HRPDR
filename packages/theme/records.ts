/**
 * Bizmo Universal Theme · kayıt sayfası yardımcıları (çerçeveden bağımsız; fark hesabı DOM'suz, sunucuda / Node'da da çalışır)
 *
 *   diffRecord(önceki, sonraki, şema, { lines })   → FieldChange[]  alan düzeyinde; kalem eklendi / silindi / değişti
 *   diffWords(a, b)                              → [{ t, op }]     uzun metinde sözcük farkı
 *   formatFieldValue(v, tanım)                   → "₺12.500,00" · "11.10.2026" · "Evet" · "40 adet"
 *   filterChangeSets(kümeler, { field, actor, source, q })
 *   bizmoHistoryHtml(kümeler)                    → Geçmiş sekmesi: kim · ne zaman · nereden · gerekçe · alan · eski → yeni
 *   bizmoActivityHtml(olaylar)                   → etkinlik akışı: yorum, değişiklik, durum, belge, sistem olayı (gün başlıklı)
 *   bizmoCopy(düğme, değer)                      → kayıt numarasını kopyalar, "Kopyalandı" duyurur
 *   recordCardHtml(kayıt, { variant }) · bizmoRecordCards(kök)   sohbette / panelde kayıt durum kartı (.bz-record-card)
 *
 * Kurallar (DESIGN.md §41): şema beyaz listedir — şemada olmayan alan geçmişe girmez. Kişisel veri alanı (`mask`) geçmişte
 * maskeli tutulur, `audit: "meta"` alanda değer hiç yazılmaz, yalnız "değişti" — ham kişisel veri `FieldChange`'e girmez.
 * Kim bilgisi kullanıcı kimliği + rol; ad yalnız uygulama içinde, yetkili kişiye gösterilir. Tüm metin kaçırılır (XSS).
 */
import { bizmoMask, type MaskKind } from "./privacy.js";

export type FieldKind = "text" | "longtext" | "number" | "money" | "percent" | "date" | "datetime" | "bool" | "enum" | "ref";
/** value: biçimli değer · masked: maskeli değer · meta: değer yok, yalnız "değişti" */
export type AuditMode = "value" | "masked" | "meta";

export interface FieldDef {
  label: string;
  kind?: FieldKind;
  /** enum: değer → görünen ad */
  options?: Record<string, string>;
  unit?: string;
  currency?: string;
  digits?: number;
  /** kişisel veri türü: geçmişte maskelenir (privacy.ts bizmoMask) */
  mask?: MaskKind;
  audit?: AuditMode;
}
export type RecordSchema = Record<string, FieldDef>;

export interface FieldChange {
  /** "dueDate" ya da kalemde "lines[L2].qty" */
  path: string;
  field: string;
  label: string;
  kind: FieldKind;
  op: "change" | "add" | "remove";
  audit: AuditMode;
  /** görünen metin: value → biçimli · masked → maskeli · meta → "" */
  from: string;
  to: string;
  /** yalnız audit "value" iken ham değer; maskeli / meta alanda hiç yok */
  raw?: { from: unknown; to: unknown };
  /** kalem değişikliğinde: "Kalem 2 · FL-120" */
  scope?: string;
}

export interface LineSpec<T = any> {
  /** kayıttaki dizi alanı: "lines" */
  key: string;
  /** kalıcı kalem kimliği (sıra numarası değil — sıralama değişince yanlış fark çıkar) */
  id: (row: T) => string;
  label: (row: T, index: number) => string;
  schema: RecordSchema;
  /** eklenen / silinen kalemin özeti: "FL-120 Flanş Ø120 · 20 adet" */
  summary?: (row: T) => string;
}

export interface Actor { id: string; role?: string; name?: string }
export type ChangeSource = "ui" | "api" | "import" | "mobile" | "system" | "integration";
export interface ChangeSet { id: string; at: number | string | Date; actor: Actor; source?: ChangeSource; reason?: string; changes: FieldChange[] }

export const SOURCE_LABEL: Record<ChangeSource, string> = { ui: "Ekran", api: "API", import: "İçe aktarma", mobile: "El terminali", system: "Sistem", integration: "Entegrasyon" };

// ───────── Biçimleme ─────────

const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const empty = (v: unknown) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const toDate = (v: unknown) => (v instanceof Date ? v : new Date(v as string | number));
const pad = (n: number) => String(n).padStart(2, "0");
const dmy = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Alan değerini tr-TR biçiminde metne çevirir; boş değer "" döner (ekranda "boş" yazılır) */
export function formatFieldValue(v: unknown, def: Pick<FieldDef, "kind" | "options" | "unit" | "currency" | "digits"> = {}): string {
  if (empty(v)) return "";
  switch (def.kind ?? "text") {
    case "bool": return v ? "Evet" : "Hayır";
    case "enum": return def.options?.[String(v)] ?? String(v);
    case "money": return new Intl.NumberFormat("tr-TR", { style: "currency", currency: def.currency ?? "TRY", minimumFractionDigits: def.digits ?? 2, maximumFractionDigits: def.digits ?? 2 }).format(Number(v));
    case "percent": return `%${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: def.digits ?? 1 }).format(Number(v))}`;
    case "number": return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: def.digits ?? 3 }).format(Number(v)) + (def.unit ? ` ${def.unit}` : "");
    case "date": { const d = toDate(v); return Number.isNaN(+d) ? String(v) : dmy(d); }
    case "datetime": { const d = toDate(v); return Number.isNaN(+d) ? String(v) : `${dmy(d)} ${hm(d)}`; }
    case "ref": return typeof v === "object" && v && "label" in v ? String((v as { label: unknown }).label) : String(v);
    default: return String(v);
  }
}

// ───────── Fark ─────────

const norm = (v: unknown, kind: FieldKind): unknown => {
  if (empty(v)) return null;
  if (kind === "date") { const d = toDate(v); return Number.isNaN(+d) ? v : dmy(d); }
  if (kind === "datetime") { const d = toDate(v); return Number.isNaN(+d) ? v : +d; }
  if (kind === "number" || kind === "money" || kind === "percent") { const n = Number(v); return Number.isNaN(n) ? v : n; }
  if (kind === "ref" && typeof v === "object" && v && "id" in v) return (v as { id: unknown }).id;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
};

function fieldChange(path: string, field: string, def: FieldDef, a: unknown, b: unknown, scope?: string): FieldChange | null {
  const kind = def.kind ?? "text";
  if (norm(a, kind) === norm(b, kind)) return null;
  const audit: AuditMode = def.audit ?? (def.mask ? "masked" : "value");
  const shown = (v: unknown) => (audit === "meta" ? "" : audit === "masked" ? (empty(v) ? "" : bizmoMask(String(v), def.mask ?? "text")) : formatFieldValue(v, def));
  const c: FieldChange = { path, field, label: def.label, kind, op: "change", audit, from: shown(a), to: shown(b) };
  if (audit === "value") c.raw = { from: a ?? null, to: b ?? null };
  if (scope) c.scope = scope;
  return c;
}

/**
 * İki kayıt sürümü arasındaki alan düzeyindeki farklar. Yalnız şemadaki alanlar karşılaştırılır (beyaz liste);
 * kalemler kalıcı kimlikle eşlenir: eklendi / silindi / alanı değişti.
 */
export function diffRecord<T extends Record<string, any>>(prev: T | null | undefined, next: T, schema: RecordSchema, opts: { lines?: LineSpec[] } = {}): FieldChange[] {
  const a = prev ?? ({} as T);
  const out: FieldChange[] = [];
  for (const [key, def] of Object.entries(schema)) {
    const c = fieldChange(key, key, def, a[key], next[key]);
    if (c) out.push(c);
  }
  for (const spec of opts.lines ?? []) {
    const before: any[] = a[spec.key] ?? [], after: any[] = next[spec.key] ?? [];
    const prevById = new Map(before.map((r) => [spec.id(r), r]));
    const nextIds = new Set(after.map((r) => spec.id(r)));
    after.forEach((row, i) => {
      const id = spec.id(row), old = prevById.get(id), scope = spec.label(row, i);
      if (!old) {
        out.push({ path: `${spec.key}[${id}]`, field: spec.key, label: "Kalem", kind: "text", op: "add", audit: "value", from: "", to: spec.summary?.(row) ?? scope, scope });
        return;
      }
      for (const [key, def] of Object.entries(spec.schema)) {
        const c = fieldChange(`${spec.key}[${id}].${key}`, key, def, old[key], row[key], scope);
        if (c) out.push(c);
      }
    });
    before.forEach((row, i) => {
      const id = spec.id(row);
      if (!nextIds.has(id)) out.push({ path: `${spec.key}[${id}]`, field: spec.key, label: "Kalem", kind: "text", op: "remove", audit: "value", from: spec.summary?.(row) ?? spec.label(row, i), to: "", scope: spec.label(row, i) });
    });
  }
  return out;
}

export type WordOp = { t: string; op: "eq" | "del" | "ins" };

/** Sözcük düzeyinde fark (LCS). Çok uzun metinde (≈ 600 × 600 sözcük üstü) tümü sil + tümü ekle olarak döner. */
export function diffWords(a: string, b: string): WordOp[] {
  // Sözcük, boşluk ve noktalama ayrı parça: "adet." → "adet," yalnız noktalamayı işaretler
  const tok = (s: string) => (s ?? "").match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
  const A = tok(a), B = tok(b);
  const merge = (ops: WordOp[]) => ops.reduce<WordOp[]>((acc, o) => {
    const last = acc[acc.length - 1];
    if (last && last.op === o.op) last.t += o.t; else acc.push({ ...o });
    return acc;
  }, []);
  if (A.length * B.length > 360_000) return merge([...A.map((t) => ({ t, op: "del" as const })), ...B.map((t) => ({ t, op: "ins" as const }))]);
  const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops: WordOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ t: A[i], op: "eq" }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) ops.push({ t: A[i++], op: "del" });
    else ops.push({ t: B[j++], op: "ins" });
  }
  while (i < n) ops.push({ t: A[i++], op: "del" });
  while (j < m) ops.push({ t: B[j++], op: "ins" });
  // Yalnız boşluk değişikliği işaretlenmez (HTML'de art arda boşluk teke iner): sözcükler arası boşluk düz kalır
  return merge(ops.map((o) => (o.op !== "eq" && !o.t.trim() ? { ...o, op: "eq" as const } : o)));
}

/** Geçmiş süzgeci: alan (path ya da alan adı), kullanıcı, kaynak, serbest metin (alan adı ve değerlerde) */
export function filterChangeSets(sets: ChangeSet[], f: { field?: string; actor?: string; source?: ChangeSource; q?: string } = {}): ChangeSet[] {
  const q = f.q?.trim().toLocaleLowerCase("tr-TR");
  return sets
    .filter((s) => (!f.actor || s.actor.id === f.actor) && (!f.source || (s.source ?? "ui") === f.source))
    .map((s) => ({
      ...s,
      changes: s.changes.filter((c) => (!f.field || c.field === f.field || c.path === f.field) && (!q || [c.label, c.scope, c.from, c.to].some((x) => x?.toLocaleLowerCase("tr-TR").includes(q)))),
    }))
    .filter((s) => s.changes.length);
}

// ───────── HTML ─────────

const SVG = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  lock: SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  edit: SVG('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
  flag: SVG('<path d="M5 21V4h11l-2 4 2 4H5"/>'),
  cog: SVG('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>'),
  file: SVG('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/>'),
  link: SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
};

const when = (at: ChangeSet["at"]) => toDate(at);
const timeTag = (d: Date, text: string) => `<time datetime="${d.toISOString()}" title="${dmy(d)} ${hm(d)}">${esc(text)}</time>`;

/** "eski → yeni" gösterimi; maskeli alanda maskeli metin, meta alanda yalnız not */
export function changeValuesHtml(c: FieldChange): string {
  if (c.audit === "meta") return `<span class="bz-change__note">${ICON.lock}Değer kaydedilmez · kişisel veri</span>`;
  const val = (t: string, cls: string, tag: "del" | "ins" | "span" = "span") => (t ? `<${tag} class="${cls}">${esc(t)}</${tag}>` : `<span class="bz-change__empty">boş</span>`);
  const masked = c.audit === "masked" ? `<span class="bz-change__note">${ICON.lock}maskeli</span>` : "";
  if (c.op === "add") return `<span class="bz-change__tag" data-op="add">eklendi</span>${val(c.to, "bz-change__new", "ins")}`;
  if (c.op === "remove") return `<span class="bz-change__tag" data-op="remove">silindi</span>${val(c.from, "bz-change__old", "del")}`;
  if (c.kind === "longtext" && c.audit === "value" && c.from && c.to) {
    const parts = diffWords(c.from, c.to).map((o) => (o.op === "eq" ? esc(o.t) : `<${o.op}>${esc(o.t)}</${o.op}>`)).join("");
    return `<span class="bz-change__diff">${parts}</span>`;
  }
  return `<span class="bz-sr-only">eski değer</span>${val(c.from, "bz-change__old", "del")}<span class="bz-change__arrow" aria-hidden="true">→</span><span class="bz-sr-only">yeni değer</span>${val(c.to, "bz-change__new", "ins")}${masked}`;
}

const changeRow = (c: FieldChange) =>
  `<div class="bz-change" data-op="${c.op}" data-audit="${c.audit}"${c.kind === "longtext" ? ' data-kind="longtext"' : ""}><span class="bz-change__field">${esc(c.op === "change" ? c.label : c.scope ?? c.label)}${c.scope && c.op === "change" ? `<small>${esc(c.scope)}</small>` : ""}</span><span class="bz-change__values">${changeValuesHtml(c)}</span></div>`;

const who = (a: Actor) => `<span class="bz-changeset__who">${esc(a.name ?? a.id)}</span>${a.role ? `<span class="bz-changeset__role">${esc(a.name ? `${a.id} · ${a.role}` : a.role)}</span>` : ""}`;

/** Geçmiş sekmesi: her kayıt işlemi bir küme (aynı anda kaydedilen alanlar birlikte); en yeni üstte */
export function bizmoHistoryHtml(sets: ChangeSet[], opts: { empty?: string } = {}): string {
  if (!sets.length) return `<div class="bz-history"><div class="bz-empty"><div class="bz-empty__title">Değişiklik yok</div><div class="bz-empty__text">${esc(opts.empty ?? "Süzgece uyan kayıt bulunamadı.")}</div></div></div>`;
  const rows = [...sets].sort((x, y) => +when(y.at) - +when(x.at)).map((s) => {
    const d = when(s.at), src = s.source ?? "ui";
    return `<article class="bz-changeset" data-source="${src}">
      <header class="bz-changeset__head">${who(s.actor)}<span class="bz-chip bz-chip--sm" data-source="${src}">${esc(SOURCE_LABEL[src])}</span><span class="bz-changeset__count">${s.changes.length} alan</span>${timeTag(d, `${dmy(d)} · ${hm(d)}`).replace("<time", '<time class="bz-changeset__time"')}</header>
      ${s.reason ? `<p class="bz-changeset__reason"><b>Gerekçe:</b> ${esc(s.reason)}</p>` : ""}
      <div class="bz-changeset__body">${s.changes.map(changeRow).join("")}</div>
    </article>`;
  });
  return `<div class="bz-history">${rows.join("")}</div>`;
}

// ───────── Etkinlik akışı ─────────

export type StatusKey = "draft" | "pending" | "progress" | "approved" | "done" | "rejected" | "cancelled" | "blocked";
export type ActivityItem =
  | { kind: "comment"; id: string; at: ChangeSet["at"]; actor: Actor; text: string; own?: boolean }
  | { kind: "change"; id: string; at: ChangeSet["at"]; actor: Actor; changes: FieldChange[]; source?: ChangeSource }
  | { kind: "status"; id: string; at: ChangeSet["at"]; actor: Actor; from: { status: StatusKey; label: string }; to: { status: StatusKey; label: string }; note?: string }
  | { kind: "file"; id: string; at: ChangeSet["at"]; actor: Actor; name: string; meta?: string }
  | { kind: "system"; id: string; at: ChangeSet["at"]; text: string; ref?: string };

const initials = (a: Actor) => (a.name ? a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toLocaleUpperCase("tr-TR") : a.id.replace(/\D/g, "").slice(-2) || a.id.slice(0, 2));
const mention = (t: string) => esc(t).replace(/(^|\s)@([\p{L}\p{N}._-]+)/gu, '$1<span class="bz-mention">@$2</span>').replace(/\n/g, "<br>");
const badge = (s: { status: StatusKey; label: string }) => `<span class="bz-status" data-status="${s.status}">${esc(s.label)}</span>`;

function dayLabel(d: Date, now: Date) {
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86_400_000);
  if (diff === 0) return "Bugün";
  if (diff === 1) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric", weekday: diff < 7 ? "long" : undefined });
}

/** Etkinlik akışı: en yeni üstte, gün başlıklı. filter: yalnız belirli türler (ör. ["comment"]) */
export function bizmoActivityHtml(items: ActivityItem[], opts: { now?: Date; filter?: ActivityItem["kind"][] } = {}): string {
  const now = opts.now ?? new Date();
  const list = items.filter((i) => !opts.filter?.length || opts.filter.includes(i.kind)).sort((x, y) => +when(y.at) - +when(x.at));
  if (!list.length) return `<ol class="bz-activity"><li class="bz-activity__empty">Bu süzgece uyan etkinlik yok.</li></ol>`;
  let lastDay = "";
  const html = list.map((it) => {
    const d = when(it.at), label = dayLabel(d, now);
    const head = label !== lastDay ? `<li class="bz-activity__day">${esc(label)}</li>` : "";
    lastDay = label;
    const t = timeTag(d, hm(d)).replace("<time", '<time class="bz-activity__time"');
    const actor = "actor" in it ? `<span class="bz-activity__who">${esc(it.actor.name ?? it.actor.id)}</span>${it.actor.role ? `<span class="bz-activity__role">${esc(it.actor.role)}</span>` : ""}` : "";
    let mark = "", text = "", body = "";
    switch (it.kind) {
      case "comment":
        mark = `<span class="bz-avatar bz-avatar--sm bz-avatar--round${it.own ? " bz-avatar--accent" : ""}" aria-hidden="true">${esc(initials(it.actor))}</span>`;
        text = "yorum yazdı";
        body = `<div class="bz-activity__body"${it.own ? ' data-own="true"' : ""}>${mention(it.text)}</div>`;
        break;
      case "change":
        mark = `<span class="bz-activity__mark">${ICON.edit}</span>`;
        text = `${it.changes.length} alanı değiştirdi${it.source && it.source !== "ui" ? ` · ${esc(SOURCE_LABEL[it.source])}` : ""}`;
        body = `<div class="bz-activity__changes">${it.changes.map(changeRow).join("")}</div>`;
        break;
      case "status":
        mark = `<span class="bz-activity__mark" data-tone="info">${ICON.flag}</span>`;
        text = `durumu değiştirdi ${badge(it.from)}<span aria-hidden="true">→</span>${badge(it.to)}`;
        body = it.note ? `<div class="bz-activity__note">${esc(it.note)}</div>` : "";
        break;
      case "file":
        mark = `<span class="bz-activity__mark">${ICON.file}</span>`;
        text = `belge ekledi <span class="bz-activity__ref">${esc(it.name)}</span>${it.meta ? ` <span class="bz-activity__role">${esc(it.meta)}</span>` : ""}`;
        break;
      case "system":
        mark = `<span class="bz-activity__mark" data-tone="system">${ICON.cog}</span>`;
        text = `<span class="bz-activity__who">Sistem</span> ${esc(it.text)}${it.ref ? ` <span class="bz-activity__ref">${ICON.link}${esc(it.ref)}</span>` : ""}`;
        break;
    }
    return `${head}<li class="bz-activity__item" data-kind="${it.kind}">${mark}<div class="bz-activity__main"><div class="bz-activity__head">${actor} <span class="bz-activity__text">${text}</span>${t}</div>${body}</div></li>`;
  });
  return `<ol class="bz-activity">${html.join("")}</ol>`;
}

// ───────── Kopyalama ─────────

let live: HTMLElement | null = null;
/** Ekran okuyucuya kısa duyuru (tek, gizli canlı bölge) */
export function bizmoAnnounce(text: string) {
  if (!live) {
    live = document.createElement("div");
    live.className = "bz-sr-only";
    live.setAttribute("aria-live", "polite");
    document.body.append(live);
  }
  live.textContent = "";
  setTimeout(() => { if (live) live.textContent = text; }, 30);
}

/** Kayıt numarası / IBAN / kod kopyalama düğmesi: tıklayınca panoya yazar, 1,6 sn onay işareti gösterir ve duyurur */
export function bizmoCopy(btn: HTMLElement, value?: string | (() => string)) {
  let t = 0;
  const on = async () => {
    const v = typeof value === "function" ? value() : value ?? btn.dataset.copy ?? btn.textContent?.trim() ?? "";
    try {
      await navigator.clipboard.writeText(v);
      btn.dataset.copied = "true";
      bizmoAnnounce(`${v} kopyalandı`);
    } catch {
      btn.dataset.copied = "false";
      bizmoAnnounce("Kopyalanamadı; metni seçip kopyalayın");
    }
    clearTimeout(t);
    t = window.setTimeout(() => delete btn.dataset.copied, 1600);
  };
  btn.addEventListener("click", on);
  if (!btn.title) btn.title = "Kopyala";
  return () => { btn.removeEventListener("click", on); clearTimeout(t); };
}

// ───────── Kayıt kartı (sohbette / panelde canlı durum) ─────────

export type RecordTone = "success" | "warning" | "danger" | "info" | "neutral";
export interface RecordCardStep { label: string; note?: string; state: "done" | "active" | "todo" | "blocked" }
export interface RecordCardData {
  /** "Satış siparişi", "İş emri", "İzin talebi" */
  kind: string;
  /** "SO-2026-0157 · Demir Metal" */
  title: string;
  /** durum çipi metni: "Üretimde" (renk tek başına anlam taşımaz) */
  status: string;
  tone?: RecordTone;
  /** 0–100 */
  progress?: number;
  steps?: RecordCardStep[];
  fields?: [string, string][];
  /** "Güncellendi 14:40" */
  updated?: string;
  href?: string;
  openLabel?: string;
  /** güvenilir SVG / ikon işaretlemesi (uygulamanın kendi ikonu); verilmezse belge simgesi */
  icon?: string;
}

const STEP_WORD: Record<RecordCardStep["state"], string> = { done: "tamamlandı", active: "sürüyor", todo: "bekliyor", blocked: "engellendi" };
const CHEV = SVG('<path d="m6 9 6 6 6-6"/>').replace("<svg ", '<svg class="bz-record-card__chev" ');
const REFRESH = SVG('<path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4"/>');

/**
 * Kayıt kartı işaretlemesi (tüm metin kaçırılır). Kart içeriği iletiye gömülmez: ileti yalnız kaydın kodunu taşır,
 * her görüntüleyen kartı kendi yetkisiyle sunucudan çözer; erişimi olmayana kart hiç çizilmez ("Erişim yok" kartı da yok).
 */
export function recordCardHtml(r: RecordCardData, o: { variant?: "inline" | "panel"; open?: boolean; id?: string } = {}): string {
  const tone = r.tone ?? "info", open = o.open ?? o.variant === "panel";
  const chip = tone === "neutral" ? "bz-chip" : `bz-chip bz-chip--${tone}`;
  const pct = r.progress === undefined ? null : Math.max(0, Math.min(100, Math.round(r.progress)));
  // Bağlantı yalnız göreli ya da http(s): "javascript:" gibi şemalar çizilmez
  const href = r.href && /^(https?:\/\/|\/(?!\/)|#|\?)/i.test(r.href) ? r.href : null;
  const steps = r.steps?.length ? `<ol class="bz-record-card__steps">${r.steps.map((s) => `<li data-state="${s.state}"><span class="bz-record-card__dot" aria-hidden="true"></span><span><span class="bz-record-card__step">${esc(s.label)}<span class="bz-sr-only"> · ${STEP_WORD[s.state]}</span></span>${s.note ? `<span class="bz-record-card__note">${esc(s.note)}</span>` : ""}</span></li>`).join("")}</ol>` : "";
  const fields = r.fields?.length ? `<dl class="bz-record-card__fields">${r.fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : "";
  const actions = `<div class="bz-record-card__actions"><span>${esc(r.updated ?? "")}</span><button type="button" class="bz-icon-btn bz-icon-btn--sm" data-record-refresh aria-label="Yenile: ${esc(r.title)}">${REFRESH}</button>${href ? `<a class="bz-btn bz-btn--sm bz-btn--ghost" href="${esc(href)}">${esc(r.openLabel ?? "Uygulamada aç")}</a>` : ""}</div>`;
  return `<article class="bz-record-card" data-tone="${tone}" data-variant="${o.variant ?? "inline"}"${o.id ? ` id="${esc(o.id)}"` : ""} aria-label="${esc(`${r.kind} ${r.title} · ${r.status}`)}">
    <button type="button" class="bz-record-card__top" aria-expanded="${open}"><span class="bz-record-card__icon" aria-hidden="true">${r.icon ?? ICON.file}</span><span class="bz-record-card__text"><span class="bz-record-card__kind">${esc(r.kind)}</span><span class="bz-record-card__title">${esc(r.title)}</span></span><span class="${chip}">${esc(r.status)}</span>${CHEV}</button>
    ${pct !== null ? `<div class="bz-record-card__progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="İlerleme"><i style="width:${pct}%"></i><span>%${pct}</span></div>` : ""}
    ${steps}${fields}${actions}
  </article>`;
}

/**
 * Kayıt kartlarını aç / kapa (olay devri: sonradan eklenen kartlar da çalışır). Üst satır bir düğmedir; Enter / Space yerleşik.
 * onRefresh verilirse "Yenile" düğmesi kartı ve kodu bildirir. Döndürülen işlev dinleyiciyi kaldırır.
 */
export function bizmoRecordCards(root: HTMLElement | Document = document, o: { onRefresh?: (card: HTMLElement) => void; onToggle?: (card: HTMLElement, open: boolean) => void } = {}) {
  const on = (e: Event) => {
    const t = e.target as HTMLElement;
    const top = t.closest<HTMLElement>(".bz-record-card__top");
    if (top) {
      const open = top.getAttribute("aria-expanded") !== "true";
      top.setAttribute("aria-expanded", String(open));
      o.onToggle?.(top.closest(".bz-record-card") as HTMLElement, open);
      return;
    }
    const r = t.closest<HTMLElement>("[data-record-refresh]");
    if (r) o.onRefresh?.(r.closest(".bz-record-card") as HTMLElement);
  };
  root.addEventListener("click", on);
  return () => root.removeEventListener("click", on);
}
