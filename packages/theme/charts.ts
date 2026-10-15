/**
 * Bizmo Universal Theme · grafik paleti ve kütüphane temaları
 *
 * Kategori paleti her `pnpm check` çalıştırmasında doğrulanır (scripts/check.mjs · OKLab ΔE ×100, Machado 2009 renk körlüğü):
 *   - yan yana seriler (çubuk, yığın, çizgi): renk körlüğü ΔE ≥ 9.7 açık / 9.1 koyu, normal görüş ΔE ≥ 19.7 / 18.8 (eşik 8 / 15)
 *   - dağılım / balon / harita (tüm ikililer): en çok 3 seri → SCATTER_SAFE (mavi, kehribar, macenta): ΔE ≥ 11.3 / 9.1
 *   - açık temada kehribar 3:1'in altında: o seriyi doğrudan etiketleyin veya tablo görünümü sunun
 * Yeşil ve kırmızı kategori paletinde YOKTUR: yeşil marka sinyali ve "olumlu" durumu, kırmızı "tehlike" durumudur.
 * Seri rengi varlığa bağlıdır, sıraya değil: filtre seri sayısını değiştirince kalan seriler yeniden boyanmaz.
 */

export type Mode = "light" | "dark";

export const SERIES: Record<Mode, readonly string[]> = {
  light: ["#0a8fc4", "#e8743b", "#16a087", "#d99a00", "#d1508a", "#7a6be0"],
  dark: ["#1f97cc", "#d9662c", "#14937b", "#b88000", "#d55181", "#8f84e8"],
};
export const SERIES_NAMES = ["mavi", "turuncu", "camgöbeği", "kehribar", "macenta", "mor"] as const;

/** Dağılım/balon/harita gibi tüm renklerin birbirinden ayrılması gereken grafikler için (en çok 3 seri) */
export const SCATTER_SAFE: Record<Mode, readonly string[]> = {
  light: ["#0a8fc4", "#d99a00", "#d1508a"],
  dark: ["#1f97cc", "#b88000", "#d55181"],
};

/** Sıralı (büyüklük) — tek ton mavi, açıktan koyuya. Sürekli ölçekte 100–700; sıralı adımlarda açıkta 300'den başlayın */
export const SEQUENTIAL = ["#dff1fa", "#b4dff2", "#6fc0e8", "#2fa6db", "#0a8fc4", "#06709a", "#044f6d"] as const;
export const ORDINAL: Record<Mode, readonly string[]> = {
  light: ["#6fc0e8", "#2fa6db", "#0a8fc4", "#06709a", "#044f6d"],
  dark: ["#c4e8f8", "#86cdee", "#4fb3e2", "#1f97cc", "#0f78a6"],
};

/** Iraksak (kutupluluk) — turuncu ↔ gri ↔ mavi; orta nokta nötr gri, asla renkli değil */
export const DIVERGING: Record<Mode, { negative: readonly string[]; mid: string; positive: readonly string[] }> = {
  light: { negative: ["#b4511f", "#e8743b", "#f4b48f"], mid: "#e4e9ef", positive: ["#9fd6ef", "#2fa6db", "#06709a"] },
  dark: { negative: ["#f0a074", "#d9662c", "#8f3f17"], mid: "#2a3642", positive: ["#0f5f83", "#1f97cc", "#86cdee"] },
};

/** Durum renkleri — kategori serisi olarak KULLANILMAZ; her zaman simge + etiketle birlikte */
export const STATUS: Record<Mode, { good: string; warning: string; critical: string; info: string }> = {
  light: { good: "#3f8f1a", warning: "#b86e00", critical: "#d6453d", info: "#0094c9" },
  dark: { good: "#8ed14f", warning: "#f0ac55", critical: "#f0787c", info: "#33b9e8" },
};

export const CHROME: Record<Mode, { surface: string; text: string; text2: string; muted: string; grid: string; axis: string; font: string }> = {
  light: { surface: "#ffffff", text: "#18232f", text2: "#4f5b67", muted: "#5f6a75", grid: "rgba(24,35,47,0.08)", axis: "rgba(24,35,47,0.22)", font: "Inter, 'Segoe UI', system-ui, sans-serif" },
  dark: { surface: "#131f2a", text: "#eef3f8", text2: "#a8b5c2", muted: "#8d9aa6", grid: "rgba(255,255,255,0.07)", axis: "rgba(255,255,255,0.2)", font: "Inter, 'Segoe UI', system-ui, sans-serif" },
};

