/**
 * Bizmo Universal Theme · dokunma ve dokunsal geri bildirim (iOS tarzı, çerçeveden bağımsız)
 *
 *   bizmoHaptic("success", { el })              dokunsal geri bildirim (Android titreşim · iOS 18+ Safari sistem haptiği) + durum renginde ışıma
 *   bizmoFlash(el, "warning")                   görsel yönetim: değişen öğe yeni durumunun renginde kısa süre ışır
 *   bizmoAutoHaptics(document)                  anahtar, segment, sekme, takvim gibi seçim kontrollerinde otomatik "selection"
 *   bizmoContextMenu(el, { items })             Haptic Touch: basılı tut (dokunmatik) · sağ tık · Shift+F10 → önizleme + menü
 *   bizmoSwipeActions(row, { left, right })     satırı kaydırınca eylemler (tam kaydırma birincil eylemi uygular)
 *   bizmoPullToRefresh(scroller, { onRefresh }) aşağı çekip yenile
 *   bizmoSheet(content, { detents })            tutamaçlı alt sayfa (yarım / tam), sürükleyip kapat
 *   bizmoUndoToast("Silindi", { onUndo })       "Geri al" süreli toast (yıkıcı işlemde onay penceresi yerine)
 *   bizmoSegmented(el)                          kayan göstergeli segment
 *
 * Görünüm components.css'teki .bz-ctx-*, .bz-swipe*, .bz-ptr, .bz-sheet*, .bz-segmented__thumb sınıflarından gelir.
 * Her hareketin hareketsiz karşılığı olmalıdır (⋯ menüsü, yenile düğmesi, kapat düğmesi, Esc) — DESIGN.md §25.
 */

export type HapticKind = "selection" | "light" | "medium" | "heavy" | "success" | "warning" | "error";

const VIBRATE: Record<HapticKind, number | number[]> = {
  selection: 8,
  light: 10,
  medium: 18,
  heavy: 28,
  success: [12, 70, 18],
  warning: [20, 90, 20],
  error: [28, 60, 28, 60, 28],
};
// iOS'ta yalnız tek tip "tık" var; kalıplar tık sayısı ve aralığıyla verilir
const IOS_TICKS: Record<HapticKind, number[]> = {
  selection: [0],
  light: [0],
  medium: [0],
  heavy: [0, 40],
  success: [0, 110],
  warning: [0, 140],
  error: [0, 80, 160],
};

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

let enabled: boolean | null = null;

/** Kullanıcı tercihi (localStorage "bz-haptics"; <html data-haptics="off"> da kapatır) */
export const bizmoHaptics = {
  get enabled(): boolean {
    if (typeof document !== "undefined" && document.documentElement.dataset.haptics === "off") return false;
    if (enabled === null) {
      try {
        enabled = localStorage.getItem("bz-haptics") !== "off";
      } catch {
        enabled = true;
      }
    }
    return enabled;
  },
  setEnabled(on: boolean) {
    enabled = on;
    try {
      localStorage.setItem("bz-haptics", on ? "on" : "off");
    } catch {
      /* özel pencere vb. */
    }
  },
  /** "vibrate" (Android), "ios" (iOS 18+ Safari), "none" (masaüstü, eski iOS) */
  get support(): "vibrate" | "ios" | "none" {
    if (typeof navigator === "undefined") return "none";
    if (isIOS()) return "ios";
    return typeof navigator.vibrate === "function" && navigator.maxTouchPoints > 0 ? "vibrate" : "none";
  },
};

function iosTick() {
  // iOS 18+: <input type="checkbox" switch> kullanıcı eylemiyle değişince sistem haptiği verir
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.display = "none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.head.appendChild(label);
  label.click();
  label.remove();
}

/**
 * Görsel yönetim tonu (andon): durumun rengi. Renk tek başına bilgi taşımaz; yanında etiket veya ikon bulunur.
 *   success  çalışıyor · tamamlandı · onaylandı        warning  uyarı · incelemede · bugün · ertelendi
 *   danger   arıza · gecikmiş · reddedildi · silindi    info     devam ediyor · bilgi · seçim
 *   neutral  boşta · yapılacak · taslak                 accent   marka sinyali (birincil eylem)
 */
export type BizmoTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

/** Haptik türünün görsel karşılığı */
export const HAPTIC_TONE: Record<HapticKind, BizmoTone> = {
  selection: "info",
  light: "neutral",
  medium: "neutral",
  heavy: "neutral",
  success: "success",
  warning: "warning",
  error: "danger",
};
/** Bir öğe yeni duruma geçtiğinde verilecek haptik */
export const TONE_HAPTIC: Record<BizmoTone, HapticKind> = {
  neutral: "light",
  info: "selection",
  accent: "selection",
  success: "success",
  warning: "warning",
  danger: "error",
};

const flashTimers = new WeakMap<Element, number>();

/**
 * Görsel yönetim ışıması: öğe tonun renginde kısa süre parlar (halka + zemin tonu, ~0,6 sn).
 * Durum değişikliğini herkes görür; haptik desteklemeyen cihazda da, sessizdeyken de çalışır.
 * Hareket azaltılmışsa yalnız renk geçişi kalır (components.css).
 */
export function bizmoFlash(el: Element | null | undefined, tone: BizmoTone = "accent") {
  const h = el as HTMLElement | null;
  if (!h?.isConnected) return;
  clearTimeout(flashTimers.get(h));
  delete h.dataset.hapticFlash;
  void h.offsetWidth; // aynı öğede art arda ışımayı yeniden başlat
  h.dataset.hapticFlash = tone;
  flashTimers.set(h, window.setTimeout(() => delete h.dataset.hapticFlash, 700));
}

