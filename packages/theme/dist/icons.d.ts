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
type Part = ["path", {
    d: string;
}] | ["circle", {
    cx: number;
    cy: number;
    r: number;
}] | ["rect", {
    x: number;
    y: number;
    width: number;
    height: number;
    rx?: number;
}];
export interface Glyph {
    parts: Part[];
    node: [number, number];
    /** Düğüm yarıçapı (varsayılan 2.1) */
    nodeR?: number;
}
export declare const GLYPHS: Record<string, Glyph>;
export declare const GLYPH_NAMES: string[];
/** SVG dizesi üretir. stroke: çizgi kalınlığı (24px'te 2; 28px altında 2.2; 56px üstünde 1.75 önerilir) */
export declare function glyphSvg(name: string, opts?: {
    size?: number;
    stroke?: number;
    node?: string;
    title?: string;
}): string;
/** Uygulama/modül ton renkleri (renk tonlu simge: <span class="bz-app-icon" style="--h:#2BA3E0">) */
export declare const APP_HUES: Record<string, string>;
export {};