/** Sayfanın o anki modu (data-theme / .dark / işletim sistemi) */
export function currentMode(): Mode {
  if (typeof document === "undefined") return "light";
  const r = document.documentElement;
  if (r.dataset.theme === "dark" || r.classList.contains("dark")) return "dark";
  if (r.dataset.theme === "light" || r.classList.contains("light")) return "light";
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Bir varlığa sabit renk: aynı kimlik her grafikte aynı rengi alır (sıraya göre değil) */
export function colorFor(key: string, keys: readonly string[], mode: Mode = currentMode()): string {
  const i = keys.indexOf(key);
  return i >= 0 && i < SERIES[mode].length ? SERIES[mode][i] : CHROME[mode].muted; // 7. seri ve sonrası "Diğer"
}

/** Apache ECharts teması: echarts.registerTheme("bizmo-light", echartsTheme("light")) */
export function echartsTheme(mode: Mode) {
  const c = CHROME[mode];
  const axis = {
    axisLine: { lineStyle: { color: c.axis } },
    axisTick: { show: false },
    axisLabel: { color: c.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: c.grid } },
  };
  return {
    color: [...SERIES[mode]],
    backgroundColor: "transparent",
    textStyle: { fontFamily: c.font, color: c.text2 },
    title: { textStyle: { fontFamily: "Manrope, Inter, sans-serif", fontWeight: 700, color: c.text, fontSize: 15 } },
    legend: { textStyle: { color: c.text2, fontSize: 12 }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
    tooltip: {
      backgroundColor: mode === "dark" ? "rgba(21,33,44,0.96)" : "rgba(255,255,255,0.96)",
      borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(24,35,47,0.08)",
      textStyle: { color: c.text, fontSize: 12 },
      extraCssText: "border-radius:12px;box-shadow:0 12px 34px rgba(24,35,47,0.14);",
    },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    line: { symbol: "circle", symbolSize: 8, lineStyle: { width: 2 }, smooth: false },
    bar: { itemStyle: { borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 },
    pie: { itemStyle: { borderColor: c.surface, borderWidth: 2 } },
  };
}

/** Chart.js varsayılanları: applyChartJsDefaults(Chart, "light") */
export function applyChartJsDefaults(Chart: any, mode: Mode = currentMode()) {
  const c = CHROME[mode];
  Chart.defaults.font.family = c.font;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = c.text2;
  Chart.defaults.borderColor = c.grid;
  Chart.defaults.elements.line.borderWidth = 2;
  Chart.defaults.elements.line.tension = 0;
  Chart.defaults.elements.point.radius = 0;
  Chart.defaults.elements.point.hoverRadius = 5;
  Chart.defaults.elements.bar.borderRadius = 4;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.backgroundColor = mode === "dark" ? "rgba(21,33,44,0.96)" : "rgba(24,35,47,0.94)";
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.padding = 10;
  return SERIES[mode];
}

/** Recharts için ortak props */
export function rechartsProps(mode: Mode = currentMode()) {
  const c = CHROME[mode];
  return {
    colors: [...SERIES[mode]],
    grid: { stroke: c.grid, vertical: false },
    axis: { stroke: c.axis, tick: { fill: c.muted, fontSize: 11 }, tickLine: false },
    tooltip: {
      contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, boxShadow: "0 12px 34px rgba(24,35,47,0.14)", fontSize: 12 },
      cursor: { fill: mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(24,35,47,0.04)" },
    },
    bar: { radius: [4, 4, 0, 0] as [number, number, number, number], maxBarSize: 28 },
    line: { strokeWidth: 2, dot: false, activeDot: { r: 5 } },
  };
}

/**
 * Sparkline (küçük eğilim çizgisi): KPI ve kutucuklarda. Eksen, ızgara, etiket yoktur; son nokta vurgulanır.
 * SVG kapsayıcı genişliğine esner; çizgi ve nokta kalınlığı ölçeklenmez (vector-effect).
 *   el.innerHTML = sparkline([12, 14, 11, 18, 21], { tone: "data", label: "Son 7 gün ciro" });
 * Görünüm components.css'teki .bz-spark sınıflarından gelir (açık/koyu kendiliğinden).
 */
export function sparkPoints(values: readonly number[], width = 120, height = 36, pad = 3) {
  const n = values.length;
  if (n === 0) return { line: "", area: "", last: [0, height] as [number, number] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [pad + (n === 1 ? 0 : (i * (width - pad * 2)) / (n - 1)), pad + (1 - (v - min) / span) * (height - pad * 2)] as [number, number]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  return { line, area, last: pts[n - 1] };
}

export function sparkline(values: readonly number[], opts: { width?: number; height?: number; tone?: "data" | "accent" | "danger"; area?: boolean; label?: string } = {}) {
  const w = opts.width ?? 120;
  const h = opts.height ?? 36;
  const { line, area, last } = sparkPoints(values, w, h);
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  const a11y = opts.label ? `role="img" aria-label="${esc(opts.label)}"` : 'aria-hidden="true"';
  return `<svg class="bz-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" data-tone="${opts.tone ?? "data"}" ${a11y}>${opts.area === false ? "" : `<path class="bz-spark__area" d="${area}"/>`}<path class="bz-spark__line" d="${line}"/><path class="bz-spark__halo" d="M${last[0].toFixed(1)},${last[1].toFixed(1)}h0"/><path class="bz-spark__dot" d="M${last[0].toFixed(1)},${last[1].toFixed(1)}h0"/></svg>`;
}
