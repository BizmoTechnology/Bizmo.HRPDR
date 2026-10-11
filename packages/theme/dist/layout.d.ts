/**
 * Bizmo Universal Theme · yerleşim yardımcıları
 *
 * Kutucuk (widget) ızgarası: ekran genişledikçe sütun SAYISI artar (Full HD 6, 1440p 8, 4K/ultra geniş 10-12),
 * hücre boyu hedefe (rahat 290 px, sıkı 230 px) yakın kalır. Bizmo.OS kabuğundaki gridMetrics ile birebir aynıdır.
 *
 *   const { cols, gap, cell } = gridMetrics(window.innerWidth, "comfortable");
 *   el.style.setProperty("--cols", cols); el.style.setProperty("--cell", cell + "px"); el.style.setProperty("--gap", gap + "px");
 *   <div class="bz-tile-grid"> <div class="bz-tile bz-tile--m">…</div> </div>
 */
export declare const MAX_COLS = 12;
export type Density = "comfortable" | "compact";
export declare function gridMetrics(width: number, density?: Density): {
    cols: number;
    gap: number;
    cell: number;
};
/** Bir öğeyi (ör. .bz-tile-grid) pencere boyutuna göre canlı ayarlar; temizleme fonksiyonu döner */
export declare function bindTileGrid(el: HTMLElement, density?: Density): () => void;
/** Kırılım noktaları (px): kenar çubuğu 900'ün altında çekmeceye döner */
export declare const BREAKPOINTS: {
    readonly sm: 640;
    readonly md: 900;
    readonly lg: 1200;
    readonly xl: 1600;
    readonly xxl: 2400;
};
