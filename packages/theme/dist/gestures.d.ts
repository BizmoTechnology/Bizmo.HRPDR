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
/** Kullanıcı tercihi (localStorage "bz-haptics"; <html data-haptics="off"> da kapatır) */
export declare const bizmoHaptics: {
    readonly enabled: boolean;
    setEnabled(on: boolean): void;
    /** "vibrate" (Android), "ios" (iOS 18+ Safari), "none" (masaüstü, eski iOS) */
    readonly support: "vibrate" | "ios" | "none";
};
/**
 * Görsel yönetim tonu (andon): durumun rengi. Renk tek başına bilgi taşımaz; yanında etiket veya ikon bulunur.
 *   success  çalışıyor · tamamlandı · onaylandı        warning  uyarı · incelemede · bugün · ertelendi
 *   danger   arıza · gecikmiş · reddedildi · silindi    info     devam ediyor · bilgi · seçim
 *   neutral  boşta · yapılacak · taslak                 accent   marka sinyali (birincil eylem)
 */
export type BizmoTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";
/** Haptik türünün görsel karşılığı */
export declare const HAPTIC_TONE: Record<HapticKind, BizmoTone>;
/** Bir öğe yeni duruma geçtiğinde verilecek haptik */
export declare const TONE_HAPTIC: Record<BizmoTone, HapticKind>;
/**
 * Görsel yönetim ışıması: öğe tonun renginde kısa süre parlar (halka + zemin tonu, ~0,6 sn).
 * Durum değişikliğini herkes görür; haptik desteklemeyen cihazda da, sessizdeyken de çalışır.
 * Hareket azaltılmışsa yalnız renk geçişi kalır (components.css).
 */
export declare function bizmoFlash(el: Element | null | undefined, tone?: BizmoTone): void;
/**
 * Dokunsal geri bildirim. Kullanıcı eylemi (tıklama, dokunma) içinde çağrılmalıdır.
 * opts.el verilirse öğe durum renginde ışır (bizmoFlash): bildirim türlerinde (success / warning / error)
 * ve ton verildiğinde her zaman, seçim türlerinde yalnız cihaz haptik veremiyorsa. opts.visual bunu zorlar.
 */
export declare function bizmoHaptic(kind?: HapticKind, opts?: {
    el?: Element | null;
    tone?: BizmoTone;
    visual?: boolean;
}): boolean;
/** Seçim kontrollerinde otomatik haptik + [data-haptic="success"] (isteğe bağlı data-haptic-tone) bildirimsel kullanım */
export declare function bizmoAutoHaptics(root?: Document | HTMLElement): () => void;
/** Dokunmatikte basılı tutma (varsayılan 450 ms). Basarken data-pressing="true" ile hafif küçülme */
export declare function bizmoLongPress(el: HTMLElement, onPress: (e: PointerEvent) => void, opts?: {
    delay?: number;
    tolerance?: number;
}): () => void;
export type MenuItem = {
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
} | "separator";
export type ContextMenuOptions = {
    items: MenuItem[] | ((el: HTMLElement) => MenuItem[]);
    /** Menü başlığı (ör. dosya adı) */
    title?: string | ((el: HTMLElement) => string);
    /** Önizleme: varsayılan öğenin kopyası; özel içerik için öğe döndürün */
    preview?: (el: HTMLElement) => HTMLElement | null;
    /** İkonlar için SVG üretici (ör. lucide adı → SVG). Verilmezse ikon gösterilmez */
    icon?: (name: string) => string;
    /** iMessage tarzı hızlı tepki satırı (menünün üstünde) */
    reactions?: {
        emojis: string[];
        onSelect: (emoji: string, el: HTMLElement) => void;
    } | ((el: HTMLElement) => {
        emojis: string[];
        onSelect: (emoji: string, el: HTMLElement) => void;
    } | null);
    /** Menü çizildikten sonra (ör. ikon kütüphanesini çalıştırmak için) */
    onOpen?: (menu: HTMLElement) => void;
    /** Menü kapanınca (seçim yapılsa da yapılmasa da) */
    onClose?: () => void;
};
/** Katmanların ekleneceği yer: tam ekrandaki öğe (andon TV modu, 3B sahne) varsa onun içi, yoksa body */
export declare function bizmoLayerHost(): HTMLElement;
/**
 * Görünen alan, istemci (position: fixed) koordinatlarında. Mobilde window.innerHeight araç çubuklarını ve
 * yatay taşmayı hesaba katmaz (görünenden büyük olabilir); visualViewport gerçekten görünen dikdörtgeni verir.
 */