/**
 * Dokunsal geri bildirim. Kullanıcı eylemi (tıklama, dokunma) içinde çağrılmalıdır.
 * opts.el verilirse öğe durum renginde ışır (bizmoFlash): bildirim türlerinde (success / warning / error)
 * ve ton verildiğinde her zaman, seçim türlerinde yalnız cihaz haptik veremiyorsa. opts.visual bunu zorlar.
 */
export function bizmoHaptic(kind: HapticKind = "selection", opts: { el?: Element | null; tone?: BizmoTone; visual?: boolean } = {}) {
  const on = bizmoHaptics.enabled;
  const support = bizmoHaptics.support;
  if (on && support === "vibrate") navigator.vibrate(VIBRATE[kind]);
  else if (on && support === "ios") IOS_TICKS[kind].forEach((ms) => (ms ? setTimeout(iosTick, ms) : iosTick()));
  if (opts.el) {
    const notify = kind === "success" || kind === "warning" || kind === "error" || !!opts.tone;
    if (opts.visual ?? (notify || !on || support === "none")) bizmoFlash(opts.el, opts.tone ?? HAPTIC_TONE[kind]);
  }
  return on && support !== "none";
}

/** Seçim kontrollerinde otomatik haptik + [data-haptic="success"] (isteğe bağlı data-haptic-tone) bildirimsel kullanım */
export function bizmoAutoHaptics(root: Document | HTMLElement = document) {
  const SELECT = ".bz-switch, .bz-segmented > button, .bz-tab, .bz-bottom-nav__item, .bz-day, .bz-time__opt, .bz-task__check, .bz-check input, .bz-radio input, .bz-chip[aria-pressed], .bz-reaction, .bz-option";
  const onClick = (e: Event) => {
    const t = e.target as HTMLElement;
    const explicit = t.closest("[data-haptic]") as HTMLElement | null;
    if (explicit) return bizmoHaptic((explicit.dataset.haptic as HapticKind) || "selection", { el: explicit, tone: explicit.dataset.hapticTone as BizmoTone | undefined });
    if (t.closest(SELECT)) bizmoHaptic("selection");
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
}

// ───────────────────────── Basılı tutma ─────────────────────────

/** Dokunmatikte basılı tutma (varsayılan 450 ms). Basarken data-pressing="true" ile hafif küçülme */
export function bizmoLongPress(el: HTMLElement, onPress: (e: PointerEvent) => void, opts: { delay?: number; tolerance?: number } = {}) {
  const delay = opts.delay ?? 450;
  const tol = opts.tolerance ?? 8;
  let timer = 0;
  let pressTimer = 0;
  let start: [number, number] | null = null;
  const cancel = () => {
    clearTimeout(timer);
    clearTimeout(pressTimer);
    start = null;
    delete el.dataset.pressing;
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || e.button > 0) return;
    start = [e.clientX, e.clientY];
    pressTimer = window.setTimeout(() => (el.dataset.pressing = "true"), 120);
    timer = window.setTimeout(() => {
      delete el.dataset.pressing;
      start = null;
      onPress(e);
    }, delay);
  };
  const move = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > tol) cancel();
  };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", cancel);
  el.addEventListener("pointercancel", cancel);
  el.addEventListener("pointerleave", cancel);
  return () => {
    cancel();
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", cancel);
    el.removeEventListener("pointercancel", cancel);
    el.removeEventListener("pointerleave", cancel);
  };
}

// ───────────────────────── Bağlam menüsü (Haptic Touch) ─────────────────────────

export type MenuItem =
  | {
      label: string;
      icon?: string;
      /** Öğe değiştiyse yeniden çizilen öğeyi döndürün: ışıma ona uygulanır */
      onSelect?: () => void | Element | null;
      destructive?: boolean;
      disabled?: boolean;
      shortcut?: string;
      /** Görsel yönetim tonu: ikon bu renkte; seçilince hedef bu renkte ışır ve tona uygun haptik verilir */
      tone?: BizmoTone;
      /** Seçenek grubunda geçerli durum (✓ ve aria-checked); tanımlıysa öğe menuitemradio olur */
      checked?: boolean;
      /** Varsayılan haptiği değiştirir */
      haptic?: HapticKind;
    }
  | "separator";

export type ContextMenuOptions = {
  items: MenuItem[] | ((el: HTMLElement) => MenuItem[]);
  /** Menü başlığı (ör. dosya adı) */
  title?: string | ((el: HTMLElement) => string);
  /** Önizleme: varsayılan öğenin kopyası; özel içerik için öğe döndürün */
  preview?: (el: HTMLElement) => HTMLElement | null;
  /** İkonlar için SVG üretici (ör. lucide adı → SVG). Verilmezse ikon gösterilmez */
  icon?: (name: string) => string;
  /** iMessage tarzı hızlı tepki satırı (menünün üstünde) */
  reactions?: { emojis: string[]; onSelect: (emoji: string, el: HTMLElement) => void } | ((el: HTMLElement) => { emojis: string[]; onSelect: (emoji: string, el: HTMLElement) => void } | null);
  /** Menü çizildikten sonra (ör. ikon kütüphanesini çalıştırmak için) */
  onOpen?: (menu: HTMLElement) => void;
  /** Menü kapanınca (seçim yapılsa da yapılmasa da) */
  onClose?: () => void;
};

