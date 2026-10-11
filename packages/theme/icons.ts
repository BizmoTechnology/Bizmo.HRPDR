/**
 * Bizmo Universal Theme · ikon dili (glifler)
 *
 * Kurallar (Kurumsal Kimlik §05): 24px ızgara, 2px kontur, yuvarlak uç, dolgu yok; anlamın merkezinde
 * tek dolu düğüm. Renk metinden miras alınır (currentColor); düğüm rengi ayrı verilebilir.
 * Genel arayüz ikonları için Lucide (1.8px kontur) kullanın; bu glifler uygulama/modül simgeleri içindir.
 *
 *   import { glyphSvg, GLYPH_NAMES } from "@bizmo/theme/icons";
 *   el.innerHTML = glyphSvg("factory", { size: 24, node: "var(--bz-accent)" });
 *   // React: <span dangerouslySetInnerHTML={{ __html: glyphSvg("cloud") }} />
 */
type Part = ["path", { d: string }] | ["circle", { cx: number; cy: number; r: number }] | ["rect", { x: number; y: number; width: number; height: number; rx?: number }];
export interface Glyph {
  parts: Part[];
  node: [number, number];
  /** Düğüm yarıçapı (varsayılan 2.1) */
  nodeR?: number;
}

export const GLYPHS: Record<string, Glyph> = {
  // İletişim
  mail: { parts: [["rect", { x: 3, y: 5.5, width: 18, height: 13, rx: 2.5 }], ["path", { d: "M3.8 7.2l8.2 5.8 8.2-5.8" }]], node: [12, 13] },
  "messages-square": {
    parts: [["path", { d: "M6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3.6V16A2.5 2.5 0 0 1 4 13.5v-7A2.5 2.5 0 0 1 6.5 4z" }], ["path", { d: "M8.2 10h.01M15.8 10h.01" }]],
    node: [12, 10],
    nodeR: 1.45,
  },
  calendar: { parts: [["rect", { x: 3.5, y: 5, width: 17, height: 15, rx: 2.5 }], ["path", { d: "M3.5 10h17M8.5 3v4M15.5 3v4" }]], node: [12, 15] },
  notes: { parts: [["path", { d: "M6.5 3.5h7.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 19V5a1.5 1.5 0 0 1 1-1.5z" }], ["path", { d: "M13.5 3.5V8.5h5M8.5 12.5h7M8.5 16h4" }]], node: [16, 16] },
  clipboard: {
    parts: [["path", { d: "M8.5 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1.5" }], ["rect", { x: 8.5, y: 3, width: 7, height: 4, rx: 1.5 }], ["path", { d: "M8.5 13.5l2.4 2.4 4.6-4.8" }]],
    node: [12, 5],
    nodeR: 1.3,
  },
  door: { parts: [["path", { d: "M6 21V4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21" }], ["path", { d: "M3.5 21h17" }]], node: [14.5, 12.5], nodeR: 1.6 },
  // Üretkenlik
  "list-checks": { parts: [["path", { d: "M11 6.5h9M11 12h9M11 17.5h9" }], ["path", { d: "M3.5 6.5l1.6 1.6 2.9-3" }], ["path", { d: "M3.5 17.5l1.6 1.6 2.9-3" }]], node: [5.6, 12] },
  "chart-gantt": { parts: [["path", { d: "M3.5 3.5v17h17" }], ["path", { d: "M7.5 7.5h6M10 12h8M8.5 16.5h5" }]], node: [18, 12] },
  cloud: { parts: [["path", { d: "M7 19h10.5a4.5 4.5 0 0 0 .5-8.97A6.5 6.5 0 0 0 5.4 11.3 3.9 3.9 0 0 0 7 19z" }]], node: [12, 14.5] },
  // Üretim ve operasyon
  factory: { parts: [["path", { d: "M3 20.5V11l5.5-3.5V11l5.5-3.5V11h2.5V3.5H20v17z" }], ["path", { d: "M2.5 20.5h19" }]], node: [9, 15.5] },
  "briefcase-business": { parts: [["path", { d: "M5 20V12M10 20V6M15 20v-5M20 20V9" }], ["path", { d: "M3 20.5h18" }]], node: [15, 11.5] },
  store: { parts: [["path", { d: "M4 9.5L5.6 4.5h12.8L20 9.5" }], ["path", { d: "M5 9.5V20h14V9.5M4 9.5h16" }], ["path", { d: "M10 20v-5h4v5" }]], node: [12, 12.2], nodeR: 1.5 },
  truck: { parts: [["path", { d: "M3 6h11v10H3z" }], ["path", { d: "M14 9.5h3.6l3.4 3.6V16h-7" }], ["circle", { cx: 7, cy: 18, r: 2 }]], node: [17.5, 18] },
  radar: { parts: [["circle", { cx: 10.5, cy: 10.5, r: 6.5 }], ["path", { d: "M20.5 20.5l-5.2-5.2" }]], node: [10.5, 10.5] },
  warehouse: { parts: [["path", { d: "M3 9.5L12 4l9 5.5V20H3z" }], ["path", { d: "M7.5 20v-6.5h9V20M7.5 17h9" }]], node: [12, 9.5], nodeR: 1.6 },
  package: { parts: [["path", { d: "M12 3l8.5 4.6v8.8L12 21l-8.5-4.6V7.6z" }], ["path", { d: "M3.8 7.8L12 12.3l8.2-4.5M12 12.3V21" }]], node: [12, 12.3] },
  handshake: { parts: [["path", { d: "M12 3l8.5 4.6v8.8L12 21l-8.5-4.6V7.6z" }], ["path", { d: "M3.8 7.8L12 12.3l8.2-4.5M12 12.3V21" }]], node: [12, 12.3] },
  scissors: { parts: [["circle", { cx: 6, cy: 6.5, r: 2.5 }], ["circle", { cx: 6, cy: 17.5, r: 2.5 }], ["path", { d: "M8.1 7.9L20 17M8.1 16.1L20 7" }]], node: [12.6, 12], nodeR: 1.7 },
  cog: {
    parts: [["circle", { cx: 12, cy: 12, r: 5.5 }], ["path", { d: "M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" }]],
    node: [12, 12],
  },
  // Finans ve karar
  scale: { parts: [["path", { d: "M3.5 3.5v17h17" }], ["path", { d: "M7 16c3.5-1 5-6.5 12-9.5" }], ["path", { d: "M15.5 5.8l3.5.7-.8 3.4" }]], node: [7, 16] },
  landmark: { parts: [["path", { d: "M3.5 9.5L12 4l8.5 5.5z" }], ["path", { d: "M6 12v6M10 12v6M14 12v6M18 12v6" }], ["path", { d: "M3 20.5h18" }]], node: [12, 7.2], nodeR: 1.4 },
  "chart-line": { parts: [["path", { d: "M3.5 3.5v17h17" }], ["path", { d: "M7 15l3.5-4 3 2.5L19 7" }]], node: [19, 7] },
  // Zekâ ve izleme
  reflex: { parts: [["path", { d: "M3 12h4l2.2-5 4 10 2.3-5H21" }]], node: [13.2, 17] },
  synapse: { parts: [["path", { d: "M12 3c.7 4.6 3.9 7.8 8.5 8.5-4.6.7-7.8 3.9-8.5 8.5-.7-4.6-3.9-7.8-8.5-8.5C8.1 10.8 11.3 7.6 12 3z" }], ["path", { d: "M19 3v3M17.5 4.5h3" }]], node: [12, 11.5], nodeR: 1.6 },
  hexagon: { parts: [["path", { d: "M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z" }], ["path", { d: "M12 8.5l3 1.75v3.5L12 15.5l-3-1.75v-3.5z" }]], node: [12, 12], nodeR: 1.3 },
  "graduation-cap": { parts: [["path", { d: "M2.5 9L12 4.5 21.5 9 12 13.5z" }], ["path", { d: "M6.5 11v5c3.3 2.6 7.7 2.6 11 0v-5M21.5 9v5" }]], node: [21.5, 15], nodeR: 1.5 },
  globe: { parts: [["circle", { cx: 12, cy: 12, r: 8.5 }], ["path", { d: "M3.5 12h17" }], ["path", { d: "M12 3.5c3.3 3.4 3.3 13.6 0 17M12 3.5c-3.3 3.4-3.3 13.6 0 17" }]], node: [12, 12], nodeR: 1.7 },
  // Kimlik ve sistem
  user: { parts: [["path", { d: "M4.5 20.5a7.5 7.5 0 0 1 15 0" }]], node: [12, 8.5], nodeR: 3.6 },
  // Ekip: öndeki kişinin başı düğüm, arkadaki kişi çizgi
  team: { parts: [["circle", { cx: 16.2, cy: 8, r: 2.7 }], ["path", { d: "M2.8 20a6.2 6.2 0 0 1 12.4 0" }], ["path", { d: "M15.2 13.6a5.4 5.4 0 0 1 6 5.4" }]], node: [9, 9], nodeR: 3.2 },
  siren: { parts: [["path", { d: "M6 18v-6a6 6 0 0 1 12 0v6" }], ["path", { d: "M3.5 20.5h17M12 2.5v2M4.6 5.6l1.4 1.4M19.4 5.6 18 7" }]], node: [12, 13.5], nodeR: 2.2 },
  "map-pin": { parts: [["path", { d: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" }]], node: [12, 10], nodeR: 2.3 },
  window: { parts: [["rect", { x: 3, y: 4.5, width: 18, height: 15, rx: 2.5 }], ["path", { d: "M3 9h18" }], ["path", { d: "M10 6.75h.01M13 6.75h.01" }]], node: [7, 6.75], nodeR: 1.2 },
  "id-card": { parts: [["rect", { x: 3, y: 5.5, width: 18, height: 13, rx: 2.5 }], ["path", { d: "M13 10h4.5M13 14h3" }]], node: [8.5, 12], nodeR: 2.4 },
  spine: { parts: [["path", { d: "M12 3v6M12 15v6M3 12h6M15 12h6" }]], node: [12, 12] },
  grid: { parts: [["rect", { x: 4, y: 4, width: 6.5, height: 6.5, rx: 1.8 }], ["rect", { x: 13.5, y: 4, width: 6.5, height: 6.5, rx: 1.8 }], ["rect", { x: 4, y: 13.5, width: 6.5, height: 6.5, rx: 1.8 }]], node: [16.75, 16.75], nodeR: 2.4 },
  shield: { parts: [["path", { d: "M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" }], ["path", { d: "M8.8 12l2.2 2.2 4.2-4.4" }]], node: [12, 3], nodeR: 1.2 },
  sunrise: { parts: [["path", { d: "M5 17a7 7 0 0 1 14 0" }], ["path", { d: "M2.5 20.5h19M12 3.5v3M4.6 8.6l2 2M19.4 8.6l-2 2" }]], node: [12, 17], nodeR: 2.4 },
  stamp: { parts: [["path", { d: "M9.5 3.5h5l-1 7h-3z" }], ["path", { d: "M4.5 14.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2V17h-15zM6 20.5h12" }]], node: [12, 10.5], nodeR: 1.4 },
};

export const GLYPH_NAMES = Object.keys(GLYPHS);

const attrs = (o: Record<string, unknown>) =>
  Object.entries(o)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "&quot;")}"`)
    .join(" ");

/** SVG dizesi üretir. stroke: çizgi kalınlığı (24px'te 2; 28px altında 2.2; 56px üstünde 1.75 önerilir) */
export function glyphSvg(name: string, opts: { size?: number; stroke?: number; node?: string; title?: string } = {}): string {
  const g = GLYPHS[name] ?? GLYPHS.grid;
  const size = opts.size ?? 24;
  const stroke = opts.stroke ?? (size < 28 ? 2.2 : size > 56 ? 1.75 : 2);
  const body = g.parts.map(([tag, a]) => `<${tag} ${attrs(a as Record<string, unknown>)}/>`).join("");
  const node = `<circle class="bz-node" cx="${g.node[0]}" cy="${g.node[1]}" r="${g.nodeR ?? 2.1}" fill="${opts.node && /^(#[0-9a-f]{3,8}|currentColor|var\(--[\w-]+\))$/i.test(opts.node) ? opts.node : "currentColor"}" stroke="none"/>`;
  const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
  const a11y = opts.title ? `role="img" aria-label="${esc(opts.title)}"` : `aria-hidden="true"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${body}${node}</svg>`;
}

/** Uygulama/modül ton renkleri (renk tonlu simge: <span class="bz-app-icon" style="--h:#2BA3E0">) */
export const APP_HUES: Record<string, string> = {
  mail: "#2BA3E0", chat: "#3DB37A", calendar: "#E5534B", notes: "#E0A21B", requests: "#4FA85E", office: "#A06CD5",
  team: "#B0538A", tasks: "#6C6FE8", plan: "#EE8A3C", cloud: "#1FB09E", erp: "#3D7BE0", cbm: "#8A63D8",
  minierp: "#1FA9C2", fivisor: "#6DB92C", bi: "#00A7E1", supervisor: "#E2594C", ai: "#B07CF0", logistic: "#EC7246",
  scout: "#D9578F", manage: "#3FAE8C", supplier: "#8BB13A", fason: "#C9803A", machineiq: "#7F8FA6", benka: "#D9A21B",
  schanco: "#4B8BE0", finco: "#2FB38A", webpanel: "#2E9BC4", account: "#64748B",
};
