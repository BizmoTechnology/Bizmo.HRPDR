/**
 * Bizmo Universal Theme · tarih ve saat seçiciler (shadcn/ui tarzı, çerçeveden bağımsız)
 *
 * Tarayıcının yerel date/time alanı yerine: dış hatlı tetik düğmesi + açılır pencerede Bizmo takvimi / saat sütunları.
 * Görünüm components.css'teki .bz-picker, .bz-picker-pop, .bz-calendar, .bz-time sınıflarından gelir.
 *
 * Bildirimsel (Blazor, Razor, düz HTML):
 *   <button type="button" class="bz-picker" data-bz-datepicker data-name="start" data-placeholder="Tarih seçin"></button>
 *   <button type="button" class="bz-picker" data-bz-datepicker data-mode="range" data-name="period"></button>
 *   <button type="button" class="bz-picker" data-bz-timepicker data-name="time" data-step="15" data-value="09:00"></button>
 *   bizmoInitPickers(document)
 *
 * Programatik:
 *   const p = bizmoDatePicker(button, { onChange: (d) => … }); p.setValue(new Date());
 * Değer forma ISO biçiminde gizli alanla gider (YYYY-MM-DD, aralıkta "YYYY-MM-DD/YYYY-MM-DD", saatte HH:MM).
 */

type DateValue = Date | null;
type RangeValue = { start: Date | null; end: Date | null };

export type DatePickerOptions = {
  mode?: "single" | "range";
  value?: DateValue | RangeValue;
  min?: Date;
  max?: Date;
  locale?: string;
  placeholder?: string;
  /** Form için gizli alan adı */
  name?: string;
  /** Aralıkta yan yana iki ay (varsayılan: genişse evet) */
  months?: 1 | 2;
  onChange?: (value: DateValue | RangeValue) => void;
};

export type TimePickerOptions = {
  value?: string | null;
  step?: number;
  min?: string;
  max?: string;
  locale?: string;
  placeholder?: string;
  name?: string;
  onChange?: (value: string | null) => void;
};

const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const ICON_PREV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
const ICON_NEXT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const same = (a: Date | null | undefined, b: Date | null | undefined) => !!a && !!b && a.getTime() === b.getTime();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseIso = (s?: string | null) => {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const cap = (s: string, locale: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
let uid = 0;

/** Ortak açılır pencere: tetiğin altında (yer yoksa üstünde), dışarı tıklayınca ve Esc ile kapanır */
function popover(trigger: HTMLElement, label: string) {
  const pop = document.createElement("div");
  pop.className = "bz-picker-pop";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", label);
  pop.id = `bz-pop-${++uid}`;
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-expanded", "false");
  let onClose: (() => void) | null = null;
  const place = () => {
    const r = trigger.getBoundingClientRect();
    const h = pop.offsetHeight;
    const w = pop.offsetWidth;
    // Görünen alan (mobilde innerHeight araç çubuklarını saymaz)
    const vv = window.visualViewport;
    const vTop = vv ? Math.max(0, vv.offsetTop) : 0, vLeft = vv ? Math.max(0, vv.offsetLeft) : 0;
    const vH = vv ? vv.height : document.documentElement.clientHeight || window.innerHeight;
    const vW = vv ? vv.width : document.documentElement.clientWidth || window.innerWidth;
    const below = vTop + vH - r.bottom;
    const above = r.top - vTop;
    const top = below < h + 12 && above > below ? r.top - h - 6 : r.bottom + 6;
    const left = Math.max(vLeft + 8, Math.min(r.left, vLeft + vW - w - 8));
    pop.style.top = `${Math.round(top + window.scrollY)}px`;
    pop.style.left = `${Math.round(left + window.scrollX)}px`;
  };
  const outside = (e: Event) => {
    if (!pop.contains(e.target as Node) && !trigger.contains(e.target as Node)) close(false);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close(true);
    }
  };
  function open(render: () => void, cb: () => void) {
    if (pop.isConnected) return;
    onClose = cb;
    render();
    document.body.appendChild(pop);
    place();
    trigger.setAttribute("aria-expanded", "true");
    // aria-controls yalnız açılır pencere sayfadayken: var olmayan öğeye başvuru ekran okuyucuda boşa düşer
    trigger.setAttribute("aria-controls", pop.id);
    setTimeout(() => document.addEventListener("pointerdown", outside, true));
    pop.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
  }
  function close(focusTrigger: boolean) {
    if (!pop.isConnected) return;
    pop.remove();
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-controls");
    document.removeEventListener("pointerdown", outside, true);
    pop.removeEventListener("keydown", key);
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, true);
    onClose?.();
    if (focusTrigger) trigger.focus();
  }
  return { pop, open, close, place };
}