let openMenu: { close: (focus?: boolean) => void } | null = null;

/** Katmanların ekleneceği yer: tam ekrandaki öğe (andon TV modu, 3B sahne) varsa onun içi, yoksa body */
export function bizmoLayerHost(): HTMLElement {
  return (document.fullscreenElement as HTMLElement | null) ?? document.body;
}

/**
 * Görünen alan, istemci (position: fixed) koordinatlarında. Mobilde window.innerHeight araç çubuklarını ve
 * yatay taşmayı hesaba katmaz (görünenden büyük olabilir); visualViewport gerçekten görünen dikdörtgeni verir.
 */
export function bizmoViewport() {
  const vv = window.visualViewport;
  const de = document.documentElement;
  const lw = de.clientWidth || window.innerWidth;
  const lh = de.clientHeight || window.innerHeight;
  if (!vv) return { left: 0, top: 0, width: lw, height: lh };
  const left = Math.max(0, vv.offsetLeft), top = Math.max(0, vv.offsetTop);
  return { left, top, width: Math.min(vv.width, lw - left), height: Math.min(vv.height, Math.max(lh, window.innerHeight) - top) };
}

// Önizleme kopyası: üst öğeye bağlı görünüm (ör. kendi iletinizin yeşil balonu) kopyada kaybolmasın diye hesaplanan renkler taşınır
function cloneWithLook(el: HTMLElement) {
  const c = el.cloneNode(true) as HTMLElement;
  const cs = getComputedStyle(el);
  Object.assign(c.style, { backgroundColor: cs.backgroundColor, color: cs.color, borderColor: cs.borderColor, borderRadius: cs.borderRadius });
  return c;
}

