/**
 * Bizmo Universal Theme · planlama ve izlenebilirlik (çerçeveden bağımsız, bağımlılıksız)
 *
 *   Gantt     bizmoGantt(kap, { lanes, tasks, from, to, onChange })   makine şeritleri, sürükle-bırak (fare, dokunma, klavye),
 *             ganttConflicts(işler, şeritler) · laneLoad(işler, şeritler, from, to, dilim)   çakışma ve kapasite ısı şeridi
 *             bağlantılar (bitiş → başlangıç): ganttLinkIssues · ganttWouldCycle · ganttCascade (bağlıları ileri it)
 *             yol izleme: ganttChain · ganttPath · sağ tık / basılı tut menüsü ve haptik (gestures.ts)
 *   Kapasite  bizmoCapacityBoard(kap, { centers, buckets, orders, period, onChange, onBatch })   tezgah × gün, havuzdan sürükle-bırak
 *             capacityGrid · capacityCheck (yapamaz / kapalı / geçmiş / sığmaz / gecikme) · capacityAutoSchedule (sonlu kapasite,
 *             gerekirse günlere yayar) · capacitySplit / capacityMerge (günlere yay / birleştir) · capacityBalance (aşırı yükü dağıt)
 *   Ürün ağacı bomExplode(kod, kalemler, adet) · bomWhereUsed(kod, kalemler) · bomRequirements(satırlar, kalemler)
 *             bizmoBomTable(kap, satırlar, { mode })                   çok seviyeli ağaç tablo (treegrid, klavye)
 *   İzleme    traceGraph(düğümler, bağlar, odak) · recallScope(…) · bizmoTrace(kap, { nodes, edges, focus, recall })
 *             geriye (tedarikçiye) ve ileriye (müşteriye) lot izleme, 90° akson bağlar, geri çağırma kapsamı
 *
 * Kurallar (DESIGN.md §43): renk tek başına anlam taşımaz — durum, çakışma ve aşırı yük simge ve sözcükle de yazılır;
 * sürüklenen her iş klavyeyle de taşınır; plan değişikliği onChange'te sunucuya sorulur ve reddedilirse geri alınır.
 */