function hiddenInput(trigger: HTMLElement, name?: string) {
  if (!name) return null;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  trigger.insertAdjacentElement("afterend", input);
  return input;
}

/** Tarih seçici (tek tarih veya aralık) */
export function bizmoDatePicker(trigger: HTMLButtonElement, opts: DatePickerOptions = {}) {
  const locale = opts.locale ?? document.documentElement.lang ?? "tr-TR";
  const mode = opts.mode ?? "single";
  const fmtDay = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const fmtMonth = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const fmtLong = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtWd = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdays = Array.from({ length: 7 }, (_, i) => fmtWd.format(new Date(2024, 0, 1 + i))); // Pazartesi başlar
  const today = day0(new Date());
  const placeholder = opts.placeholder ?? (mode === "range" ? "Tarih aralığı seçin" : "Tarih seçin");
  const hidden = hiddenInput(trigger, opts.name);
  let single: DateValue = mode === "single" ? ((opts.value as DateValue) ?? null) : null;
  let range: RangeValue = mode === "range" ? ((opts.value as RangeValue) ?? { start: null, end: null }) : { start: null, end: null };
  let focusDay = single ?? range.start ?? today;
  let view = new Date(focusDay.getFullYear(), focusDay.getMonth(), 1);
  const p = popover(trigger, mode === "range" ? "Tarih aralığı seçin" : "Tarih seçin");
  trigger.classList.add("bz-picker");
  trigger.type = "button";

  const disabled = (d: Date) => (opts.min && d < day0(opts.min)) || (opts.max && d > day0(opts.max));
  const label = () => {
    if (mode === "single") return single ? fmtDay.format(single) : "";
    if (!range.start) return "";
    return range.end ? `${fmtDay.format(range.start)} – ${fmtDay.format(range.end)}` : `${fmtDay.format(range.start)} – …`;
  };
  function paintTrigger() {
    const text = label();
    trigger.innerHTML = `${ICON_CAL}<span class="bz-picker__value" data-empty="${!text}">${text || placeholder}</span>`;
    if (hidden) hidden.value = mode === "single" ? (single ? iso(single) : "") : range.start && range.end ? `${iso(range.start)}/${iso(range.end)}` : "";
  }
  function month(first: Date, idx: number, count: number) {
    const offset = (first.getDay() + 6) % 7;
    const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let cells = weekdays.map((w) => `<span class="bz-calendar__weekday" aria-hidden="true">${w}</span>`).join("") + '<span aria-hidden="true"></span>'.repeat(offset);
    for (let n = 1; n <= days; n++) {
      const d = new Date(first.getFullYear(), first.getMonth(), n);
      let sel = false, rng = "";
      if (mode === "single") sel = same(d, single);
      else {
        const { start, end } = range;
        sel = same(d, start) || same(d, end);
        if (start && end && !same(start, end)) rng = same(d, start) ? "start" : same(d, end) ? "end" : d > start && d < end ? "middle" : "";
      }
      const dis = disabled(d);
      cells += `<button type="button" class="bz-day" data-t="${d.getTime()}" tabindex="${same(d, focusDay) ? 0 : -1}" aria-label="${fmtLong.format(d)}"${sel ? ' aria-selected="true"' : ""}${rng ? ` data-range="${rng}"` : ""}${same(d, today) ? ' aria-current="date"' : ""}${dis ? ' aria-disabled="true"' : ""}>${n}</button>`;
    }
    const nav = (dir: number, show: boolean, aria: string, icon: string) =>
      `<button type="button" class="bz-calendar__nav" data-nav="${dir}" aria-label="${aria}"${show ? "" : ' style="visibility:hidden"'}>${icon}</button>`;
    return `<div class="bz-calendar"><div class="bz-calendar__header">${nav(-1, idx === 0, "Önceki ay", ICON_PREV)}<span class="bz-calendar__title" aria-live="polite">${cap(fmtMonth.format(first), locale)}</span>${nav(1, idx === count - 1, "Sonraki ay", ICON_NEXT)}</div><div class="bz-calendar__grid" role="grid">${cells}</div></div>`;
  }
  function render() {
    const count = mode === "range" && (opts.months ?? (window.innerWidth >= 640 ? 2 : 1)) === 2 ? 2 : 1;
    const footer = mode === "range"
      ? `<div class="bz-picker-pop__footer"><span>${label() || "Başlangıç ve bitiş seçin"}</span><button type="button" class="bz-btn bz-btn--sm" data-act="clear">Temizle</button><button type="button" class="bz-btn bz-btn--primary bz-btn--sm" data-act="done"${range.start && range.end ? "" : " disabled"}>Uygula</button></div>`
      : `<div class="bz-picker-pop__footer"><button type="button" class="bz-btn bz-btn--ghost bz-btn--sm" data-act="today">Bugün</button><button type="button" class="bz-btn bz-btn--subtle bz-btn--sm" data-act="clear">Temizle</button></div>`;
    p.pop.innerHTML = `<div class="bz-picker-pop__months">${Array.from({ length: count }, (_, i) => month(addMonths(view, i), i, count)).join("")}</div>${footer}`;
  }
  function focusCurrent() {
    (p.pop.querySelector('.bz-day[tabindex="0"]') as HTMLElement | null)?.focus();
  }
  function moveFocus(d: Date) {
    focusDay = d;
    const count = p.pop.querySelectorAll(".bz-calendar").length;
    const last = addMonths(view, count - 1);
    if (d < view || d >= addMonths(last, 1)) view = new Date(d.getFullYear(), d.getMonth(), 1);
    render();
    focusCurrent();
  }
  function pick(d: Date) {
    if (disabled(d)) return;
    focusDay = d;
    if (mode === "single") {
      single = d;
      paintTrigger();
      opts.onChange?.(single);
      p.close(true);
      return;
    }
    if (!range.start || range.end) range = { start: d, end: null };
    else if (d < range.start) range = { start: d, end: null };
    else range = { start: range.start, end: d };
    paintTrigger();
    render();
    focusCurrent();
  }
  p.pop.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const nav = t.closest("[data-nav]") as HTMLElement | null;
    if (nav) {
      view = addMonths(view, Number(nav.dataset.nav));
      focusDay = new Date(view.getFullYear(), view.getMonth(), Math.min(focusDay.getDate(), 28));
      render();
      return;
    }
    const day = t.closest(".bz-day") as HTMLElement | null;
    if (day) return pick(new Date(Number(day.dataset.t)));
    const act = (t.closest("[data-act]") as HTMLElement | null)?.dataset.act;
    if (act === "today") return pick(today);
    if (act === "clear") {
      single = null;
      range = { start: null, end: null };
      paintTrigger();
      opts.onChange?.(mode === "single" ? null : range);
      if (mode === "single") p.close(true);
      else render();
    }
    if (act === "done") {
      opts.onChange?.(range);
      p.close(true);
    }
  });
  p.pop.addEventListener("keydown", (e) => {
    const day = (e.target as HTMLElement).closest(".bz-day") as HTMLElement | null;
    if (!day) return;
    const d = new Date(Number(day.dataset.t));
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(d, -1),
      ArrowRight: () => addDays(d, 1),
      ArrowUp: () => addDays(d, -7),
      ArrowDown: () => addDays(d, 7),
      Home: () => addDays(d, -((d.getDay() + 6) % 7)),
      End: () => addDays(d, 6 - ((d.getDay() + 6) % 7)),
      PageUp: () => new Date(d.getFullYear(), d.getMonth() - (e.shiftKey ? 12 : 1), d.getDate()),
      PageDown: () => new Date(d.getFullYear(), d.getMonth() + (e.shiftKey ? 12 : 1), d.getDate()),
    };
    if (moves[e.key]) {
      e.preventDefault();
      moveFocus(moves[e.key]());
    }
  });
  trigger.addEventListener("click", () => {
    if (trigger.getAttribute("aria-expanded") === "true") return p.close(true);
    focusDay = (mode === "single" ? single : range.end ?? range.start) ?? today;
    view = new Date(focusDay.getFullYear(), focusDay.getMonth() - (mode === "range" && range.end && window.innerWidth >= 640 ? 1 : 0), 1);
    p.open(render, () => undefined);
    focusCurrent();
  });
  paintTrigger();
  return {
    open: () => trigger.click(),
    close: () => p.close(false),
    getValue: () => (mode === "single" ? single : { ...range }),
    setValue(v: DateValue | RangeValue) {
      if (mode === "single") single = (v as DateValue) ? day0(v as Date) : null;
      else range = { start: (v as RangeValue)?.start ? day0((v as RangeValue).start!) : null, end: (v as RangeValue)?.end ? day0((v as RangeValue).end!) : null };
      paintTrigger();
    },
  };
}

