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

export const MAX_COLS = 12;

export type Density = "comfortable" | "compact";

export function gridMetrics(width: number, density: Density = "comfortable") {
  if (width < 720) {
    const cols = 2;
    const gap = 12;
    const ideal = Math.floor((width - 32 - gap) / cols);
    return { cols, gap, cell: Math.max(140, Math.min(240, ideal)) };
  }
  if (width < 1000) {
    const cols = 3;
    const gap = 18;
    const ideal = Math.floor((width - 64 - gap * 2) / cols);
    return { cols, gap, cell: Math.max(150, Math.min(320, ideal)) };
  }
  const gap = width >= 1400 ? 22 : 18;
  const side = width >= 2400 ? 64 : width >= 1400 ? 48 : 32;
  const avail = width - side * 2;
  // Kutucukların çoğu 2 sütun genişliğinde: çift sütun sayısı boşluksuz dizilir.
  // Hedef hücreye en yakın çift sütun sayısı seçilir; hücre 200-340 px arasında kalır.
  const target = density === "compact" ? 230 : 290;
  let cols = 4;
  let best = Infinity;
  for (let c = 4; c <= MAX_COLS; c += 2) {
    const ideal = (avail - gap * (c - 1)) / c;
    if (ideal < 200) break;
    const d = Math.abs(ideal - target);
    if (d < best) {
      best = d;
      cols = c;
    }
  }
  const cell = Math.max(200, Math.min(340, Math.floor((avail - gap * (cols - 1)) / cols)));
  return { cols, gap, cell };
}

/** Bir öğeyi (ör. .bz-tile-grid) pencere boyutuna göre canlı ayarlar; temizleme fonksiyonu döner */
export function bindTileGrid(el: HTMLElement, density: Density = "comfortable") {
  const apply = () => {
    const { cols, gap, cell } = gridMetrics(window.innerWidth, density);
    el.style.setProperty("--cols", String(cols));
    el.style.setProperty("--gap", `${gap}px`);
    el.style.setProperty("--cell", `${cell}px`);
  };
  apply();
  window.addEventListener("resize", apply);
  return () => window.removeEventListener("resize", apply);
}

/** Kırılım noktaları (px): kenar çubuğu 900'ün altında çekmeceye döner */
export const BREAKPOINTS = { sm: 640, md: 900, lg: 1200, xl: 1600, xxl: 2400 } as const;