import { bizmoAnnounce } from "./records.js";
import { bizmoContextMenuDelegate, bizmoHaptic } from "./gestures.js";
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SVG = (d, cls = "") => `<svg${cls ? ` class="${cls}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const pad = (n) => String(n).padStart(2, "0");
const hm = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dayShort = (t) => new Date(t).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" });
const span = (a, b) => { const m = Math.round((b - a) / MIN); const h = Math.floor(m / 60); return h ? `${h} sa${m % 60 ? ` ${m % 60} dk` : ""}` : `${m} dk`; };
export const TASK_STATUS = { planned: "Planlandı", released: "Serbest", running: "Çalışıyor", done: "Bitti", hold: "Beklemede", late: "Gecikmede" };
/** İş → çakıştığı işler ve bakım blokları (aynı şeritte zaman kesişimi) */
export function ganttConflicts(tasks, lanes = []) {
    const out = new Map();
    const add = (id, what) => out.set(id, [...(out.get(id) ?? []), what]);
    const byLane = new Map();
    tasks.forEach((t) => byLane.set(t.lane, [...(byLane.get(t.lane) ?? []), t]));
    for (const [laneId, list] of byLane) {
        const s = [...list].sort((a, b) => a.start - b.start);
        for (let i = 0; i < s.length; i++)
            for (let j = i + 1; j < s.length && s[j].start < s[i].end; j++) {
                add(s[i].id, s[j].label);
                add(s[j].id, s[i].label);
            }
        const blocks = lanes.find((l) => l.id === laneId)?.blocks ?? [];
        for (const t of s)
            for (const b of blocks)
                if (t.start < b.to && b.from < t.end)
                    add(t.id, b.label ?? (b.kind === "maint" ? "Bakım" : "Kapalı"));
    }
    return out;
}
/** Kapasite: her şerit için dilim başına doluluk (0 = boş, 1 = tam, > 1 = aşırı yük); bakım / kapalı süre kapasiteden düşer */
export function laneLoad(tasks, lanes, from, to, bucketMs = HOUR) {
    const n = Math.max(1, Math.ceil((to - from) / bucketMs));
    return lanes.map((lane) => {
        const buckets = Array.from({ length: n }, (_, i) => {
            const a = from + i * bucketMs, b = Math.min(to, a + bucketMs);
            const ov = (s, e) => Math.max(0, Math.min(e, b) - Math.max(s, a));
            const off = (lane.blocks ?? []).reduce((x, k) => x + ov(k.from, k.to), 0);
            const used = tasks.filter((t) => t.lane === lane.id).reduce((x, t) => x + ov(t.start, t.end), 0);
            const cap = b - a - off;
            return cap <= 0 ? (used > 0 ? 2 : -1) : used / cap;
        });
        const cap = n * bucketMs - (lane.blocks ?? []).reduce((x, k) => x + Math.max(0, Math.min(k.to, to) - Math.max(k.from, from)), 0);
        const used = tasks.filter((t) => t.lane === lane.id).reduce((x, t) => x + Math.max(0, Math.min(t.end, to) - Math.max(t.start, from)), 0);
        return { lane: lane.id, buckets, total: cap > 0 ? used / cap : 0 };
    });
}
const I = {
    play: SVG('<path d="M7 5v14l11-7L7 5Z" fill="currentColor"/>'),
    check: SVG('<path d="m5 12 5 5 9-10"/>'),
    pause: SVG('<path d="M8 5v14M16 5v14"/>'),
    alert: SVG('<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17.5v.01"/>'),
    lock: SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    unlock: SVG('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>'),
    wrench: SVG('<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z"/>'),
    link: SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
    unlink: SVG('<path d="M9 15 15 9M8 6l1 1M16 18l-1-1M4 12h3M17 12h3"/>'),
    route: SVG('<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>'),
    pull: SVG('<path d="M4 4v16M20 12H9M13 8l-4 4 4 4"/>'),
    open: SVG('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    dot: SVG('<circle cx="12" cy="12" r="4" fill="currentColor"/>'),
};
const STATUS_ICON = { running: I.play, done: I.check, hold: I.pause, late: I.alert };
const MENU_ICON = { ...I, planned: I.dot, released: I.dot, running: I.play, hold: I.pause, done: I.check };
const linkKey = (l) => `${l.from}>${l.to}`;
/** Sıra ihlalleri: sonraki iş, önceki bitmeden (+ bekleme) başlıyorsa "a>b" → açıklama */
export function ganttLinkIssues(tasks, links) {
    const by = new Map(tasks.map((t) => [t.id, t])), out = new Map();
    for (const l of links) {
        const a = by.get(l.from), b = by.get(l.to);
        if (!a || !b)
            continue;
        const need = a.end + (l.lagMin ?? 0) * MIN;
        if (b.start < need)
            out.set(linkKey(l), `${b.label}, ${a.label} bitmeden ${span(b.start, need)} önce başlıyor`);
    }
    return out;
}
/** İşin bağlı zinciri: öncekiler (yukarı akış) ve sonrakiler (aşağı akış) */
export function ganttChain(links, id) {
    const walk = (start, next) => { const seen = new Set(), q = [start]; while (q.length)
        for (const n of next(q.shift()))
            if (!seen.has(n) && n !== id) {
                seen.add(n);
                q.push(n);
            } return seen; };
    return { up: walk(id, (x) => links.filter((l) => l.to === x).map((l) => l.from)), down: walk(id, (x) => links.filter((l) => l.from === x).map((l) => l.to)) };
}
/** from → to bağlantısı döngü oluşturur mu (to'dan from'a zaten yol varsa) */
export const ganttWouldCycle = (links, from, to) => from === to || ganttChain(links, to).down.has(from);
/**
 * Bağlı işleri ileri kaydırır: taşınan işten sonra gelen her iş, önceki(ler)i bitmeden başlıyorsa en erken uygun zamana itilir
 * (süre korunur, kilitli işe dokunulmaz). Kaydırılan işlerin kimlikleri döner. Yalnız ileri iter, geri çekmez.
 */
export function ganttCascade(tasks, links, movedId, snapMin = 15) {
    const next = tasks.map((t) => ({ ...t })), by = new Map(next.map((t) => [t.id, t])), shifted = [];
    const q = [movedId], snap = snapMin * MIN;
    for (let guard = 0; q.length && guard < 1000; guard++) {
        const id = q.shift();
        for (const l of links.filter((x) => x.from === id)) {
            const a = by.get(l.from), b = by.get(l.to);
            if (!b || b.locked)
                continue;
            const need = Math.ceil((a.end + (l.lagMin ?? 0) * MIN) / snap) * snap;
            if (b.start < need) {
                const d = need - b.start;
                b.start += d;
                b.end += d;
                if (!shifted.includes(b.id))
                    shifted.push(b.id);
            }
            q.push(b.id);
        }
    }
    return { tasks: next, shifted };
}
/** Yol izleme özeti: zincirdeki işler (başlangıca göre sıralı), ilk başlangıç, son bitiş, geciken ve sıra ihlali sayısı */
export function ganttPath(tasks, links, id) {
    const self = tasks.find((t) => t.id === id);
    if (!self)
        return null;
    const { up, down } = ganttChain(links, id);
    const chain = tasks.filter((t) => t.id === id || up.has(t.id) || down.has(t.id)).sort((a, b) => a.start - b.start);
    const ids = new Set(chain.map((t) => t.id));
    const violations = [...ganttLinkIssues(tasks, links.filter((l) => ids.has(l.from) && ids.has(l.to))).keys()].length;
    const late = chain.filter((t) => t.due && t.end > t.due && t.status !== "done").map((t) => t.label);
    const start = Math.min(...chain.map((t) => t.start)), end = Math.max(...chain.map((t) => t.end));
    const text = `${chain.map((t) => t.label).join(" → ")} · ${dayShort(start)} ${hm(start)} – ${dayShort(end)} ${hm(end)} (${span(start, end)})${late.length ? ` · ${late.length} gecikecek` : ""}${violations ? ` · ${violations} sıra ihlali` : ""}`;
    return { id, up: [...up], down: [...down], ids: chain.map((t) => t.id), start, end, late, violations, text };
}
/** Dik açılı (akson) çizgi: köşeler yuvarlatılmış */
function ortho(pts, r = 6) {
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
        const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
        const r1 = Math.min(r, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
        const ax = x - Math.sign(x - px) * r1, ay = y - Math.sign(y - py) * r1, bx = x + Math.sign(nx - x) * r1, by = y + Math.sign(ny - y) * r1;
        d += `L${ax} ${ay}Q${x} ${y} ${bx} ${by}`;
    }
    const [lx, ly] = pts[pts.length - 1];
    return d + `L${lx} ${ly}`;
}
/**
 * Üretim planı Gantt'ı. Şerit = makine / hat; iş çubuğu sürüklenerek zamanı ve şeridi değişir, sağ uçtan uzar / kısalır.
 * Bağlantı: çubuğun sağındaki noktadan başka işe sürükle ya da menüden "Bağla…"; ok önceki işin bitişinden sonrakinin başına,
 * 90° akson. Önceki bitmeden başlayan iş kırmızı kesikli okla (sıra ihlali); autoShift açıksa bağlı işler ileri itilir.
 * Yol izleme: işe tıklayınca öncekiler ve sonrakiler belirginleşir, gerisi soluklaşır (Esc bırakır); onTrace özet verir.
 * Sağ tık / basılı tut / Shift+F10: yolu izle, bağla, bağlantı kaldır, durum, kilit, en erken boşluğa çek, ayrıntı.
 * Klavye: ←/→ kaydır (snap, Shift ile 1 saat) · Alt+↑/↓ şerit · +/− süre · Boşluk yolu izle · L bağla · Enter ayrıntı · Esc bırak.
 * Haptik: sürükleme başı, her adım, bırakma (başarı / çakışma / ret) ve bağlantı. onChange / onLink false dönerse geri alınır.
 */
export function bizmoGantt(host, o) {
    let tasks = o.tasks.map((t) => ({ ...t }));
    let links = (o.links ?? []).map((l) => ({ ...l }));
    let autoShift = !!o.autoShift;
    const snap = (o.snapMin ?? 15) * MIN;
    const hw = o.hourWidth ?? 48;
    const width = ((o.to - o.from) / HOUR) * hw;
    const x = (t) => ((t - o.from) / HOUR) * hw;
    const snapT = (t) => Math.round(t / snap) * snap;
    const byId = (id) => tasks.find((t) => t.id === id);
    let focusId = null, traceId = null, linking = null;
    function render() {
        const keep = host.querySelector(".bz-gantt__scroll")?.scrollLeft ?? 0;
        const conflicts = ganttConflicts(tasks, o.lanes);
        const issues = ganttLinkIssues(tasks, links);
        const load = laneLoad(tasks, o.lanes, o.from, o.to, (o.loadBucketMin ?? 60) * MIN);
        const chain = traceId ? ganttChain(links, traceId) : null;
        const rel = (id) => (!chain ? "" : id === traceId ? "self" : chain.up.has(id) ? "up" : chain.down.has(id) ? "down" : "none");
        // Zaman ölçeği: gün + saat; vardiya sınırları (06 · 14 · 22) belirgin
        const hours = [], days = [];
        for (let t = o.from; t < o.to; t += HOUR) {
            const h = new Date(t).getHours();
            hours.push(`<span class="bz-gantt__hour${h % 8 === 6 ? " bz-gantt__hour--shift" : ""}" style="left:${x(t)}px">${hw >= 36 || h % 2 === 0 ? pad(h) : ""}</span>`);
            if (h === 0 || t === o.from)
                days.push(`<span class="bz-gantt__day" style="left:${x(t)}px">${esc(dayShort(t))}</span>`);
        }
        const grid = `--_hw:${hw}px;--_w:${width}px`;
        const nowX = o.now !== undefined && o.now >= o.from && o.now <= o.to ? x(o.now) : null;
        const rows = o.lanes.map((lane, li) => {
            const L = load[li];
            const overloaded = L.buckets.some((v) => v > 1);
            const laneConf = tasks.filter((t) => t.lane === lane.id && conflicts.has(t.id)).length;
            const blocks = (lane.blocks ?? []).map((b) => `<div class="bz-gantt__block" data-kind="${b.kind}" style="left:${x(Math.max(b.from, o.from))}px;width:${x(Math.min(b.to, o.to)) - x(Math.max(b.from, o.from))}px" title="${esc(`${b.label ?? "Bakım"} · ${hm(b.from)}–${hm(b.to)}`)}">${b.kind === "maint" ? I.wrench : ""}<span>${esc(b.label ?? (b.kind === "maint" ? "Bakım" : "Kapalı"))}</span></div>`).join("");
            const bars = tasks.filter((t) => t.lane === lane.id).map((t) => {
                const st = t.due && t.end > t.due && t.status !== "done" ? "late" : t.status ?? "planned";
                const conf = conflicts.get(t.id);
                const seq = links.filter((l) => l.to === t.id && issues.has(linkKey(l))).map((l) => byId(l.from)?.label).filter(Boolean);
                const pre = links.filter((l) => l.to === t.id).map((l) => byId(l.from)?.label).filter(Boolean), post = links.filter((l) => l.from === t.id).map((l) => byId(l.to)?.label).filter(Boolean);
                const w = Math.max(6, x(t.end) - x(t.start));
                const setup = t.setupMin ? Math.min(w, (t.setupMin * MIN / HOUR) * hw) : 0;
                const r = rel(t.id);
                const label = `${t.label}${t.sub ? ` · ${t.sub}` : ""} · ${lane.label} · ${dayShort(t.start)} ${hm(t.start)}–${hm(t.end)} (${span(t.start, t.end)}) · ${TASK_STATUS[st]}${t.progress ? ` · %${Math.round(t.progress * 100)}` : ""}${conf ? ` · Çakışma: ${conf.join(", ")}` : ""}${seq.length ? ` · Sıra ihlali: ${seq.join(", ")} bitmeden başlıyor` : ""}${pre.length ? ` · Önce: ${pre.join(", ")}` : ""}${post.length ? ` · Sonra: ${post.join(", ")}` : ""}${t.locked ? " · kilitli" : ""}${r === "up" ? " · izlenen yolda (önce)" : r === "down" ? " · izlenen yolda (sonra)" : ""}`;
                const bar = `<button type="button" class="bz-gantt__bar" data-id="${esc(t.id)}" data-status="${st}"${conf || seq.length ? ' data-conflict="true"' : ""}${t.locked ? ' data-locked="true"' : ""}${w < 64 ? ' data-narrow="true"' : ""}${r ? ` data-trace="${r}"` : ""}${linking === t.id ? ' data-linking="true"' : ""} style="left:${x(t.start)}px;width:${w}px;--_p:${Math.round((t.progress ?? 0) * 100)}%;--_setup:${setup}px" aria-label="${esc(label)}" aria-pressed="${t.id === traceId}" title="${esc(label)}">
          ${setup ? '<span class="bz-gantt__setup" aria-hidden="true"></span>' : ""}${t.progress ? '<span class="bz-gantt__progress" aria-hidden="true"></span>' : ""}
          <span class="bz-gantt__label">${conf || seq.length ? I.alert : t.locked ? I.lock : STATUS_ICON[st] ?? ""}<b>${esc(t.label)}</b>${t.sub ? `<span>${esc(t.sub)}</span>` : ""}</span>
          ${o.readOnly || t.locked ? "" : '<span class="bz-gantt__handle" aria-hidden="true"></span>'}
        </button>`;
                const connect = o.readOnly ? "" : `<span class="bz-gantt__connect" data-connect="${esc(t.id)}" style="left:${x(t.start) + w + 3}px" title="Sürükleyip sonraki işe bırakın: bağla" aria-hidden="true"></span>`;
                return bar + connect;
            }).join("");
            const strip = L.buckets.map((v) => `<i data-load="${v < 0 ? "off" : v === 0 ? "0" : v <= 0.5 ? "1" : v <= 0.85 ? "2" : v <= 1.0001 ? "3" : "over"}" title="${v < 0 ? "Kapalı" : `%${Math.round(v * 100)}`}"></i>`).join("");
            return `<div class="bz-gantt__row" data-lane="${esc(lane.id)}">
        <div class="bz-gantt__lane" role="rowheader"><b>${esc(lane.label)}</b>${lane.sub ? `<span>${esc(lane.sub)}</span>` : ""}<span class="bz-gantt__util${overloaded ? " bz-gantt__util--over" : ""}">${overloaded ? I.alert : ""}%${Math.round(L.total * 100)} yük${laneConf ? ` · ${laneConf} çakışma` : ""}</span></div>
        <div class="bz-gantt__track" style="${grid}">${blocks}${bars}<div class="bz-gantt__load" aria-hidden="true" style="grid-template-columns:repeat(${L.buckets.length},1fr)">${strip}</div></div>
      </div>`;
        }).join("");
        host.innerHTML = `<div class="bz-gantt"${traceId ? ' data-tracing="true"' : ""}${linking ? ' data-linking="true"' : ""} role="group" aria-label="${esc(o.label ?? "Üretim planı")}" aria-roledescription="Gantt">
      <div class="bz-gantt__scroll">
        <div class="bz-gantt__head"><div class="bz-gantt__corner">Makine</div><div class="bz-gantt__scale" style="${grid}"><div class="bz-gantt__days">${days.join("")}</div><div class="bz-gantt__hours">${hours.join("")}</div></div></div>
        <div class="bz-gantt__body" style="${grid}"><svg class="bz-gantt__links" aria-hidden="true"></svg>${rows}${nowX !== null ? `<div class="bz-gantt__now" style="left:calc(var(--bz-gantt-lane, 200px) + ${nowX}px)"><span>Şimdi ${hm(o.now)}</span></div>` : ""}</div>
      </div>
      <div class="bz-gantt__tip" role="status" hidden></div>
      ${linking ? `<div class="bz-gantt__mode" role="status">${I.link}<span><b>${esc(byId(linking)?.label ?? "")}</b> → bağlanacak sonraki işi seçin</span><button type="button" class="bz-btn bz-btn--sm bz-btn--ghost" data-act="cancel-link">Vazgeç (Esc)</button></div>` : ""}
    </div>`;
        const sc = host.querySelector(".bz-gantt__scroll");
        if (sc)
            sc.scrollLeft = keep;
        drawLinks(issues, chain);
        if (focusId)
            host.querySelector(`.bz-gantt__bar[data-id="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
    }
    // Bağlantı okları: önceki işin bitişinden sonrakinin başına, 90° kırılan çizgi; ihlal kırmızı kesikli, izlenen yol mavi
    function drawLinks(issues = ganttLinkIssues(tasks, links), chain = traceId ? ganttChain(links, traceId) : null, temp) {
        const body = host.querySelector(".bz-gantt__body"), svg = host.querySelector(".bz-gantt__links");
        if (!body || !svg)
            return;
        const B = body.getBoundingClientRect();
        svg.setAttribute("width", String(body.scrollWidth));
        svg.setAttribute("height", String(body.scrollHeight));
        const box = (id) => { const el = body.querySelector(`.bz-gantt__bar[data-id="${CSS.escape(id)}"]`); if (!el)
            return null; const r = el.getBoundingClientRect(); return { l: r.left - B.left, r: r.right - B.left, t: r.top - B.top, b: r.bottom - B.top, y: r.top - B.top + r.height / 2 }; };
        const onPath = (l) => !!chain && traceId !== null && ((l.from === traceId || chain.up.has(l.from)) && (l.to === traceId || chain.up.has(l.to)) || (l.from === traceId || chain.down.has(l.from)) && chain.down.has(l.to));
        const out = [];
        for (const l of links) {
            const a = box(l.from), b = box(l.to);
            if (!a || !b)
                continue;
            const x1 = a.r, y1 = a.y, x2 = b.l, y2 = b.y;
            let pts;
            if (Math.abs(y1 - y2) < 1 && x2 - x1 >= 4)
                pts = [[x1, y1], [x2, y2]];
            else if (x2 - x1 >= 22)
                pts = [[x1, y1], [x1 + 10, y1], [x1 + 10, y2], [x2, y2]];
            else {
                const ym = y2 > y1 ? a.b + 4 : y2 < y1 ? a.t - 4 : a.b + 6;
                pts = [[x1, y1], [x1 + 10, y1], [x1 + 10, ym], [x2 - 12, ym], [x2 - 12, y2], [x2, y2]];
            }
            const bad = issues.has(linkKey(l)), on = onPath(l);
            const st = bad ? "violated" : on ? "trace" : chain ? "dim" : "normal";
            out.push(`<g class="bz-gantt__link" data-state="${st}"><title>${esc(`${byId(l.from)?.label} → ${byId(l.to)?.label}${l.lagMin ? ` · ${l.lagMin} dk bekleme` : ""}${bad ? ` · ${issues.get(linkKey(l))}` : ""}`)}</title><path d="${ortho(pts)}"/><path class="bz-gantt__arrow" d="M${x2 - 6} ${y2 - 4}L${x2} ${y2}L${x2 - 6} ${y2 + 4}Z"/></g>`);
        }
        if (temp) {
            const a = box(temp.from);
            if (a)
                out.push(`<g class="bz-gantt__link" data-state="draft"><path d="${ortho([[a.r, a.y], [a.r + 10, a.y], [a.r + 10, temp.y], [temp.x, temp.y]])}"/></g>`);
        }
        // Vurgulu yollar üstte
        svg.innerHTML = out.filter((p) => !/data-state="(trace|violated|draft)"/.test(p)).join("") + out.filter((p) => /data-state="(trace|violated|draft)"/.test(p)).join("");
    }
    const laneLabel = (id) => o.lanes.find((l) => l.id === id)?.label ?? id;
    async function commit(t, prev) {
        let shifted = [];
        if (autoShift) {
            const c = ganttCascade(tasks, links, t.id, snap / MIN);
            shifted = c.shifted.map((id) => ({ id, prev: { ...byId(id) } }));
            c.shifted.forEach((id) => Object.assign(byId(id), c.tasks.find((x) => x.id === id)));
        }
        const ok = await o.onChange?.(t, prev);
        const el = () => host.querySelector(`.bz-gantt__bar[data-id="${CSS.escape(t.id)}"]`);
        if (ok === false) {
            Object.assign(t, prev);
            shifted.forEach((s) => Object.assign(byId(s.id), s.prev));
            render();
            bizmoHaptic("error", { el: el() });
            bizmoAnnounce(`${t.label} taşınamadı; eski yerine döndü`);
            return;
        }
        if (shifted.length)
            o.onCascade?.(shifted.map((s) => ({ ...byId(s.id) })));
        render();
        const conflict = ganttConflicts(tasks, o.lanes).has(t.id) || links.some((l) => (l.to === t.id || l.from === t.id) && ganttLinkIssues(tasks, [l]).size);
        bizmoHaptic(conflict ? "warning" : "success", { el: el() });
        bizmoAnnounce(`${t.label}: ${laneLabel(t.lane)}, ${hm(t.start)}–${hm(t.end)}${shifted.length ? ` · ${shifted.length} bağlı iş ileri kaydı` : ""}${conflict ? " · çakışma var" : ""}`);
        if (traceId)
            o.onTrace?.(ganttPath(tasks, links, traceId));
    }
    const find = (el) => { const id = el?.closest(".bz-gantt__bar")?.dataset.id; return id ? byId(id) : undefined; };
    // ── Yol izleme ve bağlama ──
    function trace(id) {
        traceId = id && traceId !== id ? id : null;
        render();
        const p = traceId ? ganttPath(tasks, links, traceId) : null;
        o.onTrace?.(p);
        if (p) {
            bizmoHaptic("selection");
            bizmoAnnounce(`Yol: ${p.text}`);
        }
        else
            bizmoAnnounce("Yol izleme bırakıldı");
    }
    function startLink(from) {
        linking = from;
        focusId = from;
        render();
        bizmoHaptic("light");
        bizmoAnnounce(`${byId(from)?.label}: bağlanacak sonraki işi seçin; Esc vazgeçer`);
    }
    async function addLink(from, to) {
        linking = null;
        const a = byId(from), b = byId(to);
        const fail = (msg) => { render(); bizmoHaptic("error", { el: host.querySelector(`.bz-gantt__bar[data-id="${CSS.escape(to)}"]`) }); bizmoAnnounce(msg); };
        if (!a || !b)
            return fail("Bağlantı kurulamadı");
        if (from === to)
            return fail("İş kendine bağlanamaz");
        if (links.some((l) => l.from === from && l.to === to))
            return fail(`${a.label} → ${b.label} zaten bağlı`);
        if (ganttWouldCycle(links, from, to))
            return fail(`Döngü oluşur: ${b.label} zaten ${a.label}'den önce geliyor`);
        const link = { from, to };
        if ((await o.onLink?.(link, "add")) === false)
            return fail("Bağlantı reddedildi");
        links.push(link);
        focusId = to;
        if (autoShift && b.start < a.end) {
            const prev = { ...b };
            Object.assign(b, ganttCascade(tasks, links, from, snap / MIN).tasks.find((t) => t.id === to));
            await commit(b, prev);
        }
        else
            render();
        const bad = ganttLinkIssues(tasks, [link]).size > 0;
        bizmoHaptic(bad ? "warning" : "success", { el: host.querySelector(`.bz-gantt__bar[data-id="${CSS.escape(to)}"]`) });
        bizmoAnnounce(`${a.label} → ${b.label} bağlandı${bad ? "; sıra ihlali: sonraki iş önce başlıyor" : ""}`);
        if (traceId)
            o.onTrace?.(ganttPath(tasks, links, traceId));
    }
    async function removeLink(l) {
        if ((await o.onLink?.(l, "remove")) === false)
            return;
        links = links.filter((x) => linkKey(x) !== linkKey(l));
        render();
        bizmoHaptic("light");
        bizmoAnnounce(`${byId(l.from)?.label} → ${byId(l.to)?.label} bağlantısı kaldırıldı`);
        if (traceId)
            o.onTrace?.(ganttPath(tasks, links, traceId));
    }
    /** En erken boşluk: şimdiden ve öncekiler bittikten sonra, şeritte iş ve bakımla çakışmayan ilk yer (geçmişe planlanmaz) */
    function earliest(t) {
        const dur = t.end - t.start;
        let s = Math.max(o.from, o.now ?? o.from, ...links.filter((l) => l.to === t.id).map((l) => (byId(l.from)?.end ?? 0) + (l.lagMin ?? 0) * MIN));
        s = Math.ceil(s / snap) * snap;
        const busy = [...tasks.filter((x) => x.lane === t.lane && x.id !== t.id).map((x) => [x.start, x.end]), ...(o.lanes.find((l) => l.id === t.lane)?.blocks ?? []).map((b) => [b.from, b.to])];
        for (let k = 0; k < 100; k++) {
            const hit = busy.find(([a, b]) => s < b && a < s + dur);
            if (!hit)
                break;
            s = Math.ceil(hit[1] / snap) * snap;
        }
        return s;
    }
    // ── Bağlam menüsü (sağ tık, basılı tut, Shift+F10) ──
    const statusItem = (t, k, tone) => ({ label: TASK_STATUS[k], icon: k, tone, checked: (t.status ?? "planned") === k, disabled: o.readOnly, onSelect: () => { const prev = { ...t }; t.status = k; focusId = t.id; commit(t, prev); } });
    bizmoContextMenuDelegate(host, ".bz-gantt__bar", {
        title: (el) => { const t = find(el); return t ? `${t.label}${t.sub ? ` · ${t.sub}` : ""}` : ""; },
        icon: (n) => MENU_ICON[n] ?? "",
        items: (el) => {
            const t = find(el);
            if (!t)
                return [];
            const mine = links.filter((l) => l.from === t.id || l.to === t.id).slice(0, 4);
            const items = [
                { label: traceId === t.id ? "İzlemeyi bırak" : "Yolu izle", icon: "route", shortcut: "Boşluk", onSelect: () => trace(t.id) },
                { label: "Bağla… (sonraki işi seç)", icon: "link", shortcut: "L", disabled: o.readOnly, onSelect: () => startLink(t.id) },
                ...mine.map((l) => ({ label: `Bağlantıyı kaldır: ${byId(l.from)?.label} → ${byId(l.to)?.label}`, icon: "unlink", destructive: true, disabled: o.readOnly, onSelect: () => { removeLink(l); } })),
                "separator",
                statusItem(t, "planned", "neutral"), statusItem(t, "released", "info"), statusItem(t, "running", "success"), statusItem(t, "hold", "warning"), statusItem(t, "done", "neutral"),
                "separator",
                { label: t.locked ? "Kilidi aç" : "Kilitle (taşınmaz)", icon: t.locked ? "unlock" : "lock", disabled: o.readOnly, onSelect: () => { const prev = { ...t }; t.locked = !t.locked; focusId = t.id; commit(t, prev); } },
                { label: "En erken boşluğa çek", icon: "pull", disabled: o.readOnly || t.locked, onSelect: () => {
                        const s = earliest(t);
                        if (s >= t.start) {
                            bizmoAnnounce(`${t.label} zaten en erken uygun zamanda`);
                            bizmoHaptic("light");
                            return;
                        }
                        const prev = { ...t }, d = s - t.start;
                        t.start += d;
                        t.end += d;
                        focusId = t.id;
                        commit(t, prev);
                    } },
                ...(o.onOpen ? [{ label: "Ayrıntıyı aç", icon: "open", shortcut: "Enter", onSelect: () => o.onOpen(t) }] : []),
                ...(o.menu?.(t) ?? []),
            ];
            return items;
        },
    });
    // ── Sürükle: gövde taşır (zaman + şerit), sağ tutamak süre, sağdaki nokta bağlantı. 4px eşik; uzun basış menü açar ──
    let drag = null;
    let wire = null;
    const tip = () => host.querySelector(".bz-gantt__tip");
    const barAt = (e) => document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.classList?.contains("bz-gantt__bar"));
    host.addEventListener("pointerdown", (e) => {
        const target = e.target;
        if (e.button !== 0)
            return;
        const con = target.closest("[data-connect]");
        if (con && !o.readOnly) {
            e.preventDefault();
            wire = { from: con.dataset.connect, id: e.pointerId };
            con.setPointerCapture(e.pointerId);
            bizmoHaptic("light");
            return;
        }
        const el = target.closest(".bz-gantt__bar");
        const t = find(el);
        if (!el || !t)
            return;
        drag = { t, prev: { ...t }, x0: e.clientX, y0: e.clientY, mode: target.classList.contains("bz-gantt__handle") ? "resize" : "move", el, moved: false, at: Date.now(), lastStart: t.start, lastEnd: t.end };
        if (!o.readOnly && !t.locked)
            el.setPointerCapture(e.pointerId);
    });
    host.addEventListener("pointermove", (e) => {
        if (wire) {
            const body = host.querySelector(".bz-gantt__body"), B = body.getBoundingClientRect();
            host.querySelectorAll("[data-link-target]").forEach((n) => n.removeAttribute("data-link-target"));
            const over = barAt(e);
            if (over && over.dataset.id !== wire.from)
                over.dataset.linkTarget = ganttWouldCycle(links, wire.from, over.dataset.id) ? "bad" : "ok";
            drawLinks(undefined, undefined, { from: wire.from, x: e.clientX - B.left, y: e.clientY - B.top });
            return;
        }
        if (!drag || o.readOnly || drag.t.locked)
            return;
        const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (!drag.moved && Math.hypot(dx, dy) < 4)
            return;
        if (!drag.moved)
            bizmoHaptic("light");
        drag.moved = true;
        const dt = snapT((dx / hw) * HOUR);
        const { t, prev } = drag;
        if (drag.mode === "resize")
            t.end = Math.max(prev.start + snap, prev.end + dt);
        else {
            t.start = prev.start + dt;
            t.end = prev.end + dt;
            const row = document.elementsFromPoint(e.clientX, e.clientY).find((n) => n.dataset?.lane);
            if (row?.dataset.lane)
                t.lane = row.dataset.lane;
        }
        if (t.start !== drag.lastStart || t.end !== drag.lastEnd) {
            drag.lastStart = t.start;
            drag.lastEnd = t.end;
            bizmoHaptic("selection");
        }
        drag.el.dataset.dragging = "true";
        drag.el.style.left = `${x(t.start)}px`;
        drag.el.style.width = `${Math.max(6, x(t.end) - x(t.start))}px`;
        drag.el.style.transform = t.lane !== prev.lane ? `translateY(${dy}px)` : "";
        drawLinks();
        const tp = tip();
        tp.hidden = false;
        tp.textContent = `${laneLabel(t.lane)} · ${hm(t.start)}–${hm(t.end)} · ${span(t.start, t.end)}`;
        const r = host.getBoundingClientRect();
        tp.style.left = `${e.clientX - r.left + 12}px`;
        tp.style.top = `${e.clientY - r.top + 14}px`;
    });
    const end = (e) => {
        if (wire) {
            const w = wire;
            wire = null;
            host.querySelectorAll("[data-link-target]").forEach((n) => n.removeAttribute("data-link-target"));
            const over = barAt(e);
            if (over?.dataset.id && over.dataset.id !== w.from)
                addLink(w.from, over.dataset.id);
            else
                drawLinks();
            return;
        }
        if (!drag)
            return;
        const d = drag;
        drag = null;
        tip().hidden = true;
        if (!d.moved) {
            // Kısa dokunuş: bağlama modunda hedef, değilse yolu izle. Uzun basış (menü) izlemeyi değiştirmez.
            if (Date.now() - d.at > 420)
                return;
            if (linking) {
                addLink(linking, d.t.id);
                return;
            }
            focusId = d.t.id;
            trace(d.t.id);
            return;
        }
        focusId = d.t.id;
        if (d.t.start === d.prev.start && d.t.end === d.prev.end && d.t.lane === d.prev.lane) {
            render();
            return;
        }
        commit(d.t, d.prev);
    };
    host.addEventListener("pointerup", end);
    host.addEventListener("pointercancel", () => { wire = null; if (drag) {
        Object.assign(drag.t, drag.prev);
        drag = null;
        render();
    } });
    host.addEventListener("click", (e) => { if (e.target.closest('[data-act="cancel-link"]')) {
        linking = null;
        render();
        bizmoAnnounce("Bağlama iptal edildi");
    } });
    host.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && (linking || traceId)) {
            e.preventDefault();
            if (linking) {
                linking = null;
                render();
                bizmoAnnounce("Bağlama iptal edildi");
            }
            else
                trace(null);
            return;
        }
        const t = find(e.target);
        if (!t)
            return;
        if (e.key === "Enter") {
            e.preventDefault();
            if (linking)
                addLink(linking, t.id);
            else
                o.onOpen?.(t);
            return;
        }
        if (e.key === " ") {
            e.preventDefault();
            trace(t.id);
            return;
        }
        if ((e.key === "l" || e.key === "L") && !o.readOnly && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            startLink(t.id);
            return;
        }
        if (o.readOnly || t.locked) {
            const moveKey = e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "+" || e.key === "-" || (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown"));
            if (moveKey && !o.readOnly) {
                bizmoAnnounce(`${t.label} kilitli; taşınamaz`);
                bizmoHaptic("error");
            }
            return;
        }
        const prev = { ...t };
        const step = e.shiftKey ? HOUR : snap;
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const d = e.key === "ArrowLeft" ? -step : step;
            t.start += d;
            t.end += d;
        }
        else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            const i = o.lanes.findIndex((l) => l.id === t.lane) + (e.key === "ArrowUp" ? -1 : 1);
            if (i < 0 || i >= o.lanes.length)
                return;
            t.lane = o.lanes[i].id;
        }
        else if (e.key === "+" || e.key === "=")
            t.end += snap;
        else if (e.key === "-" && t.end - t.start > snap)
            t.end -= snap;
        else
            return;
        e.preventDefault();
        focusId = t.id;
        commit(t, prev);
    });
    host.addEventListener("focusin", (e) => { const t = find(e.target); if (t)
        focusId = t.id; });
    render();
    return {
        get: () => tasks.map((t) => ({ ...t })),
        getLinks: () => links.map((l) => ({ ...l })),
        set(next, nextLinks) { tasks = next.map((t) => ({ ...t })); if (nextLinks)
            links = nextLinks.map((l) => ({ ...l })); render(); },
        /** Yol izleme: id ver ya da null ile bırak */
        trace: (id) => { traceId = null; trace(id); },
        setAutoShift(on) { autoShift = on; },
        /** Şimdi çizgisini görünür alana getirir */
        scrollToNow() { if (o.now !== undefined)
            host.querySelector(".bz-gantt__scroll")?.scrollTo({ left: Math.max(0, x(o.now) - 160) }); },
        destroy: () => (host.innerHTML = ""),
    };
}
const r1 = (n) => Math.round(n * 10) / 10;
const hrs = (n) => `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(n)} sa`;
const cellKey = (c, b) => `${c}|${b}`;
export const canRun = (o, c) => c.skills.includes(o.skill);
export const capLate = (o, b) => !!o.due && b.date > o.due;
const isPast = (b, today) => !!today && b.date < today;
const planned = (o) => !!o.center && !!o.bucket;
const rootOf = (o) => o.part?.of ?? o.id;
/** Parçalı işte görünen ad: "İE-0437 · 1/3" */
export const capLabel = (o) => (o.part ? `${o.label} · ${o.part.n}/${o.part.total}` : o.label);
/** Gündeki vardiya sayısı (hours verilmiş ve shifts yoksa saat / vardiya süresinden) */
export const shiftsOf = (c, bi) => (c.shifts !== undefined ? (Array.isArray(c.shifts) ? c.shifts[bi] ?? 0 : c.shifts) : r1(grossHours(c, bi) / (c.shiftHours ?? 8)));
/** Günlük brüt saat (verimden ve duruştan önce) */
export function grossHours(c, bi) {
    if (c.hours !== undefined)
        return Array.isArray(c.hours) ? c.hours[bi] ?? 0 : c.hours;
    const sh = Array.isArray(c.shifts) ? c.shifts[bi] ?? 0 : c.shifts ?? 1;
    return sh * (c.shiftHours ?? 8);
}
/** Verim (0–1): efficiency ya da OEE = kullanılabilirlik × performans × kalite; ikisi de yoksa 1 */
export const efficiencyOf = (c) => c.efficiency ?? (c.oee ? c.oee.availability * c.oee.performance * c.oee.quality : 1);
/** Hücre kapasitesi: brüt saat × verim − duruş; kapalı gün 0 */
export function cellCapacity(c, b, bi) {
    if (b.off)
        return 0;
    const down = (c.down ?? []).filter((d) => d.bucket === b.id).reduce((s, d) => s + d.hours, 0);
    return r1(Math.max(0, grossHours(c, bi) * efficiencyOf(c) - down));
}
/** Tezgahın dönem özeti: gün gün vardiya / brüt / duruş / net / planlı / boş ve toplamlar */
export function centerStats(c, buckets, orders) {
    const days = buckets.map((b, bi) => {
        const gross = b.off ? 0 : grossHours(c, bi), down = r1((c.down ?? []).filter((d) => d.bucket === b.id).reduce((s, d) => s + d.hours, 0));
        const net = cellCapacity(c, b, bi), load = r1(cellLoad(orders, c.id, b.id));
        return { bucket: b, shifts: b.off ? 0 : shiftsOf(c, bi), gross, down: b.off ? 0 : down, net, load, free: r1(net - load) };
    });
    const sum = (k) => r1(days.reduce((s, d) => s + d[k], 0));
    const gross = sum("gross"), net = sum("net"), load = sum("load");
    const workDays = days.filter((d) => !d.bucket.off && d.gross > 0);
    // Vardiya: en sık görülen sayı; farklı günler ayrıca yazılır ("Cmt 1 vardiya")
    const count = new Map();
    workDays.forEach((d) => count.set(d.shifts, (count.get(d.shifts) ?? 0) + 1));
    const mode = [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
    const odd = workDays.filter((d) => d.shifts !== mode).map((d) => `${d.bucket.label} ${new Intl.NumberFormat("tr-TR").format(d.shifts)} vardiya`);
    return {
        days, gross, down: sum("down"), net, load, free: r1(net - load), pct: net ? Math.round((load / net) * 100) : 0,
        efficiency: efficiencyOf(c), shifts: new Intl.NumberFormat("tr-TR").format(mode), shiftNote: odd.join(", "),
        shiftHours: c.shiftHours ?? 8, workDays: workDays.length,
    };
}
/**
 * Tezgah çizimi (görsel yoksa): türe göre sade çizgi çizim, temanın renkleriyle; ışık durum renginde
 * (çalışıyor yeşil · uyarı amber · arızalı kırmızı · bakımda mavi · boşta gri).
 */
export function machineArt(kind = "generic", state = "idle", label = "") {
    const body = {
        cnc: '<rect x="6" y="10" width="36" height="30" rx="3"/><rect x="11" y="15" width="17" height="15" rx="2" class="bz-art__glass"/><path d="M19.5 15v6M17 21h5"/><rect x="31" y="15" width="7" height="10" rx="1.5" class="bz-art__panel"/><path d="M6 34h36M10 40v3M38 40v3"/>',
        lathe: '<path d="M4 34h40M7 34v8M41 34v8"/><rect x="6" y="18" width="10" height="16" rx="2"/><circle cx="20" cy="26" r="4" class="bz-art__panel"/><path d="M24 26h12"/><rect x="35" y="20" width="7" height="14" rx="1.5"/><rect x="24" y="29" width="8" height="5" rx="1" class="bz-art__glass"/>',
        press: '<path d="M10 6h28v6H10zM12 12v26M36 12v26M8 38h32v5H8z"/><rect x="16" y="14" width="16" height="9" rx="1.5" class="bz-art__panel"/><path d="M24 23v4M18 27h12"/><rect x="17" y="32" width="14" height="4" rx="1" class="bz-art__glass"/>',
        welding: '<path d="M10 42h16M18 42v-6"/><circle cx="18" cy="33" r="3" class="bz-art__panel"/><path d="M18 30 25 17l11 5"/><circle cx="25" cy="17" r="2.5"/><path d="M36 22l3 7M39 29l-2 3"/><path d="M38 34l1.5 2M41 33l1 2.5" class="bz-art__spark"/>',
        assembly: '<path d="M4 34h40"/><circle cx="9" cy="37" r="3"/><circle cx="19" cy="37" r="3"/><circle cx="29" cy="37" r="3"/><circle cx="39" cy="37" r="3"/><rect x="12" y="24" width="10" height="10" rx="1.5" class="bz-art__panel"/><rect x="26" y="26" width="8" height="8" rx="1.5" class="bz-art__glass"/><path d="M14 8h20v6H14zM24 14v8"/>',
        laser: '<path d="M6 12h36M6 12v28M42 12v28M4 40h40"/><rect x="18" y="10" width="10" height="7" rx="1.5" class="bz-art__panel"/><path d="M23 17v13" class="bz-art__spark"/><rect x="10" y="30" width="28" height="4" rx="1" class="bz-art__glass"/>',
        paint: '<path d="M8 40V14l16-7 16 7v26"/><rect x="15" y="20" width="18" height="14" rx="1.5" class="bz-art__glass"/><path d="M6 40h36M20 14h8"/><path d="M28 27c2 0 3-2 3-3" class="bz-art__spark"/>',
        generic: '<circle cx="24" cy="25" r="7" class="bz-art__panel"/><path d="M24 12v4M24 34v4M11 25h4M33 25h4M15 16l3 3M30 31l3 3M15 34l3-3M30 19l3-3"/><path d="M6 42h36"/>',
    };
    return `<svg class="bz-art" data-kind="${kind}" data-state="${state}" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${esc(label || kind)}">${body[kind] ?? body.generic}<circle cx="41" cy="7" r="3.2" class="bz-art__light"/></svg>`;
}
export const MACHINE_STATE = { run: "Çalışıyor", warn: "Uyarı", stop: "Arızalı", maint: "Bakımda", idle: "Boşta" };
const pctOf = (n) => `%${Math.round(n * 100)}`;
const picHtml = (c, cls) => c.image ? `<img class="${cls}" src="${esc(c.image)}" alt="${esc(c.label)}" loading="lazy" />` : `<span class="${cls}">${machineArt(c.kind, c.state ?? "idle", `${c.label} çizimi`)}</span>`;
/**
 * Tezgah kartı (ayrıntı): görsel, ad, model, durum, işlemler; vardiya, brüt / net kapasite, verim ve OEE kırılımı, yük;
 * gün gün tablo. Kapasite tahtasında tezgah adına tıklayınca açılır; tezgah listesi, andon gibi başka ekranlarda da kullanılır.
 */
export function machineCardHtml(c, buckets, orders = []) {
    const st = centerStats(c, buckets, orders);
    const kpi = (label, value, sub = "") => `<div class="bz-machine__kpi"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const bar = (label, v) => `<div class="bz-machine__oee-row"><span>${label}</span><span class="bz-machine__oee-bar" role="img" aria-label="${label} ${pctOf(v)}"><i style="width:${Math.round(v * 100)}%"></i></span><b>${pctOf(v)}</b></div>`;
    const day = (d) => new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    return `<div class="bz-machine">
    <div class="bz-machine__head">${picHtml(c, "bz-machine__pic")}<div class="bz-machine__title"><b>${esc(c.label)}</b>${c.model ? `<span>${esc(c.model)}</span>` : ""}${c.sub ? `<span>${esc(c.sub)}</span>` : ""}<span class="bz-machine__tags">${c.state ? `<span class="bz-state bz-chip--sm" data-state="${c.state}">${MACHINE_STATE[c.state]}</span>` : ""}${c.skills.map((k) => `<span class="bz-tag">${esc(k)}</span>`).join("")}</span></div></div>
    <div class="bz-machine__kpis">
      ${kpi("Vardiya", `${st.shifts} × ${hrs(st.shiftHours)}`, `${st.workDays} iş günü${st.shiftNote ? ` · ${st.shiftNote}` : ""}${c.crew ? ` · ${c.crew} operatör` : ""}`)}
      ${kpi("Net kapasite", hrs(st.net), `brüt ${hrs(st.gross)}${st.down ? ` · duruş ${hrs(st.down)}` : ""}`)}
      ${kpi("Verim (OEE)", pctOf(st.efficiency), c.oee ? "A × P × K" : "planlama katsayısı")}
      ${kpi("Planlı yük", `%${st.pct}`, `${hrs(st.load)} · ${st.free >= 0 ? `${hrs(st.free)} boş` : `${hrs(-st.free)} aşırı`}`)}
    </div>
    ${c.oee ? `<div class="bz-machine__oee">${bar("Kullanılabilirlik", c.oee.availability)}${bar("Performans", c.oee.performance)}${bar("Kalite", c.oee.quality)}</div>` : ""}
    <div class="bz-machine__days"><table class="bz-table bz-table--compact"><thead><tr><th>Gün</th><th class="is-num">Vardiya</th><th class="is-num">Brüt</th><th class="is-num">Duruş</th><th class="is-num">Net</th><th class="is-num">Planlı</th><th class="is-num">Boş</th></tr></thead><tbody>${st.days.map((d) => `<tr${d.bucket.off ? ' class="is-muted"' : d.free < 0 ? ' data-tone="danger"' : ""}><td>${esc(d.bucket.label)} <small>${day(d.bucket.date)}</small></td><td class="is-num">${d.bucket.off ? "—" : d.shifts}</td><td class="is-num">${d.bucket.off ? "kapalı" : hrs(d.gross)}</td><td class="is-num">${d.down ? hrs(d.down) : "—"}</td><td class="is-num">${hrs(d.net)}</td><td class="is-num">${d.load ? hrs(d.load) : "—"}</td><td class="is-num">${d.bucket.off ? "—" : d.free < 0 ? `<b>+${hrs(-d.free)}</b>` : hrs(d.free)}</td></tr>`).join("")}</tbody><tfoot><tr><td>Hafta</td><td></td><td class="is-num">${hrs(st.gross)}</td><td class="is-num">${st.down ? hrs(st.down) : "—"}</td><td class="is-num">${hrs(st.net)}</td><td class="is-num">${hrs(st.load)}</td><td class="is-num">${st.free < 0 ? `+${hrs(-st.free)}` : hrs(st.free)}</td></tr></tfoot></table></div>
  </div>`;
}
const cellLoad = (orders, c, b, except) => orders.filter((x) => x.center === c && x.bucket === b && x.id !== except).reduce((s, x) => s + x.hours, 0);
const stateOf = (load, cap, off) => (off ? "off" : load === 0 ? "free" : load > cap + 1e-9 ? "over" : load / cap >= 0.85 ? "high" : "ok");
/** Yük tablosu: hücre (kapasite, yük, boş), tezgah ve gün toplamları; aşırı yüklü hücre, gecikecek iş, havuz özeti */
export function capacityGrid(orders, centers, buckets) {
    const cells = new Map(), byC = new Map(), byB = new Map();
    centers.forEach((c) => buckets.forEach((b, bi) => {
        const list = orders.filter((o) => o.center === c.id && o.bucket === b.id);
        const cap = cellCapacity(c, b, bi), load = r1(list.reduce((s, o) => s + o.hours, 0));
        cells.set(cellKey(c.id, b.id), { cap, load, free: r1(cap - load), pct: cap ? Math.round((load / cap) * 100) : load ? 999 : 0, state: stateOf(load, cap, b.off), orders: list, down: (c.down ?? []).filter((d) => d.bucket === b.id) });
    }));
    const sum = (keys) => { const cap = r1(keys.reduce((s, k) => s + cells.get(k).cap, 0)), load = r1(keys.reduce((s, k) => s + cells.get(k).load, 0)); return { cap, load, pct: cap ? Math.round((load / cap) * 100) : 0 }; };
    centers.forEach((c) => byC.set(c.id, sum(buckets.map((b) => cellKey(c.id, b.id)))));
    buckets.forEach((b) => byB.set(b.id, sum(centers.map((c) => cellKey(c.id, b.id)))));
    const pool = orders.filter((o) => !planned(o));
    const total = sum([...cells.keys()]);
    return {
        cells, centers: byC, buckets: byB,
        total: { ...total, over: [...cells.values()].filter((x) => x.state === "over").length, late: orders.filter(planned).filter((o) => { const b = buckets.find((x) => x.id === o.bucket); return b && capLate(o, b); }).length, pool: pool.length, poolHours: r1(pool.reduce((s, o) => s + o.hours, 0)) },
    };
}
/**
 * Bırakma denetimi: yapamaz / kapalı / geçmiş gün → engel; aşırı yük ya da termin sonrası → uyarı (bırakılabilir, işaretlenir).
 * free: iş eklenmeden önce hücrede kalan boş saat; fits: iş tamamen sığıyor mu.
 */
export function capacityCheck(o, c, b, bi, orders, today) {
    const cap = cellCapacity(c, b, bi), free = r1(cap - cellLoad(orders, c.id, b.id, o.id));
    if (!canRun(o, c))
        return { level: "bad", reasons: [`${c.label} "${o.skill}" işlemini yapamaz`], pctAfter: 0, free, fits: false };
    if (b.off)
        return { level: "bad", reasons: [`${b.label}: kapalı gün`], pctAfter: 0, free, fits: false };
    if (isPast(b, today))
        return { level: "bad", reasons: [`${b.label}: geçmiş gün`], pctAfter: 0, free, fits: false };
    const load = cap - free + o.hours;
    const pctAfter = cap ? Math.round((load / cap) * 100) : 999;
    const reasons = [];
    if (load > cap + 1e-9)
        reasons.push(`sığmıyor: +${hrs(r1(load - cap))} aşırı (%${pctAfter})`);
    if (capLate(o, b))
        reasons.push(`termin ${new Date(o.due).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} — ${Math.round((+new Date(b.date) - +new Date(o.due)) / 86_400_000)} gün gecikir`);
    return { level: reasons.length ? "warn" : "ok", reasons, pctAfter, free, fits: load <= cap + 1e-9 };
}
/**
 * Günlere yay: işi tezgahta fromIndex gününden başlayarak her günün boş kapasitesini doldurarak parçalara böler
 * (kapalı / geçmiş gün atlanır). Dönem bitince kalan saat havuzda bir parça olarak kalır. Parça kimlikleri kalıcıdır
 * ("asıl~1", "asıl~2"…), sıra numaraları (n / total) güne göre yeniden verilir. Bölünecek yer yoksa değişiklik olmaz.
 */
export function capacitySplit(orders, id, center, buckets, fromIndex = 0, o = {}) {
    const w = orders.find((x) => x.id === id);
    if (!w || !canRun(w, center))
        return { orders, parts: [], rest: w?.hours ?? 0 };
    const others = orders.filter((x) => x.id !== id);
    const root = rootOf(w), minChunk = o.minChunk ?? 0.5;
    const chunks = [];
    let left = w.hours;
    for (let bi = fromIndex; bi < buckets.length && left > 1e-9; bi++) {
        const b = buckets[bi];
        if (b.off || isPast(b, o.today))
            continue;
        const free = r1(cellCapacity(center, b, bi) - cellLoad(others, center.id, b.id));
        if (free < minChunk)
            continue;
        const take = r1(Math.min(left, free));
        chunks.push({ bucket: b.id, hours: take });
        left = r1(left - take);
    }
    if (!chunks.length || (chunks.length === 1 && left <= 1e-9 && !w.part)) {
        // Tek parçaya sığıyorsa bölmeye gerek yok: doğrudan oraya yerleşir
        if (chunks.length === 1)
            return { orders: orders.map((x) => (x.id === id ? { ...x, center: center.id, bucket: chunks[0].bucket } : x)), parts: [id], rest: 0 };
        return { orders, parts: [], rest: w.hours };
    }
    const used = new Set(others.filter((x) => rootOf(x) === root).map((x) => x.id));
    let k = 1;
    const nextId = () => { while (used.has(`${root}~${k}`))
        k++; used.add(`${root}~${k}`); return `${root}~${k}`; };
    const base = { ...w };
    delete base.part;
    const made = chunks.map((ch, i) => ({ ...base, id: i === 0 && w.part ? w.id : nextId(), hours: ch.hours, center: center.id, bucket: ch.bucket, part: { of: root, n: 0, total: 0 } }));
    if (left > 1e-9)
        made.push({ ...base, id: nextId(), hours: left, center: null, bucket: null, part: { of: root, n: 0, total: 0 } });
    return { orders: renumber([...others, ...made], root, buckets), parts: made.map((x) => x.id), rest: left };
}
/** Parçaların sırasını güne göre (havuzdakiler sonda) yeniden numaralar */
function renumber(orders, root, buckets) {
    const idx = (o) => (o.bucket ? buckets.findIndex((b) => b.id === o.bucket) : 1e6);
    const parts = orders.filter((x) => x.part?.of === root).sort((a, b) => idx(a) - idx(b));
    if (parts.length === 1)
        return orders.map((x) => (x === parts[0] ? { ...x, id: x.id, part: undefined } : x));
    const pos = new Map(parts.map((p, i) => [p, i + 1]));
    return orders.map((x) => (pos.has(x) ? { ...x, part: { of: root, n: pos.get(x), total: parts.length } } : x));
}
/** Parçaları birleştir: aynı işin bütün parçaları tek iş emri olarak havuza döner (saatler toplanır) */
export function capacityMerge(orders, root) {
    const parts = orders.filter((x) => x.part?.of === root);
    if (!parts.length)
        return orders;
    const merged = { ...parts[0], id: root, hours: r1(parts.reduce((s, x) => s + x.hours, 0)), center: null, bucket: null };
    delete merged.part;
    return [...orders.filter((x) => x.part?.of !== root), merged];
}
export const CAP_STATUS = {
    planned: { label: "Planlandı", badge: "draft" }, released: { label: "Serbest", badge: "approved" }, running: { label: "Çalışıyor", badge: "progress" },
    hold: { label: "Beklemede", badge: "pending" }, done: { label: "Bitti", badge: "done" },
};
const MATERIAL = { ok: { label: "Malzeme hazır", level: "ok" }, partial: { label: "Malzeme kısmi", level: "low" }, missing: { label: "Malzeme yok", level: "out" } };
/**
 * İş emri ayrıntısı (kapasite tahtasında karta tıklayınca; başka ekranlarda da kullanılır): kimlik ve rozetler (durum, öncelik,
 * termin, malzeme), planlandığı yer ve o günün doluluğu, süre (hazırlık + işleme), miktar, işlem, sipariş / müşteri,
 * işi yapabilen tezgahlar, ilerleme, rota, parçalar, not. Tüm metin kaçırılır.
 */
export function capOrderDetailHtml(w, ctx) {
    const d = (x) => new Date(x).toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" });
    const b = ctx.buckets.find((x) => x.id === w.bucket), bi = ctx.buckets.findIndex((x) => x.id === w.bucket), c = ctx.centers.find((x) => x.id === w.center);
    const late = !!b && capLate(w, b);
    const daysLeft = w.due && ctx.today ? Math.round((+new Date(w.due) - +new Date(ctx.today)) / 86_400_000) : null;
    const dueChip = w.due ? (late ? `<span class="bz-due" data-state="overdue">${Math.round((+new Date(b.date) - +new Date(w.due)) / 86_400_000)} gün geç</span>` : daysLeft !== null && daysLeft <= 2 ? `<span class="bz-due" data-state="soon">${daysLeft <= 0 ? "Termin bugün" : `${daysLeft} gün kaldı`}</span>` : `<span class="bz-due">Termin ${d(w.due)}</span>`) : "";
    const chips = [
        w.status ? `<span class="bz-status" data-status="${CAP_STATUS[w.status].badge}">${CAP_STATUS[w.status].label}</span>` : "",
        w.priority && w.priority !== "normal" ? `<span class="bz-priority" data-level="${w.priority}"><i></i><i></i><i></i>${PRIORITY_TEXT[w.priority]}</span>` : "",
        dueChip,
        w.material ? `<span class="bz-stock" data-level="${MATERIAL[w.material].level}">${MATERIAL[w.material].label}</span>` : "",
        w.locked ? '<span class="bz-tag" data-tone="outline">Kilitli</span>' : "",
    ].join("");
    const fact = (k, v, small = "") => `<div><dt>${k}</dt><dd>${v}${small ? `<small>${small}</small>` : ""}</dd></div>`;
    const run = w.setupHours !== undefined ? r1(w.hours - w.setupHours) : null;
    const able = ctx.centers.filter((x) => canRun(w, x)).map((x) => esc(x.label));
    let fit = "";
    if (c && b) {
        const cap = cellCapacity(c, b, bi), load = cellLoad(ctx.orders, c.id, b.id), free = r1(cap - load), pct = cap ? Math.round((load / cap) * 100) : 0;
        fit = `<div class="bz-capdetail__fit" data-state="${stateOf(load, cap, b.off)}"><span>${esc(c.label)} · ${esc(b.label)} günü: <b>%${pct} dolu</b> · ${free < 0 ? `<b class="bz-capdetail__over">${hrs(-free)} aşırı</b>` : `${hrs(free)} boş`}</span><span class="bz-capmeter" data-state="${stateOf(load, cap, b.off)}"><i style="width:${Math.min(100, cap ? (load / cap) * 100 : 0)}%"></i></span></div>`;
    }
    const parts = w.part ? ctx.orders.filter((x) => x.part?.of === w.part.of).sort((x, y) => x.part.n - y.part.n) : [];
    return `<div class="bz-capdetail">
    <div class="bz-capdetail__head"><span class="bz-capdetail__no">${esc(w.label)}${w.part ? ` · parça ${w.part.n}/${w.part.total}` : ""}</span><b class="bz-capdetail__title">${esc(w.product ?? w.sub ?? w.label)}</b>${w.operation || w.qty ? `<span class="bz-capdetail__sub">${[w.operation, w.qty !== undefined ? `${new Intl.NumberFormat("tr-TR").format(w.qty)} ${w.unit ?? "adet"}` : ""].filter(Boolean).map(esc).join(" · ")}</span>` : ""}</div>
    ${chips ? `<div class="bz-capdetail__chips">${chips}</div>` : ""}
    ${w.status === "running" || w.progress ? `<div class="bz-capdetail__progress"><span>İlerleme</span><span class="bz-progress" role="progressbar" aria-label="İlerleme" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((w.progress ?? 0) * 100)}"><span style="--value:${Math.round((w.progress ?? 0) * 100)}%"></span></span><b>%${Math.round((w.progress ?? 0) * 100)}</b></div>` : ""}
    <dl class="bz-capdetail__facts">
      ${fact("Planlandığı yer", c && b ? `${esc(c.label)} · ${d(b.date)}` : "Havuzda")}
      ${fact("Süre", hrs(w.hours), run !== null ? `hazırlık ${hrs(w.setupHours)} + işleme ${hrs(run)}` : "")}
      ${w.qty !== undefined ? fact("Miktar", `${new Intl.NumberFormat("tr-TR").format(w.qty)} ${esc(w.unit ?? "adet")}`, w.qty && w.hours ? `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(w.qty / Math.max(0.1, run ?? w.hours))} / sa` : "") : ""}
      ${fact("İşlem", esc(w.skill), w.operation ? esc(w.operation) : "")}
      ${w.due ? fact("Termin", d(w.due), late ? "bu planla gecikecek" : daysLeft !== null ? (daysLeft < 0 ? `${-daysLeft} gün geçti` : daysLeft === 0 ? "bugün" : `${daysLeft} gün kaldı`) : "") : ""}
      ${w.order ? fact("Sipariş", esc(w.order), w.customer ? esc(w.customer) : "") : w.customer ? fact("Müşteri", esc(w.customer)) : ""}
      ${fact("Yapabilen tezgahlar", able.join(", ") || "yok")}
      ${w.material && w.materialNote ? fact("Malzeme", esc(MATERIAL[w.material].label), esc(w.materialNote)) : ""}
    </dl>
    ${fit}
    ${w.routing?.length ? `<div class="bz-capdetail__block"><span class="bz-capdetail__label">Rota</span><ol class="bz-capdetail__route">${w.routing.map((r) => `<li data-state="${r.state ?? "todo"}"${r.state === "current" ? ' aria-current="step"' : ""}><span>${esc(r.op)}</span>${r.center ? `<small>${esc(r.center)}</small>` : ""}</li>`).join("")}</ol></div>` : ""}
    ${parts.length ? `<div class="bz-capdetail__block"><span class="bz-capdetail__label">Parçalar</span><ul class="bz-capdetail__parts">${parts.map((x) => { const pb = ctx.buckets.find((y) => y.id === x.bucket), pc = ctx.centers.find((y) => y.id === x.center); return `<li${x.id === w.id ? ' aria-current="true"' : ""}><b>${x.part.n}/${x.part.total}</b><span>${pc && pb ? `${esc(pc.label)} · ${d(pb.date)}` : "havuzda"}</span><span>${hrs(x.hours)}</span></li>`; }).join("")}</ul></div>` : ""}
    ${w.note ? `<p class="bz-capdetail__note">${esc(w.note)}</p>` : ""}
  </div>`;
}
const PR = { urgent: 0, high: 1, normal: 2 };
/**
 * Otomatik yerleştirme (sonlu kapasite, ileri): önce öncelik, sonra termin, sonra uzun iş. Her iş en erken günde işlemi
 * yapabilen ve **sığan** tezgaha (eşitlikte en boş olana) yerleşir. Hiçbir güne tek parça sığmıyorsa ve split açıksa
 * günlere yayılır (en erken bitireceği tezgahta). Sığmayan havuzda kalır. Planlı ve kilitli işlere dokunulmaz;
 * fromDate'ten önceki günler kullanılmaz. only verilirse yalnız o işler yerleştirilir.
 */
export function capacityAutoSchedule(orders, centers, buckets, o = {}) {
    let next = orders.map((x) => ({ ...x }));
    const placed = [], late = [], unplaced = [], split = [];
    const queue = next.filter((x) => !planned(x) && (!o.only || o.only.has(x.id))).sort((a, b) => PR[a.priority ?? "normal"] - PR[b.priority ?? "normal"] || (a.due ?? "9999").localeCompare(b.due ?? "9999") || b.hours - a.hours).map((x) => x.id);
    for (const id of queue) {
        const w = next.find((x) => x.id === id);
        let best = null;
        for (let bi = 0; bi < buckets.length && !best; bi++) {
            const b = buckets[bi];
            if (b.off || (o.fromDate && b.date < o.fromDate))
                continue;
            const fits = centers.filter((c) => canRun(w, c)).map((c) => ({ c, b, free: cellCapacity(c, b, bi) - cellLoad(next, c.id, b.id) })).filter((x) => x.free >= w.hours - 1e-9).sort((x, y) => y.free - x.free);
            if (fits.length)
                best = fits[0];
        }
        if (best) {
            w.center = best.c.id;
            w.bucket = best.b.id;
            placed.push(id);
            if (capLate(w, best.b))
                late.push(id);
            continue;
        }
        if (o.split) {
            // En erken bitiren tezgah: her uygun tezgahta yaymayı dene, kalanı en az ve son günü en erken olanı seç
            const tries = centers.filter((c) => canRun(w, c)).map((c) => ({ c, r: capacitySplit(next, id, c, buckets, 0, { today: o.fromDate }) })).filter((t) => t.r.parts.length);
            const lastDay = (t) => Math.max(...t.r.orders.filter((x) => t.r.parts.includes(x.id) && x.bucket).map((x) => buckets.findIndex((b) => b.id === x.bucket)));
            tries.sort((a, b) => a.r.rest - b.r.rest || lastDay(a) - lastDay(b));
            const t = tries[0];
            if (t && t.r.rest < w.hours - 1e-9) {
                next = t.r.orders;
                split.push(id);
                placed.push(...t.r.parts.filter((p) => planned(next.find((x) => x.id === p))));
                const parts = next.filter((x) => t.r.parts.includes(x.id));
                if (t.r.rest > 1e-9 || parts.some((x) => { const b = buckets.find((y) => y.id === x.bucket); return b && capLate(x, b); }))
                    late.push(id);
                continue;
            }
        }
        unplaced.push(id);
    }
    return { orders: next, placed, late, unplaced, split };
}
/**
 * Dengele: aşırı yüklü her hücreden taşmayı bitirecek kadar iş çıkarır (kilitliye dokunmaz; önce termini en geç olan,
 * eşitlikte küçük olan) ve bunları otomatik yerleştirmeyle **bütün olarak** başka gün / tezgaha koyar (bölmez). Başka yere
 * sığmayan iş eski yerinde kalır (aşırı yük sürer, söylenir; gerekirse kullanıcı "Günlere yay" der).
 */
export function capacityBalance(orders, centers, buckets, o = {}) {
    let next = orders.map((x) => ({ ...x }));
    const removed = new Map();
    centers.forEach((c) => buckets.forEach((b, bi) => {
        const cap = cellCapacity(c, b, bi);
        let load = cellLoad(next, c.id, b.id);
        if (load <= cap + 1e-9)
            return;
        const movable = next.filter((x) => x.center === c.id && x.bucket === b.id && !x.locked).sort((a, z) => (z.due ?? "9999").localeCompare(a.due ?? "9999") || a.hours - z.hours);
        for (const w of movable) {
            if (load <= cap + 1e-9)
                break;
            removed.set(w.id, { center: c.id, bucket: b.id });
            w.center = null;
            w.bucket = null;
            load -= w.hours;
        }
    }));
    if (!removed.size)
        return { orders, moved: [], kept: [] };
    // Dengeleme işi bölmez: iş bütün olarak başka yere sığmıyorsa yerinde kalır (parçası havuza düşmesin)
    const r = capacityAutoSchedule(next, centers, buckets, { fromDate: o.fromDate, only: new Set(removed.keys()) });
    next = r.orders;
    const kept = [];
    for (const [id, at] of removed) {
        const w = next.find((x) => x.id === id);
        if (w && !planned(w)) {
            w.center = at.center;
            w.bucket = at.bucket;
            kept.push(id);
        }
    }
    return { orders: next, moved: [...removed.keys()].filter((id) => !kept.includes(id)), kept };
}
const PRIORITY_TEXT = { normal: "Normal", high: "Yüksek", urgent: "Acil" };
const CI = {
    pool: SVG('<path d="M4 7h16M4 12h16M4 17h10"/>'),
    auto: SVG('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><circle cx="12" cy="12" r="3"/>'),
    balance: SVG('<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0L6 8ZM18 8l-3 6a3 3 0 0 0 6 0l-3-6Z"/>'),
    undo: SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
    split: SVG('<path d="M4 12h5M15 12h5M9 7v10M15 7v10"/>'),
    merge: SVG('<path d="M4 7l6 5-6 5M20 7l-6 5 6 5"/>'),
    next: SVG('<path d="m9 6 6 6-6 6"/>'),
    prev: SVG('<path d="m15 6-6 6 6 6"/>'),
    move: SVG('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    flag: SVG('<path d="M5 21V4h11l-2 4 2 4H5"/>'),
    box: SVG('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
    info: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>'),
    lock: I.lock, unlock: I.unlock, open: I.open, wrench: I.wrench, alert: I.alert,
};
/**
 * Tezgah bazlı kapasite planlama tahtası. Solda planlanmamış iş emirleri havuzu (ara, işleme göre süz, termin / öncelik /
 * süreye göre sırala); sağda tezgah × gün ızgarası, başlık yapışkan, bugün vurgulu, geçmiş günler kilitli. Hücrede boş saat
 * ("1,2 sa boş" · "+2,8 sa aşırı") ve doluluk çubuğu.
 *
 * Taşıma: iş emri sürüklenince (fare, dokunma) ya da klavyeyle alınınca bütün ızgara **önizleme** moduna geçer: uygun
 * hücreler yeşil (sığar) ya da amber (sığmaz / gecikir), yapamayan tezgah, kapalı ve geçmiş gün soluk-taralı; termin
 * günü başlıkta bayrakla, sonrası amber. Sığmayan yere Shift ile bırakmak işi o tezgahta **günlere yayar**.
 * İş emri ayrıntısı: karta tıkla / Enter / sağ tık → pencere (durum, ilerleme, süre, miktar, malzeme, rota, gün yükü, parçalar)
 * ve hızlı eylemler. Klavye: Boşluk al → oklar → Enter bırak (Shift+Enter yay), Esc vazgeç; Alt+←/→ bir gün kaydır; Sil havuza al; ⌘Z geri al.
 * Sağ tık / basılı tut: en erken uygun güne planla, bir gün ileri / geri, günlere yay, parçaları birleştir, başka tezgaha
 * taşı, havuza al, kilitle, ayrıntı. Araç çubuğu: dönem (önceki / bugün / sonraki), Otomatik yerleştir (uzun işi böler),
 * Dengele (aşırı yükü dağıt), Geri al, Sıkı / Rahat görünüm, Tümünü havuza al. onChange / onBatch false dönerse geri alınır.
 */
export function bizmoCapacityBoard(host, o) {
    let orders = o.orders.map((x) => ({ ...x }));
    let buckets = o.buckets;
    let poolQ = "", poolSkill = "", poolSort = "due";
    let density = o.density ?? "compact";
    let grab = null;
    let moving = null;
    let pop = null;
    let justDragged = 0;
    const history = [];
    const C = (id) => o.centers.find((c) => c.id === id);
    const B = (id) => buckets.find((b) => b.id === id);
    const bIndex = (id) => buckets.findIndex((b) => b.id === id);
    const byId = (id) => orders.find((x) => x.id === id);
    const day = (d) => new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
    const check = (w, c, b) => capacityCheck(w, c, b, bIndex(b.id), orders, o.today);
    const card = (w) => {
        const b = B(w.bucket), late = !!b && capLate(w, b);
        const due = w.due ? (late ? `${Math.round((+new Date(b.date) - +new Date(w.due)) / 86_400_000)} gün geç` : `Termin ${day(w.due)}`) : "";
        const where = w.center && b ? `${C(w.center)?.label} · ${b.label} ${day(b.date)}` : "havuzda";
        const aria = `${capLabel(w)}${w.sub ? ` · ${w.sub}` : ""} · ${hrs(w.hours)} · ${w.skill} · ${where}${w.due ? ` · termin ${day(w.due)}` : ""}${late ? " · gecikecek" : ""}${w.priority && w.priority !== "normal" ? ` · öncelik ${PRIORITY_TEXT[w.priority]}` : ""}${w.status ? ` · ${CAP_STATUS[w.status].label}${w.progress ? ` %${Math.round(w.progress * 100)}` : ""}` : ""}${w.material && w.material !== "ok" ? ` · ${MATERIAL[w.material].label}` : ""}${w.locked ? " · kilitli" : ""} · ayrıntı için Enter, taşımak için Boşluk`;
        return `<li><button type="button" class="bz-capcard" data-id="${esc(w.id)}" aria-haspopup="dialog"${w.priority && w.priority !== "normal" ? ` data-priority="${w.priority}"` : ""}${late ? ' data-late="true"' : ""}${w.locked ? ' data-locked="true"' : ""}${w.part ? ' data-part="true"' : ""}${grab?.id === w.id || moving === w.id ? ' data-grabbed="true"' : ""} aria-label="${esc(aria)}" title="${esc(aria)}">
      <span class="bz-capcard__top"><b>${esc(w.label)}</b>${w.part ? `<span class="bz-capcard__part">${w.part.n}/${w.part.total}</span>` : ""}${w.locked || late || (w.status === "running" && !w.progress) || (w.material && w.material !== "ok") ? `<span class="bz-capcard__flags">${w.status === "running" && !w.progress ? `<span class="bz-capcard__run" title="Çalışıyor">${I.play}</span>` : ""}${w.material && w.material !== "ok" ? `<span class="bz-capcard__mat" data-level="${w.material}" title="${MATERIAL[w.material].label}">${CI.box}</span>` : ""}${w.locked ? CI.lock : ""}${late ? CI.alert : ""}</span>` : ""}<span class="bz-capcard__hours">${hrs(w.hours)}</span></span>
      ${w.sub ? `<span class="bz-capcard__sub">${esc(w.sub)}</span>` : ""}
      <span class="bz-capcard__meta"><span class="bz-capcard__skill">${esc(w.skill)}</span>${due ? `<span class="bz-capcard__due">${esc(due)}</span>` : ""}</span>
      ${w.progress ? `<span class="bz-capcard__progress" aria-hidden="true"><i style="width:${Math.round(w.progress * 100)}%"></i></span>` : ""}
    </button></li>`;
    };
    /** Pencere (tezgah kartı / iş emri ayrıntısı): tetikleyicinin yanında (dar ekranda alttan); dışarı tık / Esc kapatır, odak geri döner */
    const popAnchor = (kind, id) => host.querySelector(kind === "machine" ? `[data-machine="${CSS.escape(id)}"]` : `.bz-capcard[data-id="${CSS.escape(id)}"]`);
    function closePop(refocus = false) {
        if (!pop)
            return;
        const p = pop;
        pop = null;
        p.off();
        p.el.remove();
        const a = popAnchor(p.kind, p.id);
        a?.setAttribute("aria-expanded", "false");
        if (refocus)
            a?.focus();
    }
    function openPop(kind, id, anchor, label, html, wire) {
        const same = pop?.kind === kind && pop.id === id;
        closePop();
        if (same)
            return;
        const el = document.createElement("div");
        el.className = "bz-popover bz-capboard__pop";
        el.dataset.kind = kind;
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", label);
        el.innerHTML = `<button type="button" class="bz-icon-btn bz-icon-btn--sm bz-capboard__popclose" aria-label="Kapat">${SVG('<path d="M18 6 6 18M6 6l12 12"/>')}</button>${html}`;
        document.body.append(el);
        const narrow = innerWidth < 640;
        el.dataset.sheet = String(narrow);
        if (!narrow) {
            const r = anchor.getBoundingClientRect(), w = el.offsetWidth;
            const left = r.right + 10 + w <= innerWidth - 8 ? r.right + 10 : Math.max(8, r.left - w - 10);
            el.style.left = `${left}px`;
            el.style.top = `${Math.max(8, Math.min(r.top - 8, innerHeight - el.offsetHeight - 8))}px`;
        }
        anchor.setAttribute("aria-expanded", "true");
        const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target))
            closePop(); };
        const key = (e) => { if (e.key === "Escape") {
            e.stopPropagation();
            closePop(true);
        } };
        setTimeout(() => document.addEventListener("pointerdown", outside), 0);
        document.addEventListener("keydown", key, true);
        el.querySelector(".bz-capboard__popclose").addEventListener("click", () => closePop(true));
        pop = { kind, id, el, off: () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key, true); } };
        wire?.(el);
        el.querySelector(".bz-capboard__popclose")?.focus();
    }
    const openMachine = (id, btn) => { const c = C(id); openPop("machine", id, btn, `${c.label} tezgah kartı`, machineCardHtml(c, buckets, orders)); };
    /** İş emri ayrıntısı + hızlı eylemler (en erken yere, bir gün geri / ileri, günlere yay, birleştir, havuza al, kilitle, uygulamada aç) */
    function openOrder(id, anchor) {
        const w = byId(id);
        if (!w)
            return;
        const ro = !!o.readOnly || !!w.locked;
        const best = earliestFor(w);
        const bestAt = best?.orders.find((x) => x.id === w.id || (x.part?.of === rootOf(w) && planned(x)));
        const c = C(w.center), bi = bIndex(w.bucket);
        const btn = (act, text, icon, dis = false, primary = false) => `<button type="button" class="bz-btn bz-btn--sm${primary ? " bz-btn--primary" : ""}" data-oact="${act}"${dis ? " disabled" : ""}>${icon}${text}</button>`;
        const here = !!bestAt && !best.split.length && bestAt.center === w.center && bestAt.bucket === w.bucket;
        const hint = here ? `<p class="bz-capdetail__hint">${CI.auto}<span>Şu anki yeri zaten en erken uygun yer.</span></p>`
            : best && bestAt?.center ? `<p class="bz-capdetail__hint">${CI.auto}<span>En erken uygun yer: <b>${esc(C(bestAt.center)?.label ?? "")} · ${esc(B(bestAt.bucket)?.label ?? "")} ${day(B(bestAt.bucket).date)}</b>${best.split.length ? " (günlere yayarak)" : ""}${best.late.length ? " · gecikecek" : ""}</span></p>`
                : !planned(w) ? `<p class="bz-capdetail__hint">${CI.alert}<span>Bu dönemde uygun boş kapasite yok.</span></p>` : "";
        const actions = o.readOnly ? hint : `<div class="bz-capdetail__actions">
      ${hint}
      ${btn("best", planned(w) ? "En erken yere taşı" : "Planla", CI.auto, ro || !best || here, !planned(w))}
      ${planned(w) ? btn("prev", "1 gün geri", CI.prev, ro || bi <= 0) + btn("next", "1 gün ileri", CI.next, ro || bi >= buckets.length - 1) : ""}
      ${btn("spread", "Günlere yay", CI.split, ro || w.hours <= 0.5)}
      ${w.part ? btn("merge", "Birleştir", CI.merge, !!o.readOnly) : ""}
      ${planned(w) ? btn("pool", "Havuza al", CI.pool, ro) : ""}
      ${btn("lock", w.locked ? "Kilidi aç" : "Kilitle", w.locked ? CI.unlock : CI.lock, !!o.readOnly)}
    </div>`;
        const openBtn = o.onOpen ? `<button type="button" class="bz-icon-btn bz-icon-btn--sm bz-capboard__popopen" data-oact="open" aria-label="Uygulamada aç" title="Uygulamada aç">${CI.open}</button>` : "";
        openPop("order", id, anchor, `${capLabel(w)} iş emri ayrıntısı`, openBtn + capOrderDetailHtml(w, { centers: o.centers, buckets, orders, today: o.today }) + actions, (el) => {
            el.addEventListener("click", (e) => {
                const a = e.target.closest("[data-oact]")?.dataset.oact;
                if (!a)
                    return;
                closePop();
                if (a === "best" && best)
                    batch(best.orders, `${w.label} en erken uygun yere planlandı${best.split.length ? " (günlere yayıldı)" : ""}`, { focus: bestAt?.id });
                else if (a === "prev" || a === "next") {
                    const nb = buckets[bi + (a === "next" ? 1 : -1)];
                    if (nb && c)
                        move(w, c.id, nb.id);
                }
                else if (a === "spread") {
                    const at = c ?? o.centers.find((x) => canRun(w, x));
                    if (at)
                        spread(w, at, Math.max(0, bi));
                }
                else if (a === "merge" && w.part)
                    batch(capacityMerge(orders, w.part.of), `${w.label} parçaları birleştirildi; havuzda`);
                else if (a === "pool")
                    move(w, null, null);
                else if (a === "lock")
                    batch(orders.map((x) => (x.id === w.id ? { ...x, locked: !x.locked } : x)), w.locked ? `${capLabel(w)} kilidi açıldı` : `${capLabel(w)} kilitlendi`, { focus: w.id });
                else if (a === "open")
                    o.onOpen?.(w);
            });
        });
    }
    function render(focus) {
        closePop();
        const keepX = host.querySelector(".bz-capboard__scroll")?.scrollLeft ?? 0, keepY = host.querySelector(".bz-capboard__scroll")?.scrollTop ?? 0, keepP = host.querySelector(".bz-capboard__list")?.scrollTop ?? 0;
        const g = capacityGrid(orders, o.centers, buckets);
        const M = moving ? orders.find((x) => x.id === moving) : null;
        const skills = [...new Set(orders.filter((x) => !planned(x)).map((x) => x.skill))];
        const sorter = {
            due: (a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || PR[a.priority ?? "normal"] - PR[b.priority ?? "normal"],
            priority: (a, b) => PR[a.priority ?? "normal"] - PR[b.priority ?? "normal"] || (a.due ?? "9999").localeCompare(b.due ?? "9999"),
            hours: (a, b) => b.hours - a.hours,
        };
        const pool = orders.filter((x) => !planned(x))
            .filter((x) => (!poolSkill || x.skill === poolSkill) && (!poolQ || `${x.label} ${x.sub ?? ""}`.toLocaleLowerCase("tr-TR").includes(poolQ)))
            .sort(sorter[poolSort]);
        const t = g.total;
        const kpi = (label, value, tone = "") => `<div class="bz-capboard__kpi"${tone ? ` data-tone="${tone}"` : ""}><span>${label}</span><b>${value}</b></div>`;
        const meter = (cap, load, state) => `<span class="bz-capmeter" data-state="${state}"><i style="width:${Math.min(100, cap ? (load / cap) * 100 : 0)}%"></i></span>`;
        const head = buckets.map((b) => {
            const s = g.buckets.get(b.id), past = isPast(b, o.today), isToday = b.date === o.today;
            const dueMark = M?.due ? (b.date === M.due ? "due" : b.date > M.due ? "after" : "") : "";
            return `<div class="bz-capboard__day" role="columnheader"${b.off ? ' data-off="true"' : ""}${past ? ' data-past="true"' : ""}${isToday ? ' data-today="true"' : ""}${dueMark ? ` data-due="${dueMark}"` : ""}>
        <span class="bz-capboard__dayname"><b>${esc(b.label)}</b>${isToday ? '<i class="bz-capboard__todaytag">Bugün</i>' : ""}${dueMark === "due" ? `<i class="bz-capboard__duetag">${CI.flag}Termin</i>` : ""}</span>
        <span>${esc(b.sub ?? day(b.date))}${b.off ? " · kapalı" : past ? " · geçti" : ` · %${s.pct}`}</span>${b.off ? "" : meter(s.cap, s.load, stateOf(s.load, s.cap))}</div>`;
        }).join("");
        const rows = o.centers.map((c, ci) => {
            const s = g.centers.get(c.id), can = M ? canRun(M, c) : true;
            const st = centerStats(c, buckets, orders);
            const label = `<div class="bz-capboard__center" role="rowheader"${M && !can ? ' data-fit="bad"' : ""}>
        <button type="button" class="bz-capboard__machine" data-machine="${esc(c.id)}" aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(`${c.label} tezgah kartı${c.state ? ` · ${MACHINE_STATE[c.state]}` : ""}`)}">
          ${picHtml(c, "bz-capboard__pic")}
          <span class="bz-capboard__mtext"><b>${esc(c.label)}</b>${c.model || c.sub ? `<span class="bz-capboard__csub">${esc(c.model ?? c.sub)}</span>` : ""}${c.state ? `<span class="bz-capboard__mstate" data-state="${c.state}"><i></i>${MACHINE_STATE[c.state]}</span>` : ""}</span>
        </button>
        <span class="bz-capboard__skills-mini">${c.skills.map((k) => `<i${M && M.skill === k ? ' data-match="true"' : ""}>${esc(k)}</i>`).join("")}</span>
        <span class="bz-capboard__specs"><span title="${esc(`Vardiya × süre${st.shiftNote ? ` (${st.shiftNote})` : ""}${c.crew ? ` · ${c.crew} operatör` : ""}`)}">${st.shifts} × ${hrs(st.shiftHours)}</span><span title="Verim (OEE)">OEE %${Math.round(st.efficiency * 100)}</span><span title="Haftalık net kapasite (brüt ${hrs(st.gross)})">${hrs(st.net)} net</span></span>
        <span class="bz-capboard__cpct" data-state="${stateOf(s.load, s.cap)}">%${s.pct} dolu · ${hrs(s.load)} / ${hrs(s.cap)}</span>${meter(s.cap, s.load, stateOf(s.load, s.cap))}
      </div>`;
            const cells = buckets.map((b, bi) => {
                const cell = g.cells.get(cellKey(c.id, b.id));
                const past = isPast(b, o.today);
                const fit = M ? check(M, c, b) : null;
                const fitLevel = fit ? (fit.level === "bad" ? "bad" : fit.fits && fit.level === "ok" ? "ok" : "warn") : "";
                const target = grab && grab.ci === ci && grab.bi === bi;
                const freeText = b.off ? "Kapalı" : past ? "geçti" : cell.free < -1e-9 ? `+${hrs(r1(-cell.free))} aşırı` : cell.free < 0.05 ? "dolu" : `${hrs(cell.free)} boş`;
                const aria = `${c.label} · ${b.label} ${day(b.date)} · ${b.off ? "kapalı" : `${hrs(cell.load)} / ${hrs(cell.cap)} (%${cell.pct}) · ${freeText}`} · ${cell.orders.length} iş${fit ? ` · ${fit.level === "bad" ? "bırakılamaz" : fit.fits ? "sığar" : "sığmaz"}` : ""}`;
                return `<div class="bz-capboard__cell" role="gridcell" data-center="${esc(c.id)}" data-bucket="${esc(b.id)}" data-state="${cell.state}"${past ? ' data-past="true"' : ""}${b.date === o.today ? ' data-today="true"' : ""}${fitLevel ? ` data-fit="${fitLevel}"` : ""}${target ? ` data-drop="${fit?.level ?? "ok"}"` : ""} aria-label="${esc(aria)}" title="${esc(aria)}">
          ${b.off ? `<span class="bz-capboard__off">Kapalı</span>` : `<span class="bz-capboard__cap"><span class="bz-capboard__free" data-state="${cell.free < -1e-9 ? "over" : cell.free < 0.05 ? "full" : cell.load ? "part" : "empty"}">${freeText}</span>${fit && fitLevel !== "bad" ? `<span class="bz-capboard__fittag">${fit.fits ? `sığar · %${fit.pctAfter}` : `${hrs(r1(M.hours - Math.max(0, fit.free)))} taşar`}</span>` : ""}</span>${cell.load ? meter(cell.cap, cell.load, cell.state) : ""}`}
          ${cell.down.map((d) => `<span class="bz-capboard__down">${CI.wrench}${esc(d.label ?? "Duruş")} ${hrs(d.hours)}</span>`).join("")}
          ${cell.orders.length ? `<ul class="bz-capboard__cards">${cell.orders.map(card).join("")}</ul>` : ""}
        </div>`;
            }).join("");
            return label + cells;
        }).join("");
        const gross = r1(o.centers.reduce((sum, c) => sum + centerStats(c, buckets, []).gross, 0));
        const avgEff = gross ? Math.round((o.centers.reduce((sum, c) => sum + centerStats(c, buckets, []).gross * efficiencyOf(c), 0) / gross) * 100) : 0;
        const totals = `<div class="bz-capboard__totlabel" role="rowheader"><b>Toplam</b><span>${hrs(t.load)} / ${hrs(t.cap)} net</span><span>brüt ${hrs(gross)} · ort. verim %${avgEff}</span></div>${buckets.map((b) => { const s = g.buckets.get(b.id); return `<div class="bz-capboard__tot" role="gridcell"${b.off ? ' data-off="true"' : ""} aria-label="${esc(`${b.label} toplam: ${hrs(s.load)} / ${hrs(s.cap)} (%${s.pct})`)}">${b.off ? "—" : `<span><b>${hrs(s.load)}</b> / ${hrs(s.cap)}</span><span class="bz-capboard__totpct" data-state="${stateOf(s.load, s.cap)}">%${s.pct}</span>${meter(s.cap, s.load, stateOf(s.load, s.cap))}`}</div>`; }).join("")}`;
        const p = o.period;
        host.innerHTML = `<div class="bz-capboard" data-density="${density}"${M ? ' data-moving="true"' : ""} role="group" aria-label="${esc(o.label ?? "Kapasite planlama")}">
      <div class="bz-capboard__bar">
        ${p ? `<div class="bz-capboard__period" role="group" aria-label="Dönem"><button type="button" class="bz-icon-btn bz-icon-btn--sm" data-act="prev" aria-label="Önceki dönem"${p.onPrev ? "" : " disabled"}>${CI.prev}</button><b>${esc(p.label)}</b><button type="button" class="bz-icon-btn bz-icon-btn--sm" data-act="next" aria-label="Sonraki dönem"${p.onNext ? "" : " disabled"}>${CI.next}</button>${p.onToday ? '<button type="button" class="bz-btn bz-btn--sm bz-btn--ghost" data-act="today">Bugün</button>' : ""}</div>` : ""}
        <div class="bz-capboard__kpis">${kpi("Doluluk", `%${t.pct}`, t.pct > 100 ? "danger" : t.pct >= 85 ? "warning" : "")}${kpi("Planlı / net kapasite", `${hrs(t.load)} / ${hrs(t.cap)}`)}${kpi("Aşırı yük", `${t.over} hücre`, t.over ? "danger" : "")}${kpi("Gecikecek", `${t.late} İE`, t.late ? "danger" : "")}${kpi("Havuz", `${t.pool} İE · ${hrs(t.poolHours)}`, t.pool ? "info" : "")}</div>
        ${o.readOnly ? "" : `<div class="bz-capboard__actions">
          <button type="button" class="bz-btn bz-btn--sm" data-act="auto"${t.pool ? "" : " disabled"}>${CI.auto}Otomatik yerleştir</button>
          <button type="button" class="bz-btn bz-btn--sm" data-act="balance"${t.over ? "" : " disabled"}>${CI.balance}Dengele${t.over ? ` (${t.over})` : ""}</button>
          <button type="button" class="bz-btn bz-btn--sm bz-btn--ghost" data-act="undo"${history.length ? "" : " disabled"} aria-keyshortcuts="Meta+Z Control+Z">${CI.undo}Geri al</button>
          <span class="bz-segmented bz-capboard__density" role="group" aria-label="Görünüm"><button type="button" data-density="compact" aria-pressed="${density === "compact"}">Sıkı</button><button type="button" data-density="comfortable" aria-pressed="${density === "comfortable"}">Rahat</button></span>
          <button type="button" class="bz-btn bz-btn--sm bz-btn--ghost" data-act="unplan">${CI.pool}Havuza al</button>
        </div>`}
      </div>
      <div class="bz-capboard__layout">
        <aside class="bz-capboard__pool" data-pool="true" aria-label="Planlanmamış iş emirleri"${grab && grab.ci === -1 ? ' data-drop="ok"' : ""}${M && planned(M) ? ' data-fit="ok"' : ""}>
          <div class="bz-capboard__pool-head"><b>Havuz</b><span>${t.pool} İE · ${hrs(t.poolHours)}</span></div>
          <div class="bz-capboard__pool-tools"><label class="bz-search bz-capboard__search"><input type="search" placeholder="İE ya da ürün ara" aria-label="Havuzda ara" value="${esc(poolQ)}" /></label><select class="bz-field bz-field--sm bz-capboard__sort" aria-label="Havuzu sırala"><option value="due"${poolSort === "due" ? " selected" : ""}>Termin</option><option value="priority"${poolSort === "priority" ? " selected" : ""}>Öncelik</option><option value="hours"${poolSort === "hours" ? " selected" : ""}>Süre</option></select></div>
          ${skills.length > 1 ? `<div class="bz-capboard__filters" role="group" aria-label="İşleme göre süz"><button type="button" data-skill="" aria-pressed="${!poolSkill}">Tümü</button>${skills.map((k) => `<button type="button" data-skill="${esc(k)}" aria-pressed="${poolSkill === k}">${esc(k)}</button>`).join("")}</div>` : ""}
          <ul class="bz-capboard__list">${pool.map(card).join("") || '<li class="bz-capboard__empty">Havuz boş — tüm iş emirleri planlı.</li>'}</ul>
          <p class="bz-capboard__hint">Karta tıklayın: ayrıntı · sürükleyip güne bırakın (<kbd>Shift</kbd>: günlere yay) · klavye: <kbd>Enter</kbd> ayrıntı, <kbd>Boşluk</kbd> al → oklar → <kbd>Enter</kbd> bırak</p>
        </aside>
        <div class="bz-capboard__scroll">
          <div class="bz-capboard__grid" role="grid" aria-label="${esc(o.label ?? "Kapasite planlama")}" style="--_cols:${buckets.length}">
            <div class="bz-capboard__corner" role="columnheader">Tezgah</div>${head}${rows}${totals}
          </div>
        </div>
      </div>
      <div class="bz-capboard__live bz-sr-only" aria-live="assertive"></div>
    </div>`;
        const sc = host.querySelector(".bz-capboard__scroll");
        if (sc) {
            sc.scrollLeft = keepX;
            sc.scrollTop = keepY;
        }
        const li = host.querySelector(".bz-capboard__list");
        if (li)
            li.scrollTop = keepP;
        const f = focus ?? grab?.id;
        if (f)
            host.querySelector(`.bz-capcard[data-id="${CSS.escape(f)}"]`)?.focus({ preventScroll: true });
    }
    const say = (text) => { const l = host.querySelector(".bz-capboard__live"); if (l) {
        l.textContent = "";
        setTimeout(() => (l.textContent = text), 30);
    } };
    const snapshot = () => { history.push(orders.map((x) => ({ ...x }))); if (history.length > 40)
        history.shift(); };
    const diff = (before, after) => {
        const was = new Map(before.map((x) => [x.id, x]));
        const changed = after.filter((x) => { const p = was.get(x.id); return !p || p.center !== x.center || p.bucket !== x.bucket || p.hours !== x.hours || p.locked !== x.locked || p.part?.n !== x.part?.n || p.part?.total !== x.part?.total; });
        const removed = before.filter((x) => !after.some((y) => y.id === x.id)).map((x) => x.id);
        return { changed, removed };
    };
    async function move(w, center, bucket) {
        const prev = { ...w };
        if (prev.center === center && prev.bucket === bucket) {
            render(w.id);
            return;
        }
        const c = C(center), b = B(bucket);
        const chk = c && b ? check(w, c, b) : null;
        if (chk?.level === "bad") {
            bizmoHaptic("error");
            say(`Bırakılamaz: ${chk.reasons.join("; ")}`);
            render(w.id);
            return;
        }
        snapshot();
        w.center = center;
        w.bucket = bucket;
        render(w.id);
        const el = () => host.querySelector(`.bz-capcard[data-id="${CSS.escape(w.id)}"]`);
        if ((await o.onChange?.(w, prev)) === false) {
            Object.assign(w, prev);
            history.pop();
            render(w.id);
            bizmoHaptic("error", { el: el() });
            say(`${capLabel(w)} taşınamadı; eski yerine döndü`);
            return;
        }
        if (!c || !b) {
            bizmoHaptic("light", { el: el() });
            say(`${capLabel(w)} havuza alındı · geri almak için ⌘Z`);
            return;
        }
        bizmoHaptic(chk?.level === "warn" ? "warning" : "success", { el: el() });
        say(`${capLabel(w)} → ${c.label} · ${b.label} ${day(b.date)} · yük %${chk?.pctAfter}${chk?.reasons.length ? ` · ${chk.reasons.join("; ")}` : ""}${chk && !chk.fits ? " · Shift ile bırakınca günlere yayılır" : ""}`);
    }
    async function batch(next, message, opts = {}) {
        const prev = orders.map((x) => ({ ...x }));
        const { changed, removed } = diff(prev, next);
        if (!changed.length && !removed.length) {
            say("Değişiklik yok");
            bizmoHaptic("light");
            return false;
        }
        if (!opts.undo)
            snapshot();
        orders = next;
        render(opts.focus);
        if ((await o.onBatch?.(changed.map((x) => ({ ...x })), removed)) === false) {
            orders = prev;
            if (!opts.undo)
                history.pop();
            render();
            bizmoHaptic("error");
            say("Değişiklik reddedildi; eski hâline döndü");
            return false;
        }
        bizmoHaptic("success");
        say(message);
        return true;
    }
    /** Günlere yay: işi verilen tezgahta verilen günden başlayarak böler */
    function spread(w, center, fromIndex) {
        const r = capacitySplit(orders, w.id, center, buckets, Math.max(0, fromIndex), { today: o.today });
        if (!r.parts.length) {
            bizmoHaptic("error");
            say(`${capLabel(w)} yayılamadı: ${center.label} için boş kapasite yok`);
            return;
        }
        const placedParts = r.orders.filter((x) => r.parts.includes(x.id) && planned(x));
        batch(r.orders, `${w.label} ${placedParts.length} güne yayıldı (${center.label})${r.rest > 1e-9 ? ` · ${hrs(r.rest)} havuzda kaldı` : ""} · geri almak için ⌘Z`, { focus: placedParts[0]?.id });
    }
    /** Tek iş için en erken uygun yer (otomatik yerleştirme kuralıyla, gerekirse yayarak) */
    const earliestFor = (w) => {
        const r = capacityAutoSchedule(orders.map((x) => (x.id === w.id ? { ...x, center: null, bucket: null } : x)), o.centers, buckets, { fromDate: o.today, split: true, only: new Set([w.id]) });
        return r.placed.length ? r : null;
    };
    async function undo() {
        const prev = history.pop();
        if (!prev) {
            say("Geri alınacak değişiklik yok");
            return;
        }
        await batch(prev, "Son değişiklik geri alındı", { undo: true });
    }
    // ── Sürükle-bırak (işaretçi: fare + dokunma). Sürüklerken ızgara önizleme modunda (uygun / uygunsuz hücreler) ──
    let drag = null;
    const targetAt = (x, y) => {
        const n = document.elementsFromPoint(x, y);
        const cell = n.find((e) => e.classList?.contains("bz-capboard__cell"));
        if (cell)
            return { el: cell, center: cell.dataset.center, bucket: cell.dataset.bucket };
        const pool = n.find((e) => e.dataset?.pool);
        return pool ? { el: pool, center: null, bucket: null } : null;
    };
    const clearDrop = () => host.querySelectorAll("[data-drop]").forEach((e) => e.removeAttribute("data-drop"));
    host.addEventListener("pointerdown", (e) => {
        const el = e.target.closest(".bz-capcard");
        if (!el || e.button !== 0 || o.readOnly)
            return;
        const w = byId(el.dataset.id);
        if (w.locked)
            return;
        drag = { w, el, x0: e.clientX, y0: e.clientY, ghost: null, shift: false, target: null };
    });
    const onMove = (e) => {
        if (!drag)
            return;
        if (!drag.ghost) {
            if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5)
                return;
            const r = drag.el.getBoundingClientRect();
            const ghost = drag.el.cloneNode(true);
            ghost.classList.add("bz-capcard--ghost");
            Object.assign(ghost.style, { width: `${Math.max(180, r.width)}px`, left: `${r.left}px`, top: `${r.top}px` });
            ghost.dataset.dx = String(e.clientX - r.left);
            ghost.dataset.dy = String(e.clientY - r.top);
            moving = drag.w.id;
            render(); // önizleme modu: hücreler uygunluğa göre boyanır
            document.body.append(ghost);
            drag.ghost = ghost;
            drag.el = host.querySelector(`.bz-capcard[data-id="${CSS.escape(drag.w.id)}"]`) ?? drag.el;
            drag.el.dataset.dragging = "true";
            bizmoHaptic("light");
        }
        e.preventDefault();
        const g = drag.ghost;
        g.style.left = `${e.clientX - +g.dataset.dx}px`;
        g.style.top = `${e.clientY - +g.dataset.dy}px`;
        // Kenara yaklaşınca ızgara kayar (yatay ve dikey)
        const sc = host.querySelector(".bz-capboard__scroll"), sr = sc.getBoundingClientRect();
        if (e.clientX > sr.right - 40 && e.clientX < sr.right + 20)
            sc.scrollLeft += 14;
        else if (e.clientX < sr.left + 40 && e.clientX > sr.left)
            sc.scrollLeft -= 14;
        if (e.clientY > sr.bottom - 30 && e.clientY < sr.bottom + 20)
            sc.scrollTop += 12;
        else if (e.clientY < sr.top + 60 && e.clientY > sr.top)
            sc.scrollTop -= 12;
        const t = targetAt(e.clientX, e.clientY);
        const key = t ? `${t.center}|${t.bucket}|${e.shiftKey}` : "";
        if (key === (drag.target ? `${drag.target.center}|${drag.target.bucket}|${drag.shift}` : ""))
            return;
        drag.shift = e.shiftKey;
        clearDrop();
        if (!t) {
            drag.target = null;
            g.removeAttribute("data-note");
            return;
        }
        const c = C(t.center), b = B(t.bucket);
        const chk = c && b ? check(drag.w, c, b) : null;
        const level = chk?.level ?? "ok";
        t.el.dataset.drop = level;
        drag.target = { center: t.center, bucket: t.bucket, level };
        g.dataset.note = !c || !b ? "Havuza al" : level === "bad" ? chk.reasons.join(" · ") : !chk.fits ? (e.shiftKey ? `Bırakınca günlere yayılır (${c.label})` : `${chk.reasons[0]} · Shift ile bırak: günlere yay`) : chk.reasons.length ? `sığar · ${chk.reasons.join(" · ")}` : `sığar · %${chk.pctAfter} dolu`;
        g.dataset.level = level;
        bizmoHaptic("selection");
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    const drop = (e) => {
        if (!drag)
            return;
        const d = drag;
        drag = null;
        d.ghost?.remove();
        const wasMoving = moving;
        moving = null;
        if (!d.ghost)
            return; // tıklama: ayrıntıyı click olayı açar
        justDragged = Date.now();
        if (!d.target) {
            render(d.w.id);
            return;
        }
        const c = C(d.target.center), b = B(d.target.bucket);
        if (c && b && e.shiftKey && d.target.level !== "bad") {
            const chk = check(d.w, c, b);
            if (!chk.fits) {
                spread(d.w, c, bIndex(b.id));
                return;
            }
        }
        if (wasMoving)
            move(d.w, d.target.center, d.target.bucket);
    };
    const cancel = () => { if (drag) {
        drag.ghost?.remove();
        drag = null;
        moving = null;
        render();
    } };
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", cancel);
    // ── Klavye: Enter ayrıntı; Boşluk al → oklar → Enter bırak (Shift+Enter yay), Esc vazgeç; Alt+←/→ gün; Sil havuz; ⌘Z geri al ──
    host.addEventListener("keydown", (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !o.readOnly && !e.target.matches("input, select, textarea")) {
            e.preventDefault();
            undo();
            return;
        }
        const cardEl = e.target.closest(".bz-capcard");
        if (grab) {
            const w = byId(grab.id);
            const dirs = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
            if (dirs[e.key]) {
                e.preventDefault();
                const [dc, db] = dirs[e.key];
                if (grab.ci === -1) {
                    grab.ci = Math.max(0, o.centers.findIndex((c) => canRun(w, c)));
                    grab.bi = Math.max(0, buckets.findIndex((b) => !b.off && !isPast(b, o.today)));
                }
                else {
                    grab.ci = Math.max(-1, Math.min(o.centers.length - 1, grab.ci + dc));
                    grab.bi = Math.max(0, Math.min(buckets.length - 1, grab.bi + db));
                }
                render(w.id);
                if (grab.ci === -1) {
                    say("Hedef: havuz");
                    return;
                }
                const c = o.centers[grab.ci], b = buckets[grab.bi], chk = check(w, c, b);
                host.querySelector(`.bz-capboard__cell[data-center="${CSS.escape(c.id)}"][data-bucket="${CSS.escape(b.id)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
                bizmoHaptic(chk.level === "bad" ? "error" : "selection");
                say(`Hedef: ${c.label} · ${b.label} ${day(b.date)} · ${chk.level === "bad" ? `bırakılamaz: ${chk.reasons.join("; ")}` : `${hrs(chk.free)} boş · ${chk.fits ? `sığar, yük %${chk.pctAfter}` : "sığmaz; Shift+Enter günlere yayar"}${chk.reasons.length && chk.fits ? ` · ${chk.reasons.join("; ")}` : ""}`}`);
                return;
            }
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const gr = grab;
                grab = null;
                moving = null;
                if (gr.ci === -1) {
                    move(w, null, null);
                    return;
                }
                const c = o.centers[gr.ci], b = buckets[gr.bi];
                if (e.shiftKey && check(w, c, b).level !== "bad" && !check(w, c, b).fits) {
                    spread(w, c, gr.bi);
                    return;
                }
                move(w, c.id, b.id);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                grab = null;
                moving = null;
                render(w.id);
                say("Taşıma iptal edildi");
                return;
            }
            return;
        }
        if (!cardEl)
            return;
        const w = byId(cardEl.dataset.id);
        if (e.key === "Enter") {
            e.preventDefault();
            openOrder(w.id, cardEl);
            return;
        }
        if (o.readOnly)
            return;
        if (e.key === " " && !w.locked) {
            e.preventDefault();
            const ci = o.centers.findIndex((c) => c.id === w.center), bi = bIndex(w.bucket);
            grab = { id: w.id, ci: ci >= 0 ? ci : -1, bi: bi >= 0 ? bi : 0 };
            moving = w.id;
            render(w.id);
            bizmoHaptic("light");
            say(`Alındı: ${capLabel(w)}, ${hrs(w.hours)}. Uygun hücreler işaretlendi. Oklarla tezgah ve gün seçin, Enter bırakır, Shift+Enter günlere yayar, Esc vazgeçer.`);
        }
        else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight") && planned(w) && !w.locked) {
            e.preventDefault();
            const nb = buckets[bIndex(w.bucket) + (e.key === "ArrowLeft" ? -1 : 1)];
            if (nb)
                move(w, w.center, nb.id);
        }
        else if ((e.key === "Delete" || e.key === "Backspace") && planned(w) && !w.locked) {
            e.preventDefault();
            move(w, null, null);
        }
    });
    // ── Araç çubuğu, havuz süzgeci ve sıralama ──
    host.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b || !host.contains(b))
            return;
        if (b.dataset.machine) {
            openMachine(b.dataset.machine, b);
            return;
        }
        if (b.classList.contains("bz-capcard") && b.dataset.id) {
            if (Date.now() - justDragged > 300 && !grab)
                openOrder(b.dataset.id, b);
            return;
        }
        if (b.dataset.skill !== undefined) {
            poolSkill = b.dataset.skill;
            render();
            host.querySelector(`[data-skill="${CSS.escape(poolSkill)}"]`)?.focus();
            return;
        }
        if (b.dataset.density) {
            density = b.dataset.density;
            render();
            host.querySelector(`[data-density="${density}"]`)?.focus();
            return;
        }
        switch (b.dataset.act) {
            case "auto": {
                const r = capacityAutoSchedule(orders, o.centers, buckets, { fromDate: o.today, split: true });
                if (!r.placed.length) {
                    bizmoHaptic("warning");
                    say(r.unplaced.length ? `Yerleşen yok: ${r.unplaced.length} iş emri için işlemi yapabilen tezgahta boş kapasite bulunamadı (geçmiş günlere planlanmaz)` : "Havuz boş");
                    return;
                }
                const n = new Set(r.placed.map((id) => rootOf(r.orders.find((x) => x.id === id)))).size;
                batch(r.orders, `${n} iş emri yerleşti${r.split.length ? ` (${r.split.length} tanesi günlere yayıldı)` : ""}${r.late.length ? `, ${r.late.length} gecikecek` : ""}${r.unplaced.length ? `, ${r.unplaced.length} sığmadı (havuzda)` : ""} · geri almak için ⌘Z`);
                break;
            }
            case "balance": {
                const r = capacityBalance(orders, o.centers, buckets, { fromDate: o.today });
                if (!r.moved.length) {
                    bizmoHaptic("warning");
                    say(`Dengelenemedi: aşırı yükteki işler başka uygun yere sığmıyor${r.kept.length ? ` (${r.kept.length} iş yerinde kaldı)` : ""}`);
                    return;
                }
                batch(r.orders, `${r.moved.length} iş başka gün / tezgaha taşındı${r.kept.length ? `, ${r.kept.length} iş sığacak yer olmadığından yerinde kaldı` : ""} · geri almak için ⌘Z`);
                break;
            }
            case "undo":
                undo();
                break;
            case "unplan":
                batch(orders.map((x) => (x.locked ? x : { ...x, center: null, bucket: null })), "Kilitli olmayan iş emirleri havuza alındı · geri almak için ⌘Z");
                break;
            case "prev":
                o.period?.onPrev?.();
                break;
            case "next":
                o.period?.onNext?.();
                break;
            case "today":
                o.period?.onToday?.();
                break;
        }
    });
    host.addEventListener("input", (e) => {
        const t = e.target;
        if (t.type !== "search")
            return;
        poolQ = t.value.trim().toLocaleLowerCase("tr-TR");
        render();
        const s = host.querySelector(".bz-capboard__search input");
        s.focus();
        s.setSelectionRange(s.value.length, s.value.length);
    });
    host.addEventListener("change", (e) => {
        const t = e.target;
        if (!t.classList.contains("bz-capboard__sort"))
            return;
        poolSort = t.value;
        render();
        host.querySelector(".bz-capboard__sort")?.focus();
    });
    // ── Bağlam menüsü (sağ tık, basılı tut, Shift+F10) ──
    bizmoContextMenuDelegate(host, ".bz-capcard", {
        title: (el) => { const w = byId(el.dataset.id); return `${capLabel(w)} · ${hrs(w.hours)} · ${w.skill}`; },
        icon: (n) => CI[n] ?? "",
        items: (el) => {
            const w = byId(el.dataset.id);
            const ro = o.readOnly || w.locked;
            const b = B(w.bucket), bi = bIndex(w.bucket), c = C(w.center);
            const step = (d) => {
                const nb = buckets[bi + d];
                if (!b || !c || !nb)
                    return null;
                const chk = check(w, c, nb);
                return { label: `${d > 0 ? "1 gün ileri" : "1 gün geri"} (${nb.label} · ${chk.level === "bad" ? chk.reasons[0] : `%${chk.pctAfter}`})`, icon: d > 0 ? "next" : "prev", shortcut: d > 0 ? "Alt+→" : "Alt+←", tone: chk.level === "warn" ? "warning" : undefined, disabled: ro || chk.level === "bad", onSelect: () => { move(w, c.id, nb.id); } };
            };
            const alts = b ? o.centers.filter((x) => x.id !== w.center && canRun(w, x)).slice(0, 3).map((x) => { const chk = check(w, x, b); return { label: `Taşı: ${x.label} (aynı gün · ${chk.level === "bad" ? chk.reasons[0] : `%${chk.pctAfter}`})`, icon: "move", tone: chk.level === "warn" ? "warning" : undefined, disabled: ro || chk.level === "bad", onSelect: () => { move(w, x.id, b.id); } }; }) : [];
            const best = earliestFor(w);
            const bestAt = best?.orders.find((x) => x.id === w.id || (x.part?.of === rootOf(w) && planned(x)));
            const spreadAt = c ?? o.centers.find((x) => canRun(w, x));
            const free = c && b ? check(w, c, b) : null;
            const items = [
                { label: best ? `En erken uygun yere planla${bestAt?.center ? ` (${C(bestAt.center)?.label} · ${B(bestAt.bucket)?.label}${best.split.length ? ", yayarak" : ""})` : ""}` : "En erken uygun yer yok", icon: "auto", disabled: ro || !best, onSelect: () => { if (best)
                        batch(best.orders, `${w.label} en erken uygun yere planlandı${best.split.length ? " (günlere yayıldı)" : ""}`, { focus: bestAt?.id }); } },
                step(-1), step(1),
                ...(spreadAt && (!free || !free.fits || !planned(w)) && w.hours > 0.5 ? [{ label: `Günlere yay (${spreadAt.label}${b ? ` · ${b.label} ve sonrası` : ""})`, icon: "split", disabled: ro, onSelect: () => spread(w, spreadAt, Math.max(0, bi)) }] : []),
                ...(w.part ? [{ label: `Parçaları birleştir (${w.part.total} parça → havuza)`, icon: "merge", disabled: o.readOnly || orders.some((x) => x.part?.of === w.part.of && x.locked), onSelect: () => { batch(capacityMerge(orders, w.part.of), `${w.label} parçaları birleştirildi; havuzda`); } }] : []),
                ...alts,
                ...(planned(w) ? [{ label: "Havuza al", icon: "pool", shortcut: "Sil", disabled: ro, onSelect: () => { move(w, null, null); } }] : []),
                "separator",
                { label: w.locked ? "Kilidi aç" : "Kilitle (taşınmaz)", icon: w.locked ? "unlock" : "lock", disabled: o.readOnly, onSelect: () => { batch(orders.map((x) => (x.id === w.id ? { ...x, locked: !x.locked } : x)), w.locked ? `${capLabel(w)} kilidi açıldı` : `${capLabel(w)} kilitlendi`, { focus: w.id }); } },
                { label: "Ayrıntıyı göster", icon: "info", shortcut: "Enter", onSelect: () => { const el2 = host.querySelector(`.bz-capcard[data-id="${CSS.escape(w.id)}"]`); if (el2)
                        openOrder(w.id, el2); } },
                ...(o.onOpen ? [{ label: "Uygulamada aç", icon: "open", onSelect: () => o.onOpen(w) }] : []),
            ];
            return items.filter((x) => x !== null);
        },
    });
    render();
    return {
        get: () => orders.map((x) => ({ ...x })),
        /** dönem değişince yeni günler ve işler; geri alma geçmişi temizlenir */
        set(next, nextBuckets, period) { orders = next.map((x) => ({ ...x })); if (nextBuckets) {
            buckets = nextBuckets;
            history.length = 0;
        } if (period)
            o.period = period; render(); },
        autoSchedule: () => host.querySelector('[data-act="auto"]')?.click(),
        balance: () => host.querySelector('[data-act="balance"]')?.click(),
        undo,
        destroy() { closePop(); window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", drop); window.removeEventListener("pointercancel", cancel); host.innerHTML = ""; },
    };
}
export const BOM_TYPE = { product: "Mamul", semi: "Yarı mamul", raw: "Hammadde", pack: "Ambalaj" };
const items = (list) => (Array.isArray(list) ? Object.fromEntries(list.map((i) => [i.code, i])) : list);
const round = (n) => Math.round(n * 1e6) / 1e6;
/** Çok seviyeli patlatma (derinlik öncelikli). Toplam ihtiyaç = üst toplam × birim miktar × (1 + fire). Döngü hata verir. */
export function bomExplode(code, list, qty = 1) {
    const map = items(list), out = [];
    const walk = (c, level, per, total, path, parent) => {
        const it = map[c];
        if (!it)
            throw new Error(`Ürün ağacında tanımsız kalem: ${c}`);
        if (path.includes(c))
            throw new Error(`Ürün ağacında döngü: ${[...path, c].join(" → ")}`);
        const key = [...path, c].join(">");
        out.push({ key, level, code: c, name: it.name, type: it.type, unit: it.unit, source: it.source ?? (it.children?.length ? "make" : "buy"), qtyPer: round(per), qtyTotal: round(total), stock: it.stock, leadDays: it.leadDays, hasChildren: !!it.children?.length, parent });
        for (const ch of it.children ?? [])
            walk(ch.code, level + 1, ch.qty, total * ch.qty * (1 + (ch.scrap ?? 0)), [...path, c], key);
    };
    walk(code, 0, qty, qty, [], null);
    return out;
}
/** Nerede kullanılıyor: kalemden yukarı, onu içeren yarı mamul ve mamullere (her satırda üst kalemdeki birim miktar) */
export function bomWhereUsed(code, list) {
    const map = items(list), out = [];
    const parents = (c) => Object.values(map).flatMap((p) => (p.children ?? []).filter((ch) => ch.code === c).map((ch) => ({ p, qty: ch.qty })));
    const walk = (c, level, per, path, parent) => {
        const it = map[c];
        if (!it || path.includes(c))
            return;
        const key = [...path, c].join("<");
        const ps = parents(c);
        out.push({ key, level, code: c, name: it.name, type: it.type, unit: it.unit, source: it.source ?? (it.children?.length ? "make" : "buy"), qtyPer: per, qtyTotal: per, stock: it.stock, leadDays: it.leadDays, hasChildren: ps.length > 0, parent });
        for (const { p, qty } of ps)
            walk(p.code, level + 1, qty, [...path, c], key);
    };
    walk(code, 0, 1, [], null);
    return out;
}
/** Aynı kalem birden çok dalda geçebilir: koda göre toplam ihtiyaç, stok ve eksik (yalnız satın alınan / yaprak kalemler) */
export function bomRequirements(rows) {
    const m = new Map();
    for (const r of rows) {
        if (r.hasChildren)
            continue;
        const x = m.get(r.code) ?? { code: r.code, name: r.name, unit: r.unit, need: 0, stock: r.stock ?? 0, short: 0, leadDays: r.leadDays };
        x.need = round(x.need + r.qtyTotal);
        x.short = round(Math.max(0, x.need - x.stock));
        m.set(r.code, x);
    }
    return [...m.values()];
}
const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const caret = SVG('<path d="m9 6 6 6-6 6"/>');
/**
 * Ürün ağacı tablosu (role="treegrid"): girinti kılavuzları 90° akson, aç / kapa, satırda ↑↓ gezinme, → aç / alta in, ← kapa / üste çık.
 * mode "where" ise başlıklar "Üst kalem" düzenine geçer.
 */