/** Saat seçici: saat ve dakika sütunları (adım 5/10/15/30), "Şimdi" kısayolu */
export function bizmoTimePicker(trigger: HTMLButtonElement, opts: TimePickerOptions = {}) {
  const step = opts.step ?? 15;
  const hidden = hiddenInput(trigger, opts.name);
  const placeholder = opts.placeholder ?? "Saat seçin";
  let value: string | null = opts.value ?? null;
  const p = popover(trigger, "Saat seçin");
  trigger.classList.add("bz-picker");
  trigger.type = "button";
  const pad = (n: number) => String(n).padStart(2, "0");
  const toMin = (v: string) => { const [h, m] = v.split(":").map(Number); return h * 60 + m; };
  const allowed = (v: string) => (!opts.min || toMin(v) >= toMin(opts.min)) && (!opts.max || toMin(v) <= toMin(opts.max));
  function paintTrigger() {
    trigger.innerHTML = `${ICON_CLOCK}<span class="bz-picker__value" data-empty="${!value}">${value ?? placeholder}</span>`;
    if (hidden) hidden.value = value ?? "";
  }
  function render() {
    const [h, m] = (value ?? "").split(":");
    const hours = Array.from({ length: 24 }, (_, i) => pad(i));
    const mins = Array.from({ length: Math.ceil(60 / step) }, (_, i) => pad(i * step));
    const col = (kind: string, items: string[], cur: string | undefined, label: string) =>
      `<div class="bz-time__col" role="listbox" aria-label="${label}" data-kind="${kind}"><div class="bz-time__head">${label}</div>${items.map((x) => `<button type="button" class="bz-time__opt" role="option" data-v="${x}" aria-selected="${x === cur}" tabindex="${x === (cur ?? items[0]) ? 0 : -1}">${x}</button>`).join("")}</div>`;
    p.pop.innerHTML = `<div class="bz-time">${col("h", hours, h, "Saat")}${col("m", mins, m, "Dakika")}</div><div class="bz-picker-pop__footer"><button type="button" class="bz-btn bz-btn--ghost bz-btn--sm" data-act="now">Şimdi</button><button type="button" class="bz-btn bz-btn--primary bz-btn--sm" data-act="done"${value ? "" : " disabled"}>Tamam</button></div>`;
    p.pop.querySelectorAll('.bz-time__opt[aria-selected="true"]').forEach((el) => (el as HTMLElement).scrollIntoView({ block: "center" }));
  }
  function set(h: string, m: string) {
    const v = `${h}:${m}`;
    if (!allowed(v)) return;
    value = v;
    paintTrigger();
    opts.onChange?.(value);
  }
  p.pop.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const opt = t.closest(".bz-time__opt") as HTMLElement | null;
    if (opt) {
      const kind = (opt.parentElement as HTMLElement).dataset.kind;
      const [h, m] = (value ?? "09:00").split(":");
      if (kind === "h") set(opt.dataset.v!, m);
      else set(h, opt.dataset.v!);
      const focusKind = kind;
      render();
      (p.pop.querySelector(`[data-kind="${focusKind}"] .bz-time__opt[aria-selected="true"]`) as HTMLElement | null)?.focus();
      return;
    }
    const act = (t.closest("[data-act]") as HTMLElement | null)?.dataset.act;
    if (act === "now") {
      const d = new Date();
      const mm = Math.round(d.getMinutes() / step) * step;
      const carry = mm >= 60 ? 1 : 0;
      set(pad((d.getHours() + carry) % 24), pad(mm % 60));
      render();
    }
    if (act === "done") p.close(true);
  });
  p.pop.addEventListener("keydown", (e) => {
    const opt = (e.target as HTMLElement).closest(".bz-time__opt") as HTMLElement | null;
    if (!opt) return;
    const sib = e.key === "ArrowDown" ? opt.nextElementSibling : e.key === "ArrowUp" ? opt.previousElementSibling : null;
    if (sib && sib.classList.contains("bz-time__opt")) {
      e.preventDefault();
      opt.tabIndex = -1;
      (sib as HTMLElement).tabIndex = 0;
      (sib as HTMLElement).focus();
    }
  });
  trigger.addEventListener("click", () => {
    if (trigger.getAttribute("aria-expanded") === "true") return p.close(true);
    p.open(render, () => undefined);
    (p.pop.querySelector('.bz-time__opt[tabindex="0"]') as HTMLElement | null)?.focus();
  });
  paintTrigger();
  return {
    open: () => trigger.click(),
    close: () => p.close(false),
    getValue: () => value,
    setValue(v: string | null) {
      value = v;
      paintTrigger();
    },
  };
}

/** data-bz-datepicker / data-bz-timepicker özniteliklerini taşıyan düğmeleri bir kez başlatır */
export function bizmoInitPickers(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>("button[data-bz-datepicker]:not([data-bz-ready])").forEach((b) => {
    b.dataset.bzReady = "1";
    const mode = b.dataset.mode === "range" ? "range" : "single";
    const v = b.dataset.value;
    const value = mode === "range" ? (() => { const [s, e] = (v ?? "").split("/"); return { start: parseIso(s), end: parseIso(e) }; })() : parseIso(v);
    bizmoDatePicker(b, { mode, value, name: b.dataset.name, placeholder: b.dataset.placeholder, min: parseIso(b.dataset.min) ?? undefined, max: parseIso(b.dataset.max) ?? undefined });
  });
  root.querySelectorAll<HTMLButtonElement>("button[data-bz-timepicker]:not([data-bz-ready])").forEach((b) => {
    b.dataset.bzReady = "1";
    bizmoTimePicker(b, { value: b.dataset.value ?? null, step: Number(b.dataset.step) || 15, name: b.dataset.name, placeholder: b.dataset.placeholder, min: b.dataset.min, max: b.dataset.max });
  });
}
