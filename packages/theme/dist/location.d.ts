/**
 * Bizmo Universal Theme · depo göz adresi (WMS lokasyon kodu), çerçeveden ve 3B'den bağımsız
 *
 *   const loc = bizmoLocationScheme({ blocks: "ABCDEF", bays: 10, levels: "ABCDE", positions: 3 });
 *   loc.parse("A-3-D-2")      → { block: "A", bay: 3, level: "D", pos: 2 }   ("a3d2", "A.3.D.2", "A 3 D 2" de kabul)
 *   loc.format({ block: "A", bay: 3, level: "D", pos: 2 }) → "A-3-D-2"
 *   loc.index("A-3-D-2")      → 0 … total-1 (blok → bölme → kat → göz sırası; dizi / InstancedMesh indeksi)
 *   loc.at(37)                → parçalar
 *   loc.describe("A-3-D-2")   → "A bloğu · 3. bölme · D katı (4. seviye) · 2. göz"
 *
 * Dört parça: Blok (raf sırası, harf) · Bölme (dikme arası, sayı, koridor başından) · Kat (harf, A = zemin) · Göz (kirişteki palet yeri, sayı).
 * Kodun okunuşu her yerde aynıdır (etiket, el terminali, ekran, rapor) — DESIGN.md §29.8.
 */
export type LocationParts = {
    block: string;
    bay: number;
    level: string;
    pos: number;
};
export type LocationSchemeOptions = {
    /** Blok (raf sırası) harfleri, sırasıyla */
    blocks: string | string[];
    /** Blok başına bölme sayısı (1'den başlar) */
    bays: number;
    /** Kat harfleri, zeminden yukarı */
    levels: string | string[];
    /** Kirişteki göz (palet yeri) sayısı (1'den başlar) */
    positions: number;
    /** Ayırıcı (varsayılan "-") */
    sep?: string;
};
export declare function bizmoLocationScheme(opts: LocationSchemeOptions): {
    blocks: string[];
    levels: string[];
    bays: number;
    positions: number;
    total: number;
    format(p: LocationParts): string;
    /** Geçersiz ya da şema dışında ise null */
    parse(code: string): LocationParts | null;
    /** Kullanıcı girişini standart koda çevirir ("a3d2" → "A-3-D-2"); geçersizse null */
    normalize(code: string): string | null;
    index(code: string | LocationParts): number;
    at(index: number): LocationParts;
    code(index: number): string;
    /** Komşu göz: dx (göz → bölme yönünde), dy (kat); şema dışına çıkarsa -1 */
    neighbor(index: number, dx: number, dy: number): number;
    describe(code: string | LocationParts): string;
};
export type LocationScheme = ReturnType<typeof bizmoLocationScheme>;
