import { SERIES, type Mode } from "@bizmo/theme/charts";

/**
 * Değerlendirme boyutlarının sabit kategori renkleri: Bizmo grafik paleti (DESIGN.md §28.1).
 * Renk varlığa bağlıdır, sıraya değil — aynı boyut her ekranda aynı renktedir. Yeşil ve kırmızı
 * kategori paletinde yoktur (durum için ayrılmıştır). Seri rengi yalnız işarette (nokta, çubuk, çizgi)
 * kullanılır; etiket ve değer metin rengindedir.
 */
const DIMENSION_SERIES_INDEX: Record<string, number> = {
  LOGICAL_ALGORITHMIC: 0, // mavi
  LEADERSHIP: 1, // turuncu
  SOCIAL_INTELLIGENCE: 2, // camgöbeği
  GROWTH_POTENTIAL: 3, // kehribar
  DOMAIN_ALIGNMENT: 4, // macenta
};

export interface DimensionColor {
  /** Yumuşak zemin (etiket, kutucuk) */
  bg: string;
  /** İşaret rengi (nokta, çubuk) */
  bar: string;
  /** Kenarlık / halka */
  border: string;
  /** Simge rengi (metin değil) */
  icon: string;
}

const CLASSES: DimensionColor[] = [
  { bg: "bg-series-1/10", bar: "bg-series-1", border: "border-series-1/40", icon: "text-series-1" },
  { bg: "bg-series-2/10", bar: "bg-series-2", border: "border-series-2/40", icon: "text-series-2" },
  { bg: "bg-series-3/10", bar: "bg-series-3", border: "border-series-3/40", icon: "text-series-3" },
  { bg: "bg-series-4/10", bar: "bg-series-4", border: "border-series-4/40", icon: "text-series-4" },
  { bg: "bg-series-5/10", bar: "bg-series-5", border: "border-series-5/40", icon: "text-series-5" },
  { bg: "bg-series-6/10", bar: "bg-series-6", border: "border-series-6/40", icon: "text-series-6" },
];

function indexOf(dimension: string) {
  return DIMENSION_SERIES_INDEX[dimension] ?? 5;
}

export function dimensionColor(dimension: string): DimensionColor {
  return CLASSES[indexOf(dimension)]!;
}

/** Grafik kütüphaneleri için ham renk (CSS değişkeni okunamayan SVG / canvas) */
export function dimensionHex(dimension: string, mode: Mode): string {
  return SERIES[mode][indexOf(dimension)]!;
}