function showContextMenu(target: HTMLElement, opts: ContextMenuOptions, via: "pointer" | "keyboard", at?: { x: number; y: number }) {
  openMenu?.close(false);
  const items = typeof opts.items === "function" ? opts.items(target) : opts.items;
  const title = typeof opts.title === "function" ? opts.title(target) : opts.title;
  const rect = target.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "bz-ctx-layer";
  const previewEl = opts.preview ? opts.preview(target) : cloneWithLook(target);
  const preview = document.createElement("div");
  preview.className = "bz-ctx-preview";
  if (previewEl) {
    previewEl.removeAttribute("id");
    preview.appendChild(previewEl);
  }
  const menu = document.createElement("div");
  menu.className = items.some((it) => it !== "separator" && it.checked !== undefined) ? "bz-ctx-menu bz-ctx-menu--checks" : "bz-ctx-menu";
  menu.setAttribute("role", "menu");
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  menu.innerHTML =
    (title ? `<div class="bz-ctx-menu__title">${esc(title)}</div>` : "") +
    items
      .map((it, i) =>
        it === "separator"
          ? '<div class="bz-ctx-menu__sep" role="separator"></div>'
          : `<button type="button" role="${it.checked === undefined ? "menuitem" : "menuitemradio"}"${it.checked === undefined ? "" : ` aria-checked="${it.checked}"`} class="bz-ctx-menu__item${it.destructive ? " bz-ctx-menu__item--danger" : ""}"${it.tone ? ` data-tone="${it.tone}"` : ""} data-i="${i}"${it.disabled ? ' aria-disabled="true" tabindex="-1"' : ' tabindex="-1"'}><span>${esc(it.label)}</span>${it.shortcut ? `<span class="bz-ctx-menu__key">${esc(it.shortcut)}</span>` : ""}${it.icon && opts.icon ? opts.icon(it.icon) : ""}</button>`,
      )
      .join("");
  const react = typeof opts.reactions === "function" ? opts.reactions(target) : opts.reactions;
  let reactBar: HTMLElement | null = null;
  if (react) {
    reactBar = document.createElement("div");
    reactBar.className = "bz-ctx-reactions";
    reactBar.setAttribute("role", "group");
    reactBar.setAttribute("aria-label", "Hızlı tepki");
    reactBar.innerHTML = react.emojis.map((e) => `<button type="button" class="bz-ctx-reactions__btn" data-e="${esc(e)}" aria-label="${esc(e)} tepkisi">${esc(e)}</button>`).join("");
    reactBar.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-e]") as HTMLElement | null;
      if (!b) return;
      bizmoHaptic("selection");
      close();
      react.onSelect(b.dataset.e!, target);
    });
  }
  layer.append(preview, menu);
  if (reactBar) layer.append(reactBar);
  bizmoLayerHost().appendChild(layer);

  // Yerleşim (görüntü alanına göre):
  //  · önizlemeli (basılı tut): kopya öğenin yerinde, menü altında; öğe ekranın sağ yarısındaysa menü ve tepki satırı sağa hizalanır
  //  · imleçte (sağ tık): menü imlecin sağına / altına; sığmazsa yerel menüler gibi soluna / üstüne açılır
  //  · menü ekrana sığmıyorsa kendi içinde kayar; hiçbir parça ekran dışına taşmaz
  const M = 12;
  const V = bizmoViewport();
  const vw = V.width, vh = V.height;
  const showPreview = via !== "keyboard" && !!previewEl && !at;
  preview.hidden = !showPreview;
  // Öğe yalnız önizleme kopyası yerinde "kalkarken" gizlenir; imleçte açılan menüde (sağ tık, 3B tuval) yerinde kalır
  if (showPreview) target.dataset.ctxOpen = "true";
  const clampX = (x: number, w: number) => Math.max(V.left + M, Math.min(x, V.left + vw - w - M));
  const clampY = (y: number, h: number) => Math.max(V.top + M, Math.min(y, V.top + vh - h - M));
  const rh = reactBar ? reactBar.offsetHeight + 10 : 0;
  const pw = Math.min(rect.width, vw - 2 * M);
  const ph = showPreview ? Math.min(rect.height, vh * 0.45) : 0;
  menu.style.maxHeight = `${Math.max(160, vh - 2 * M - rh - (showPreview ? ph + 10 : 0))}px`;
  const mh = menu.offsetHeight;
  const mw = menu.offsetWidth;
  let menuLeft: number, menuTop: number, rowLeft: number, rowRight: number, alignRight: boolean;
  if (showPreview) {
    alignRight = rect.left + rect.width / 2 > V.left + vw / 2;
    // Önizleme + menü (+ tepki satırı) tek blok olarak dikeyde ekrana sığdırılır
    const block = rh + ph + 10 + mh;
    const top = clampY(rect.top - rh, block) + rh;
    const left = clampX(rect.left, pw);
    Object.assign(preview.style, { top: `${top}px`, left: `${left}px`, width: `${pw}px`, maxHeight: `${ph}px` });
    menuTop = top + ph + 10;
    menuLeft = clampX(alignRight ? left + pw - mw : left, mw);
    rowLeft = left;
    rowRight = left + pw;
  } else {
    const x = at?.x ?? rect.left;
    const y = at?.y ?? rect.bottom + 6;
    alignRight = x + mw > V.left + vw - M; // sağda yer yok: imlecin soluna
    menuLeft = clampX(alignRight ? x - mw : x, mw);
    const below = y + mh <= V.top + vh - M;
    menuTop = clampY(below ? Math.max(V.top + M + rh, y) : Math.max(V.top + M + rh, (at ? y : rect.top - 6) - mh), mh); // altta yer yok: yukarı
    rowLeft = menuLeft;
    rowRight = menuLeft + mw;
  }
  Object.assign(menu.style, { top: `${menuTop}px`, left: `${menuLeft}px`, transformOrigin: alignRight ? "top right" : "top left" });
  if (reactBar) {
    const rw = reactBar.offsetWidth;
    const rowTop = showPreview ? parseFloat(preview.style.top) - rh : menuTop - rh;
    Object.assign(reactBar.style, { top: `${Math.max(V.top + M, rowTop)}px`, left: `${clampX(alignRight ? rowRight - rw : rowLeft, rw)}px` });
  }

  const buttons = [...menu.querySelectorAll<HTMLButtonElement>(".bz-ctx-menu__item:not([aria-disabled])")];
  const prevFocus = document.activeElement as HTMLElement | null;
  function close(focus = true) {
    if (!layer.isConnected) return;
    layer.dataset.state = "closing";
    delete target.dataset.ctxOpen;
    setTimeout(() => layer.remove(), 160);
    document.removeEventListener("keydown", key, true);
    openMenu = null;
    opts.onClose?.();
    if (focus) (via === "keyboard" ? target : prevFocus)?.focus?.({ preventScroll: true } as FocusOptions);
  }
  function key(e: KeyboardEvent) {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = buttons.length;
      buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + n) % n]?.focus();
    } else if (e.key === "Tab") { e.preventDefault(); }
  }
  document.addEventListener("keydown", key, true);
  layer.addEventListener("pointerdown", (e) => { if (e.target === layer || e.target === preview || preview.contains(e.target as Node)) close(); });
  menu.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest(".bz-ctx-menu__item") as HTMLElement | null;
    if (!b || b.getAttribute("aria-disabled") === "true") return;
    const it = items[Number(b.dataset.i)] as Exclude<MenuItem, "separator">;
    bizmoHaptic(it.haptic ?? (it.tone ? TONE_HAPTIC[it.tone] : it.destructive ? "medium" : "selection"));
    close();
    const changed = it.onSelect?.();
    // Görsel yönetim: değişen öğe yeni durumunun renginde ışır (yeniden çizildiyse döndürülen öğe)
    if (it.tone) bizmoFlash(changed instanceof Element ? changed : target, it.tone);
  });
  (via === "keyboard" ? buttons[0] : menu)?.focus?.({ preventScroll: true } as FocusOptions);
  if (via !== "keyboard") menu.tabIndex = -1;
  openMenu = { close };
  opts.onOpen?.(menu);
  return { close };
}

/** Menüyü doğrudan aç (3B tuval, grid hücresi gibi kendi olayını yöneten yerler için). at verilirse imleçte, önizlemesiz */
export function bizmoOpenContextMenu(anchor: HTMLElement, opts: ContextMenuOptions, at?: { x: number; y: number }) {
  return showContextMenu(anchor, opts, at ? "pointer" : "keyboard", at);
}

/**
 * Yetki devriyle bağlam menüsü: kök içindeki selector'a uyan her öğe (sonradan eklenenler dahil) için
 * sağ tık, dokunmatikte basılı tutma ve Shift+F10 / ContextMenu tuşu aynı menüyü açar.
 */