export function bizmoBomTable(host, rows, o = {}) {
    const where = o.mode === "where";
    const need = new Map(bomRequirements(rows).map((r) => [r.code, r]));
    const collapsed = new Set(rows.filter((r) => r.hasChildren && o.collapsedLevel !== undefined && r.level >= o.collapsedLevel).map((r) => r.key));
    const siblings = (r) => rows.filter((x) => x.parent === r.parent);
    let active = rows[0]?.key;
    const stockCell = (r) => {
        if (where || r.hasChildren || r.stock === undefined)
            return r.stock !== undefined ? nf.format(r.stock) : "—";
        const q = need.get(r.code);
        const level = q.short > 0 ? (q.stock <= 0 ? "out" : "critical") : q.stock < q.need * 1.2 ? "low" : "ok";
        const text = q.short > 0 ? `${nf.format(q.short)} eksik` : level === "low" ? "Sınırda" : "Yeterli";
        return `${nf.format(r.stock)}<span class="bz-stock bz-chip--sm" data-level="${level}">${text}</span>`;
    };
    function render() {
        const hidden = (r) => { let p = r.parent; while (p) {
            if (collapsed.has(p))
                return true;
            p = rows.find((x) => x.key === p)?.parent ?? null;
        } return false; };
        host.innerHTML = `<div class="bz-bom-wrap"><table class="bz-table bz-bom" role="treegrid" aria-label="${esc(o.label ?? (where ? "Nerede kullanılıyor" : "Ürün ağacı"))}">
      <thead><tr><th>${where ? "Kalem → üst kalemler" : "Kalem"}</th><th>Tür</th><th class="is-num">${where ? "Üstte birim miktar" : "Birim miktar"}</th>${where ? "" : '<th class="is-num">Toplam ihtiyaç</th>'}<th class="is-num">Stok</th><th>Tedarik</th></tr></thead>
      <tbody>${rows.map((r) => {
            const sib = siblings(r);
            return `<tr role="row" data-key="${esc(r.key)}" aria-level="${r.level + 1}" aria-setsize="${sib.length}" aria-posinset="${sib.indexOf(r) + 1}"${r.hasChildren ? ` aria-expanded="${!collapsed.has(r.key)}"` : ""} tabindex="${r.key === active ? 0 : -1}"${hidden(r) ? " hidden" : ""}${r.level === 0 ? ' data-root="true"' : ""}>
          <td role="gridcell"><span class="bz-bom__name" style="--_lvl:${r.level}">${r.hasChildren ? `<button type="button" class="bz-bom__toggle" tabindex="-1" aria-label="${collapsed.has(r.key) ? "Aç" : "Kapat"}: ${esc(r.code)}">${caret}</button>` : '<span class="bz-bom__leaf" aria-hidden="true"></span>'}<code>${esc(r.code)}</code><span>${esc(r.name)}</span></span></td>
          <td role="gridcell"><span class="bz-bom__type" data-type="${r.type}">${BOM_TYPE[r.type]}</span></td>
          <td role="gridcell" class="is-num">${r.level === 0 ? "—" : `${nf.format(r.qtyPer)} <small>${esc(r.unit)}</small>`}</td>
          ${where ? "" : `<td role="gridcell" class="is-num"><b>${nf.format(r.qtyTotal)}</b> <small>${esc(r.unit)}</small></td>`}
          <td role="gridcell" class="is-num bz-bom__stock">${stockCell(r)}</td>
          <td role="gridcell">${r.source === "make" ? "Üretim" : "Satınalma"}${r.leadDays ? ` · ${r.leadDays} gün` : ""}</td>
        </tr>`;
        }).join("")}</tbody></table></div>`;
    }
    const rowEl = (key) => (key ? host.querySelector(`tr[data-key="${CSS.escape(key)}"]`) : null);
    const focusRow = (key) => { active = key; host.querySelectorAll("tr[data-key]").forEach((tr) => (tr.tabIndex = tr.dataset.key === key ? 0 : -1)); rowEl(key)?.focus(); };
    const toggle = (key, open) => {
        const shut = open === undefined ? !collapsed.has(key) : !open;
        shut ? collapsed.add(key) : collapsed.delete(key);
        render();
        focusRow(key);
    };
    host.addEventListener("click", (e) => {
        const tr = e.target.closest("tr[data-key]");
        if (!tr)
            return;
        if (e.target.closest(".bz-bom__toggle"))
            toggle(tr.dataset.key);
        else
            focusRow(tr.dataset.key);
    });
    host.addEventListener("keydown", (e) => {
        const tr = e.target.closest("tr[data-key]");
        if (!tr)
            return;
        const visible = [...host.querySelectorAll("tr[data-key]:not([hidden])")];
        const i = visible.indexOf(tr), r = rows.find((x) => x.key === tr.dataset.key);
        const go = (el) => { if (el) {
            e.preventDefault();
            focusRow(el.dataset.key);
        } };
        switch (e.key) {
            case "ArrowDown":
                go(visible[i + 1]);
                break;
            case "ArrowUp":
                go(visible[i - 1]);
                break;
            case "Home":
                go(visible[0]);
                break;
            case "End":
                go(visible[visible.length - 1]);
                break;
            case "ArrowRight":
                e.preventDefault();
                if (r.hasChildren && collapsed.has(r.key))
                    toggle(r.key, true);
                else if (r.hasChildren)
                    go(visible[i + 1]);
                break;
            case "ArrowLeft":
                e.preventDefault();
                if (r.hasChildren && !collapsed.has(r.key))
                    toggle(r.key, false);
                else if (r.parent)
                    focusRow(r.parent);
                break;
            case "Enter":
            case " ":
                if (r.hasChildren) {
                    e.preventDefault();
                    toggle(r.key);
                }
                break;
        }
    });
    render();
    return { expandAll() { collapsed.clear(); render(); }, collapseTo(level) { rows.forEach((r) => r.hasChildren && r.level >= level && collapsed.add(r.key)); render(); }, destroy: () => (host.innerHTML = "") };
}
export const TRACE_KIND = { supplier: "Tedarikçi", rawLot: "Hammadde lotu", order: "Üretim emri", lot: "Mamul lotu", shipment: "Sevkiyat", customer: "Müşteri" };
const KIND_ORDER = ["supplier", "rawLot", "order", "lot", "shipment", "customer"];
/** Odak düğümden geriye (kaynağa) ve ileriye (müşteriye) erişilen düğümler */
export function traceGraph(nodes, edges, focus) {
    const reach = (start, next) => {
        const seen = new Set(), q = [start];
        while (q.length)
            for (const n of next(q.shift()))
                if (!seen.has(n)) {
                    seen.add(n);
                    q.push(n);
                }
        seen.delete(start);
        return seen;
    };
    const back = reach(focus, (id) => edges.filter((e) => e.to === id).map((e) => e.from));
    const forward = reach(focus, (id) => edges.filter((e) => e.from === id).map((e) => e.to));
    return { back, forward, related: new Set([focus, ...back, ...forward]) };
}
/** Geri çağırma kapsamı: lottan ileriye ulaşılan mamul lotları, sevkiyatlar ve müşteriler */
export function recallScope(nodes, edges, lotId) {
    const { forward } = traceGraph(nodes, edges, lotId);
    const pick = (k) => nodes.filter((n) => n.kind === k && forward.has(n.id));
    return { lots: pick("lot"), orders: pick("order"), shipments: pick("shipment"), customers: pick("customer"), affected: new Set([lotId, ...forward]) };
}
const KIND_ICON = {
    supplier: SVG('<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>'),
    rawLot: SVG('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>'),
    order: SVG('<path d="M3 20h18M5 20V10l4 3V10l4 3V10l4 3V6h2v14"/>'),
    lot: SVG('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/>'),
    shipment: SVG('<path d="M3 7h11v10H3zM14 10h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>'),
    customer: SVG('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
};
/**
 * İzlenebilirlik grafiği: sütunlar Tedarikçi → Hammadde lotu → Üretim emri → Mamul lotu → Sevkiyat → Müşteri.
 * Odak lot vurgulu; geriye (kaynak, mavi) ve ileriye (müşteri, yeşil) yol belirgin, ilgisiz düğümler soluk.
 * recall: true iken odaktan ileriye her şey kırmızı (etkilenen) ve sayılar özetlenir. Bağlar 90° akson (SVG).
 */
export function bizmoTrace(host, o) {
    let focus = o.focus, recall = !!o.recall;
    let ro = null;
    const cols = KIND_ORDER.filter((k) => o.nodes.some((n) => n.kind === k));
    // Satır sırası: ağırlık merkezi ile iki tur (kesişmeyi azaltır)
    const order = new Map(o.nodes.map((n, i) => [n.id, i]));
    for (let pass = 0; pass < 2; pass++)
        for (const k of cols) {
            const list = o.nodes.filter((n) => n.kind === k);
            const bary = (n) => { const nb = o.edges.filter((e) => e.to === n.id || e.from === n.id).map((e) => order.get(e.to === n.id ? e.from : e.to)); return nb.length ? nb.reduce((a, b) => a + b, 0) / nb.length : order.get(n.id); };
            list.map((n) => [n, bary(n)]).sort((a, b) => a[1] - b[1]).forEach(([n], i) => order.set(n.id, i));
        }
    function render() {
        const g = traceGraph(o.nodes, o.edges, focus);
        const rc = recall ? recallScope(o.nodes, o.edges, focus) : null;
        const rel = (id) => (id === focus ? "focus" : rc?.affected.has(id) ? "recall" : g.back.has(id) ? "back" : g.forward.has(id) ? "forward" : "none");
        host.innerHTML = `<div class="bz-trace${recall ? " bz-trace--recall" : ""}" role="group" aria-label="${esc(o.label ?? "Lot izlenebilirliği")}">
      <svg class="bz-trace__edges" aria-hidden="true"></svg>
      <div class="bz-trace__cols" style="--_cols:${cols.length}">${cols.map((k) => `<div class="bz-trace__col"><div class="bz-trace__head">${esc(TRACE_KIND[k])}</div>${o.nodes.filter((n) => n.kind === k).sort((a, b) => order.get(a.id) - order.get(b.id)).map((n) => {
            const r = rel(n.id);
            const desc = `${TRACE_KIND[n.kind]} ${n.label}${n.sub ? ` · ${n.sub}` : ""}${n.qty ? ` · ${n.qty}` : ""}${r === "focus" ? " · odak" : r === "back" ? " · kaynak yolunda" : r === "forward" ? " · müşteri yolunda" : r === "recall" ? " · geri çağırma kapsamında" : ""}${n.state === "hold" ? " · blokeli" : ""}`;
            return `<button type="button" class="bz-trace__node" data-id="${esc(n.id)}" data-kind="${n.kind}" data-rel="${r}"${n.state && n.state !== "ok" ? ` data-state="${n.state}"` : ""} aria-pressed="${n.id === focus}" aria-label="${esc(desc)}">
          <span class="bz-trace__icon">${KIND_ICON[n.kind]}</span><span class="bz-trace__text"><b>${esc(n.label)}</b>${n.sub ? `<span>${esc(n.sub)}</span>` : ""}</span>${n.qty ? `<span class="bz-trace__qty">${esc(n.qty)}</span>` : ""}${n.state === "hold" ? '<span class="bz-trace__flag">Blokeli</span>' : ""}
        </button>`;
        }).join("")}</div>`).join("")}</div>
    </div>`;
        draw(g, rc);
    }
    function draw(g = traceGraph(o.nodes, o.edges, focus), rc = recall ? recallScope(o.nodes, o.edges, focus) : null) {
        const wrap = host.querySelector(".bz-trace"), svg = host.querySelector(".bz-trace__edges");
        if (!wrap || !svg)
            return;
        const box = wrap.getBoundingClientRect();
        svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
        svg.setAttribute("width", String(box.width));
        svg.setAttribute("height", String(box.height));
        const pos = (id) => { const el = wrap.querySelector(`[data-id="${CSS.escape(id)}"]`); if (!el)
            return null; const r = el.getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, y: r.top - box.top + r.height / 2 }; };
        const onPath = (e) => (e.from === focus || g.back.has(e.from)) && (e.to === focus || g.back.has(e.to)) ? "back" : (e.from === focus || g.forward.has(e.from)) && g.forward.has(e.to) ? (rc ? "recall" : "forward") : "none";
        const paths = o.edges.map((e) => {
            const a = pos(e.from), b = pos(e.to);
            if (!a || !b)
                return "";
            const x1 = a.r, y1 = a.y, x2 = b.l, y2 = b.y, xm = Math.round(x1 + (x2 - x1) / 2), rad = Math.min(8, Math.abs(y2 - y1) / 2, Math.abs(x2 - x1) / 4);
            const s = Math.sign(y2 - y1);
            const d = Math.abs(y2 - y1) < 1 ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}H${xm - rad}Q${xm} ${y1} ${xm} ${y1 + s * rad}V${y2 - s * rad}Q${xm} ${y2} ${xm + rad} ${y2}H${x2}`;
            return `<path d="${d}" data-path="${onPath(e)}"/>`;
        });
        // Vurgulu yollar en üstte çizilir
        svg.innerHTML = paths.filter((p) => p.includes('data-path="none"')).join("") + paths.filter((p) => p && !p.includes('data-path="none"')).join("");
    }
    host.addEventListener("click", (e) => {
        const el = e.target.closest(".bz-trace__node");
        const n = el && o.nodes.find((x) => x.id === el.dataset.id);
        if (!n)
            return;
        focus = n.id;
        render();
        host.querySelector(`.bz-trace__node[data-id="${CSS.escape(n.id)}"]`)?.focus();
        o.onSelect?.(n);
        bizmoAnnounce(`Odak: ${TRACE_KIND[n.kind]} ${n.label}`);
    });
    render();
    if (typeof ResizeObserver !== "undefined") {
        ro = new ResizeObserver(() => draw());
        ro.observe(host);
    }
    document.fonts?.ready.then(() => draw());
    return {
        setFocus(id) { focus = id; render(); },
        setRecall(on) { recall = on; render(); },
        scope: () => recallScope(o.nodes, o.edges, focus),
        destroy() { ro?.disconnect(); host.innerHTML = ""; },
    };
}