export declare function bizmoViewport(): {
    left: number;
    top: number;
    width: number;
    height: number;
};
/** Menüyü doğrudan aç (3B tuval, grid hücresi gibi kendi olayını yöneten yerler için). at verilirse imleçte, önizlemesiz */
export declare function bizmoOpenContextMenu(anchor: HTMLElement, opts: ContextMenuOptions, at?: {
    x: number;
    y: number;
}): {
    close: (focus?: boolean) => void;
};
/**
 * Yetki devriyle bağlam menüsü: kök içindeki selector'a uyan her öğe (sonradan eklenenler dahil) için
 * sağ tık, dokunmatikte basılı tutma ve Shift+F10 / ContextMenu tuşu aynı menüyü açar.
 */
export declare function bizmoContextMenuDelegate(root: HTMLElement | Document, selector: string, opts: ContextMenuOptions & {
    delay?: number;
}): () => void;
/**
 * iOS Haptic Touch karşılığı: dokunmatikte basılı tut, masaüstünde sağ tık, klavyede Shift+F10 / ContextMenu tuşu.
 * Öğeye ayrıca görünür bir "⋯" düğmesi koyup open() ile aynı menüyü açın (hareketsiz karşılık).
 */
export declare function bizmoContextMenu(el: HTMLElement, opts: ContextMenuOptions): {
    open: () => {
        close: (focus?: boolean) => void;
    };
    destroy(): void;
};
export type SwipeAction = {
    label: string;
    icon?: string;
    /** Eylem rengi; uygulanınca satır bu renkte ışır ve tona uygun haptik verilir ("data" = "info") */
    tone?: "accent" | "success" | "info" | "data" | "danger" | "warning" | "neutral";
    /** Satır yeniden çizildiyse yeni öğeyi döndürün: ışıma ona uygulanır */
    onSelect: () => void | Element | null;
};
/**
 * Satır kaydırma eylemleri. Yapı: .bz-swipe > .bz-swipe__content (kaydırılan satır).
 * Sola kaydırma → right eylemleri (sağda belirir), sağa kaydırma → left eylemleri. Tam kaydırma ilk eylemi uygular.
 */
export declare function bizmoSwipeActions(row: HTMLElement, opts: {
    left?: SwipeAction[];
    right?: SwipeAction[];
    icon?: (name: string) => string;
    fullSwipe?: boolean;
}): {
    close: () => void;
    open: (side: "left" | "right") => void;
};
/**
 * Aşağı çekip yenile. Gösterge durumu data-state ile renklenir (görsel yönetim):
 * pull (gri) → armed (marka) → loading (bilgi mavisi) → done (yeşil, ✓) | error (kırmızı).
 */
export declare function bizmoPullToRefresh(scroller: HTMLElement, opts: {
    onRefresh: () => Promise<unknown>;
    threshold?: number;
    mouse?: boolean;
    label?: {
        pull?: string;
        release?: string;
        loading?: string;
        done?: string;
        error?: string;
    };
}): {
    refresh: () => Promise<void>;
};
export declare function bizmoSheet(content: HTMLElement | string, opts?: {
    title?: string;
    detents?: ("medium" | "large")[];
    initial?: "medium" | "large";
    onClose?: () => void;
}): {
    close: () => void;
    setDetent: (d: "medium" | "large") => void;
    element: HTMLDivElement;
};
/**
 * "Geri al" süreli toast. tone işlemin durum rengidir (görsel yönetim): silme → danger, erteleme → warning,
 * tamamlama → success, arşiv / taşıma → info. İkon kutusu ve kalan süre çubuğu bu renktedir.
 */
export declare function bizmoUndoToast(message: string, opts?: {
    onUndo?: () => void;
    onCommit?: () => void;
    timeout?: number;
    action?: string;
    detail?: string;
    tone?: BizmoTone;
}): {
    undo: () => void;
    commit: () => void;
};
export declare function bizmoSegmented(el: HTMLElement, onChange?: (btn: HTMLButtonElement, index: number) => void): {
    refresh: () => void;
};