export function bizmoContextMenuDelegate(root: HTMLElement | Document, selector: string, opts: ContextMenuOptions & { delay?: number }) {
  const delay = opts.delay ?? 450;
  let timer = 0, pressTimer = 0, start: [number, number] | null = null, el: HTMLElement | null = null, fired = false;
  const cancel = () => {
    clearTimeout(timer);
    clearTimeout(pressTimer);
    if (el) delete el.dataset.pressing;
    start = null;
  };
  const down = (e: Event) => {
    const pe = e as PointerEvent;
    const t = (pe.target as HTMLElement).closest(selector) as HTMLElement | null;
    if (!t || pe.pointerType === "mouse" || pe.button > 0) return;
    el = t;
    el.dataset.bzCtx = "";
    fired = false;
    start = [pe.clientX, pe.clientY];
    pressTimer = window.setTimeout(() => el && (el.dataset.pressing = "true"), 120);
    timer = window.setTimeout(() => {
      if (!el) return;
      delete el.dataset.pressing;
      fired = true;
      bizmoHaptic("medium");
      showContextMenu(el, opts, "pointer");
    }, delay);
  };
  const move = (e: Event) => {
    const pe = e as PointerEvent;
    if (start && Math.hypot(pe.clientX - start[0], pe.clientY - start[1]) > 8) cancel();
  };
  const ctx = (e: Event) => {
    const me = e as MouseEvent;
    const t = (me.target as HTMLElement).closest(selector) as HTMLElement | null;
    if (!t) return;
    me.preventDefault();
    if (fired || openMenu || matchMedia("(pointer: coarse)").matches) return;
    showContextMenu(t, opts, "pointer", { x: me.clientX, y: me.clientY });
  };
  const key = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== "ContextMenu" && !(ke.shiftKey && ke.key === "F10")) return;
    const t = (ke.target as HTMLElement).closest(selector) as HTMLElement | null;
    if (!t) return;
    ke.preventDefault();
    showContextMenu(t, opts, "keyboard");
  };
  // Basılı tutma menü açtıysa ardından gelen tıklama seçim yapmasın
  const clickGuard = (e: Event) => { if (fired) { e.stopPropagation(); e.preventDefault(); fired = false; } };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointermove", move);
  root.addEventListener("pointerup", cancel);
  root.addEventListener("pointercancel", cancel);
  root.addEventListener("contextmenu", ctx);
  root.addEventListener("keydown", key);
  root.addEventListener("click", clickGuard, true);
  return () => {
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointermove", move);
    root.removeEventListener("pointerup", cancel);
    root.removeEventListener("pointercancel", cancel);
    root.removeEventListener("contextmenu", ctx);
    root.removeEventListener("keydown", key);
    root.removeEventListener("click", clickGuard, true);
  };
}

/**
 * iOS Haptic Touch karşılığı: dokunmatikte basılı tut, masaüstünde sağ tık, klavyede Shift+F10 / ContextMenu tuşu.
 * Öğeye ayrıca görünür bir "⋯" düğmesi koyup open() ile aynı menüyü açın (hareketsiz karşılık).
 */
export function bizmoContextMenu(el: HTMLElement, opts: ContextMenuOptions) {
  el.dataset.bzCtx = "";
  const open = (via: "pointer" | "keyboard" = "keyboard", at?: { x: number; y: number }) => showContextMenu(el, opts, via, at);
  const offLong = bizmoLongPress(el, () => {
    bizmoHaptic("medium");
    open("pointer");
  });
  const onContext = (e: MouseEvent) => {
    e.preventDefault();
    if (openMenu) return;
    // Dokunmatikte (Android) contextmenu da gelir; basılı tutma zaten açtıysa ikinci kez açma
    const touch = (e as PointerEvent).pointerType === "touch" || matchMedia("(pointer: coarse)").matches;
    if (touch) return;
    open("pointer", { x: e.clientX, y: e.clientY });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
      e.preventDefault();
      open("keyboard");
    }
  };
  el.addEventListener("contextmenu", onContext);
  el.addEventListener("keydown", onKey);
  return {
    open: () => open("keyboard"),
    destroy() {
      offLong();
      el.removeEventListener("contextmenu", onContext);
      el.removeEventListener("keydown", onKey);
    },
  };
}

// ───────────────────────── Kaydırma eylemleri ─────────────────────────

export type SwipeAction = {
  label: string;
  icon?: string;
  /** Eylem rengi; uygulanınca satır bu renkte ışır ve tona uygun haptik verilir ("data" = "info") */
  tone?: "accent" | "success" | "info" | "data" | "danger" | "warning" | "neutral";
  /** Satır yeniden çizildiyse yeni öğeyi döndürün: ışıma ona uygulanır */
  onSelect: () => void | Element | null;
};

const swipeTone = (a: SwipeAction): BizmoTone => (a.tone === "data" ? "info" : a.tone ?? "neutral");

/**
 * Satır kaydırma eylemleri. Yapı: .bz-swipe > .bz-swipe__content (kaydırılan satır).
 * Sola kaydırma → right eylemleri (sağda belirir), sağa kaydırma → left eylemleri. Tam kaydırma ilk eylemi uygular.
 */
