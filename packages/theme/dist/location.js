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
export function bizmoLocationScheme(opts) {
    const blocks = [...opts.blocks].map((b) => b.toLocaleUpperCase("tr"));
    const levels = [...opts.levels].map((l) => l.toLocaleUpperCase("tr"));
    const { bays, positions } = opts;
    const sep = opts.sep ?? "-";
    const total = blocks.length * bays * levels.length * positions;
    // Esnek giriş: ayırıcı - . / boşluk ya da hiç; büyük-küçük harf fark etmez
    const re = /^\s*([A-ZÇĞİÖŞÜ])\s*[-./ ]?\s*(\d{1,3})\s*[-./ ]?\s*([A-ZÇĞİÖŞÜ])\s*[-./ ]?\s*(\d{1,2})\s*$/i;
    const valid = (p) => blocks.includes(p.block) && p.bay >= 1 && p.bay <= bays && levels.includes(p.level) && p.pos >= 1 && p.pos <= positions;
    const api = {
        blocks,
        levels,
        bays,
        positions,
        total,
        format(p) {
            return `${p.block}${sep}${p.bay}${sep}${p.level}${sep}${p.pos}`;
        },
        /** Geçersiz ya da şema dışında ise null */
        parse(code) {
            const m = re.exec(code ?? "");
            if (!m)
                return null;
            const p = { block: m[1].toLocaleUpperCase("tr"), bay: Number(m[2]), level: m[3].toLocaleUpperCase("tr"), pos: Number(m[4]) };
            return valid(p) ? p : null;
        },
        /** Kullanıcı girişini standart koda çevirir ("a3d2" → "A-3-D-2"); geçersizse null */
        normalize(code) {
            const p = api.parse(code);
            return p ? api.format(p) : null;
        },
        index(code) {
            const p = typeof code === "string" ? api.parse(code) : valid(code) ? code : null;
            if (!p)
                return -1;
            return ((blocks.indexOf(p.block) * bays + (p.bay - 1)) * levels.length + levels.indexOf(p.level)) * positions + (p.pos - 1);
        },
        at(index) {
            const pos = index % positions;
            const l = Math.floor(index / positions) % levels.length;
            const bay = Math.floor(index / (positions * levels.length)) % bays;
            const b = Math.floor(index / (positions * levels.length * bays));
            return { block: blocks[b], bay: bay + 1, level: levels[l], pos: pos + 1 };
        },
        code(index) {
            return api.format(api.at(index));
        },
        /** Komşu göz: dx (göz → bölme yönünde), dy (kat); şema dışına çıkarsa -1 */
        neighbor(index, dx, dy) {
            const p = api.at(index);
            let slot = (p.bay - 1) * positions + (p.pos - 1) + dx;
            const l = levels.indexOf(p.level) + dy;
            if (slot < 0 || slot >= bays * positions || l < 0 || l >= levels.length)
                return -1;
            return api.index({ block: p.block, bay: Math.floor(slot / positions) + 1, level: levels[l], pos: (slot % positions) + 1 });
        },
        describe(code) {
            const p = typeof code === "string" ? api.parse(code) : code;
            if (!p)
                return "";
            return `${p.block} bloğu · ${p.bay}. bölme · ${p.level} katı (${levels.indexOf(p.level) + 1}. seviye) · ${p.pos}. göz`;
        },
    };
    return api;
}