export function bizmoSwipeActions(row: HTMLElement, opts: { left?: SwipeAction[]; right?: SwipeAction[]; icon?: (name: string) => string; fullSwipe?: boolean }) {
  const content = row.querySelector<HTMLElement>(".bz-swipe__content");
  if (!content) throw new Error("bizmoSwipeActions: .bz-swipe__content bulunamadı");
  const W = 76;
  const mk = (side: "left" | "right", acts: SwipeAction[]) => {
    const box = document.createElement("div");
    box.className = `bz-swipe__actions bz-swipe__actions--${side}`;
    box.innerHTML = acts.map((a, i) => `<button type="button" class="bz-swipe__action" data-tone="${a.tone ?? "neutral"}" data-i="${i}" tabindex="-1">${a.icon && opts.icon ? opts.icon(a.icon) : ""}<span>${a.label}</span></button>`).join("");
    box.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest(".bz-swipe__action") as HTMLElement | null;
      if (!b) return;
      settle(0);
      run(acts[Number(b.dataset.i)]);
    });
    row.insertBefore(box, content);
    return box;
  };
  const leftActs = opts.left ?? [];
  const rightActs = opts.right ?? [];
  const leftBox = leftActs.length ? mk("left", leftActs) : null;
  const rightBox = rightActs.length ? mk("right", rightActs) : null;
  const maxL = leftActs.length * W;
  const maxR = rightActs.length * W;
  let x = 0, startX = 0, startY = 0, base = 0, dragging = false, decided = false, armed = false;
  const full = () => row.offsetWidth * 0.62;
  const set = (v: number, animate: boolean) => {
    x = v;
    content.style.transition = animate ? "transform var(--bz-duration-slow) var(--bz-ease-emphasis)" : "none";
    content.style.transform = v ? `translateX(${v}px)` : "";
    row.dataset.swipe = v > 0 ? "left" : v < 0 ? "right" : "";
    if (leftBox) leftBox.style.width = `${Math.max(0, v)}px`;
    if (rightBox) rightBox.style.width = `${Math.max(0, -v)}px`;
  };
  function settle(v: number) { set(v, true); }
  // Eylemi uygula: tona uygun haptik (silme gibi yıkıcı eylemde "medium") + satır yeni durumunun renginde ışır
  function run(a: SwipeAction | undefined) {
    if (!a) return;
    const tone = swipeTone(a);
    bizmoHaptic(tone === "danger" ? "medium" : TONE_HAPTIC[tone]);
    const changed = a.onSelect();
    bizmoFlash(changed instanceof Element ? changed : content, tone);
  }
  const down = (e: PointerEvent) => {
    if (e.button > 0 || (e.target as HTMLElement).closest("input, button, a, textarea, select")) return;
    startX = e.clientX; startY = e.clientY; base = x; dragging = true; decided = false; armed = false;
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = true;
      if (Math.abs(dy) > Math.abs(dx)) { dragging = false; return; } // dikey kaydırma: listeye bırak
      try { content.setPointerCapture(e.pointerId); } catch { /* işaretçi bırakılmış olabilir */ }
      row.dataset.dragging = "true";
    }
    let v = base + dx;
    const lim = v > 0 ? (opts.fullSwipe === false ? maxL : row.offsetWidth) : (opts.fullSwipe === false ? maxR : row.offsetWidth);
    if (v > 0 && !leftActs.length) v = v * 0.15;
    if (v < 0 && !rightActs.length) v = v * 0.15;
    if (Math.abs(v) > lim) v = Math.sign(v) * (lim + (Math.abs(v) - lim) * 0.2);
    set(v, false);
    const over = opts.fullSwipe !== false && Math.abs(v) > full();
    if (over !== armed) {
      armed = over;
      row.dataset.armed = String(over);
      // Eşik: ilk eylemin tonu satırın kenarında belirir (sola / sağa göre)
      const first = (v > 0 ? leftActs : rightActs)[0];
      if (over && first) row.dataset.armedTone = swipeTone(first);
      else delete row.dataset.armedTone;
      bizmoHaptic(over ? "medium" : "selection");
    }
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    delete row.dataset.dragging;
    if (!decided) return;
    row.dataset.armed = "false";
    delete row.dataset.armedTone;
    if (armed) {
      const acts = x > 0 ? leftActs : rightActs;
      set(Math.sign(x) * row.offsetWidth, true);
      setTimeout(() => { set(0, false); run(acts[0]); }, 220);
      return;
    }
    if (x > maxL / 2 && leftActs.length) settle(maxL);
    else if (x < -maxR / 2 && rightActs.length) settle(-maxR);
    else settle(0);
  };
  // Açıkken içeriğe tıklamak kapatır (seçim yapmaz)
  const clickGuard = (e: MouseEvent) => { if (x !== 0 && !dragging) { e.stopPropagation(); e.preventDefault(); settle(0); } };
  content.addEventListener("pointerdown", down);
  content.addEventListener("pointermove", move);
  content.addEventListener("pointerup", up);
  content.addEventListener("pointercancel", up);
  content.addEventListener("click", clickGuard, true);
  return { close: () => settle(0), open: (side: "left" | "right") => settle(side === "left" ? maxL : -maxR) };
}

// ───────────────────────── Aşağı çekip yenile ─────────────────────────

/**
 * Aşağı çekip yenile. Gösterge durumu data-state ile renklenir (görsel yönetim):
 * pull (gri) → armed (marka) → loading (bilgi mavisi) → done (yeşil, ✓) | error (kırmızı).
 */
export function bizmoPullToRefresh(scroller: HTMLElement, opts: { onRefresh: () => Promise<unknown>; threshold?: number; mouse?: boolean; label?: { pull?: string; release?: string; loading?: string; done?: string; error?: string } }) {
  const T = opts.threshold ?? 64;
  const L = { pull: "Yenilemek için çekin", release: "Bırakınca yenilenir", loading: "Yenileniyor…", done: "Güncellendi", error: "Yenilenemedi", ...opts.label };
  const host = scroller.parentElement!;
  host.classList.add("bz-ptr-host");
  const ind = document.createElement("div");
  ind.className = "bz-ptr";
  ind.setAttribute("aria-live", "polite");
  ind.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" pathLength="100"/></svg><span></span>';
  host.insertBefore(ind, scroller);
  const arc = ind.querySelector("circle")!;
  const text = ind.querySelector("span")!;
  let startX = 0, startY = 0, pull = 0, active = false, loading = false, armed = false, decided = false;
  let result: "done" | "error" | null = null;
  const render = () => {
    const k = result ? 1 : Math.min(1, pull / T);
    ind.style.height = `${pull}px`;
    ind.style.opacity = String(Math.min(1, pull / 24));
    arc.style.strokeDashoffset = String(100 - k * (result ? 100 : 85));
    scroller.style.transform = pull ? `translateY(${pull}px)` : "";
    ind.dataset.state = result ?? (loading ? "loading" : armed ? "armed" : "pull");
    text.textContent = result ? L[result] : loading ? L.loading : armed ? L.release : L.pull;
  };
  const down = (e: PointerEvent) => {
    if (loading || result || scroller.scrollTop > 0 || (e.pointerType === "mouse" && !opts.mouse) || e.button > 0) return;
    startX = e.clientX; startY = e.clientY; active = true; armed = false; decided = false;
    scroller.style.transition = ind.style.transition = "none";
  };
  const move = (e: PointerEvent) => {
    if (!active) return;
    const dy = e.clientY - startY;
    const dx = e.clientX - startX;
    // Yatay hareket (satır kaydırma) çekip yenilemeyi iptal eder
    if (!decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      decided = true;
      if (Math.abs(dx) > Math.abs(dy)) { active = false; return; }
    }
    if (dy <= 0) { pull = 0; render(); return; }
    if (scroller.scrollTop > 0) { active = false; return; }
    e.preventDefault();
    pull = Math.min(T * 1.6, dy * 0.5);
    const over = pull >= T;
    if (over !== armed) { armed = over; if (over) bizmoHaptic("light"); }
    render();
  };
  const up = async () => {
    if (!active) return;
    active = false;
    scroller.style.transition = ind.style.transition = "transform var(--bz-duration-slow) var(--bz-ease-emphasis), height var(--bz-duration-slow) var(--bz-ease-emphasis)";
    if (!armed) { pull = 0; render(); return; }
    loading = true; pull = T * 0.8; ind.dataset.loading = "true"; render();
    try {
      await opts.onRefresh();
      result = "done";
      bizmoHaptic("success");
    } catch (err) {
      result = "error";
      bizmoHaptic("error");
      console.warn("bizmoPullToRefresh:", err);
    }
    loading = false; armed = false; delete ind.dataset.loading; render();
    // Sonuç (✓ / hata) kısa süre görünür, sonra gösterge kapanır
    await new Promise((r) => setTimeout(r, result === "error" ? 1400 : 650));
    result = null; pull = 0; render();
  };
  scroller.style.touchAction = "pan-x pan-down";
  scroller.addEventListener("pointerdown", down);
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  render();
  return { refresh: async () => { armed = true; active = true; pull = T; await up(); } };
}

// ───────────────────────── Alt sayfa ─────────────────────────

export function bizmoSheet(content: HTMLElement | string, opts: { title?: string; detents?: ("medium" | "large")[]; initial?: "medium" | "large"; onClose?: () => void } = {}) {
  const detents = opts.detents ?? ["medium", "large"];
  const layer = document.createElement("div");
  layer.className = "bz-sheet-layer";
  const sheet = document.createElement("div");
  sheet.className = "bz-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  if (opts.title) sheet.setAttribute("aria-label", opts.title);
  sheet.innerHTML = `<div class="bz-sheet__handle" aria-hidden="true"><span class="bz-sheet__grabber"></span></div>${opts.title ? `<div class="bz-sheet__header"><div class="bz-sheet__title"></div><button type="button" class="bz-sheet__close" aria-label="Kapat">✕</button></div>` : ""}<div class="bz-sheet__body"></div>`;
  if (opts.title) (sheet.querySelector(".bz-sheet__title") as HTMLElement).textContent = opts.title;
  const body = sheet.querySelector(".bz-sheet__body") as HTMLElement;
  if (typeof content === "string") body.innerHTML = content;
  else body.appendChild(content);
  layer.appendChild(sheet);
  bizmoLayerHost().appendChild(layer);
  const prevFocus = document.activeElement as HTMLElement | null;
  const heightOf = (d: "medium" | "large") => { const h = bizmoViewport().height; return d === "large" ? h * 0.92 : Math.min(h * 0.52, 520); };
  let detent = opts.initial ?? detents[0];
  const apply = (animate = true) => {
    sheet.style.transition = animate ? "height var(--bz-duration-slower) var(--bz-ease-emphasis), transform var(--bz-duration-slower) var(--bz-ease-emphasis)" : "none";
    sheet.style.height = `${heightOf(detent)}px`;
    sheet.style.transform = "";
    sheet.dataset.detent = detent;
  };
  apply(false);
  requestAnimationFrame(() => (layer.dataset.state = "open"));
  function close() {
    layer.dataset.state = "closing";
    sheet.style.transition = "transform var(--bz-duration-slow) var(--bz-ease-exit)";
    sheet.style.transform = "translateY(100%)";
    document.removeEventListener("keydown", key, true);
    setTimeout(() => { layer.remove(); opts.onClose?.(); prevFocus?.focus?.(); }, 240);
  }
  const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
  document.addEventListener("keydown", key, true);
  layer.addEventListener("pointerdown", (e) => { if (e.target === layer) close(); });
  sheet.querySelector(".bz-sheet__close")?.addEventListener("click", close);
  // Sürükleme: tutamaç ve başlıktan (gövde kendi içinde kayar)
  let y0 = 0, h0 = 0, t0 = 0, drag = false;
  const handleEls = [sheet.querySelector(".bz-sheet__handle"), sheet.querySelector(".bz-sheet__header")].filter(Boolean) as HTMLElement[];
  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag = true; y0 = e.clientY; h0 = sheet.offsetHeight; t0 = performance.now();
    sheet.style.transition = "none";
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - y0;
    const max = heightOf(detents[detents.length - 1]);
    const h = h0 - dy;
    if (h > max) sheet.style.height = `${max + (h - max) * 0.15}px`;
    else if (h < heightOf(detents[0])) { sheet.style.height = `${heightOf(detents[0])}px`; sheet.style.transform = `translateY(${heightOf(detents[0]) - h}px)`; }
    else { sheet.style.height = `${h}px`; sheet.style.transform = ""; }
  };
  const up = (e: PointerEvent) => {
    if (!drag) return;
    drag = false;
    const dy = e.clientY - y0;
    const v = dy / Math.max(1, performance.now() - t0); // px/ms, aşağı pozitif
    const h = h0 - dy;
    if (v > 0.6 || h < heightOf(detents[0]) * 0.72) return close();
    const next = detents.reduce((a, b) => (Math.abs(heightOf(b) - h) < Math.abs(heightOf(a) - h) ? b : a));
    if (v < -0.6 && detents.includes("large")) detent = "large";
    else detent = next;
    bizmoHaptic("selection");
    apply();
  };
  handleEls.forEach((h) => { h.addEventListener("pointerdown", down); h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up); });
  (sheet.querySelector(".bz-sheet__close") as HTMLElement | null)?.focus({ preventScroll: true });
  return { close, setDetent: (d: "medium" | "large") => { detent = d; apply(); }, element: sheet };
}

// ───────────────────────── Geri al toast'ı ─────────────────────────

/** Yıkıcı işlemi hemen uygular gibi gösterir; süre içinde "Geri al" denirse onUndo, yoksa onCommit */
// Geri al toast'ının ton ikonları (24 px ızgara, 2 px çizgi)
const TOAST_GLYPH: Record<BizmoTone, string> = {
  neutral: '<path d="M4 9h11a5 5 0 0 1 0 10H8"/><path d="M8 5 4 9l4 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  accent: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  success: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  warning: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
  danger: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
};

/**
 * "Geri al" süreli toast. tone işlemin durum rengidir (görsel yönetim): silme → danger, erteleme → warning,
 * tamamlama → success, arşiv / taşıma → info. İkon kutusu ve kalan süre çubuğu bu renktedir.
 */
export function bizmoUndoToast(message: string, opts: { onUndo?: () => void; onCommit?: () => void; timeout?: number; action?: string; detail?: string; tone?: BizmoTone } = {}) {
  const ms = opts.timeout ?? 5000;
  const tone = opts.tone ?? "neutral";
  const host = bizmoLayerHost();
  let region = host.querySelector<HTMLElement>(":scope > .bz-toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "bz-toast-region";
    host.appendChild(region);
  }
  region.setAttribute("role", "status");
  const t = document.createElement("div");
  t.className = `bz-toast bz-toast--undo${tone === "neutral" ? "" : ` bz-toast--${tone}`}`;
  t.style.setProperty("--bz-undo-ms", `${ms}ms`);
  t.innerHTML = `<svg class="bz-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TOAST_GLYPH[tone]}</svg><div style="flex: 1; min-width: 0"><div class="bz-toast__title"></div>${opts.detail ? '<div class="bz-toast__body"></div>' : ""}</div><button type="button" class="bz-btn bz-btn--sm bz-btn--soft">${opts.action ?? "Geri al"}</button><span class="bz-toast__timer" aria-hidden="true"></span>`;
  (t.querySelector(".bz-toast__title") as HTMLElement).textContent = message;
  if (opts.detail) (t.querySelector(".bz-toast__body") as HTMLElement).textContent = opts.detail;
  region.appendChild(t);
  let done = false;
  const finish = (undo: boolean) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    t.dataset.state = "closing";
    setTimeout(() => t.remove(), 180);
    if (undo) { bizmoHaptic("light"); opts.onUndo?.(); } else opts.onCommit?.();
  };
  const timer = setTimeout(() => finish(false), ms);
  t.querySelector("button")!.addEventListener("click", () => finish(true));
  return { undo: () => finish(true), commit: () => finish(false) };
}

// ───────────────────────── Kayan göstergeli segment ─────────────────────────

export function bizmoSegmented(el: HTMLElement, onChange?: (btn: HTMLButtonElement, index: number) => void) {
  el.dataset.animated = "";
  const thumb = document.createElement("span");
  thumb.className = "bz-segmented__thumb";
  thumb.setAttribute("aria-hidden", "true");
  el.prepend(thumb);
  const buttons = () => [...el.querySelectorAll<HTMLButtonElement>(":scope > button")];
  const place = (animate: boolean) => {
    const active = buttons().find((b) => b.getAttribute("aria-pressed") === "true" || b.getAttribute("aria-selected") === "true");
    if (!active) { thumb.style.opacity = "0"; return; }
    thumb.style.transition = animate ? "" : "none";
    thumb.style.opacity = "1";
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft - 3}px)`;
  };
  el.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!b || b.parentElement !== el) return;
    buttons().forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    place(true);
    onChange?.(b, buttons().indexOf(b));
  });
  new ResizeObserver(() => place(false)).observe(el);
  requestAnimationFrame(() => place(false));
  return { refresh: () => place(false) };
}
