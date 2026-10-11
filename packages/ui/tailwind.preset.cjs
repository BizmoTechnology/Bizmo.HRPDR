/**
 * PotansiyelHaritası · Tailwind CSS v3 preset — Bizmo Universal Theme (@bizmo/theme)
 *
 * Tüm renkler, köşeler, gölgeler ve yazı aileleri @bizmo/theme/tokens.css içindeki --bz-* değişkenlerinden okunur;
 * açık / koyu / yüksek karşıtlık modları tokens.css'te çözülür. Bileşenlerde ham hex yazılmaz (DESIGN.md §2.4).
 *
 * Ad eşlemesi @bizmo/theme/shadcn.css ile aynıdır:
 *   primary = Bizmo yeşili (üstündeki yazı lacivert) · accent = üzerine gelme zemini (shadcn anlamı)
 *   brand-ink = yeşil METİN · destructive = danger-solid · muted-foreground = soluk metin (text-3)
 * Bizmo adları: page, sunken, surface(-2/-3), fg / fg2 / fg3, divider, hover, press, field,
 *   data · success · warning · danger · info (+ -ink metin, -soft zemin), series-1..6 (grafik kategori paleti).
 *
 * Opaklık ekleri (bg-primary/10, border-border/50 …) color-mix ile çalışır.
 */
const tok = (name) => `color-mix(in srgb, var(--bz-${name}) calc(<alpha-value> * 100%), transparent)`;

const tone = (name, extra = {}) => ({
  DEFAULT: tok(name),
  ink: tok(`${name}-ink`),
  soft: tok(`${name}-soft`),
  ...extra,
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Koyu tema: <html data-theme="dark"> (tokens.css ile aynı seçici; .dark da tanınır)
  darkMode: ["variant", '&:where([data-theme="dark"], [data-theme="dark"] *, .dark, .dark *)'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--bz-font-sans)"],
        display: ["var(--bz-font-display)"],
        mono: ["var(--bz-font-mono)"],
      },
      colors: {
        // shadcn/ui adları (mevcut bileşenler değişmeden Bizmo görünümüne geçer)
        border: tok("border"),
        input: tok("field-border"),
        ring: tok("focus"),
        background: tok("bg"),
        foreground: tok("text"),
        primary: { DEFAULT: tok("accent"), foreground: tok("accent-contrast") },
        secondary: { DEFAULT: tok("field"), foreground: tok("text") },
        muted: { DEFAULT: tok("field"), foreground: tok("text-3") },
        accent: { DEFAULT: tok("hover"), foreground: tok("text") },
        destructive: { DEFAULT: tok("danger-solid"), foreground: "rgb(255 255 255 / <alpha-value>)" },
        popover: { DEFAULT: tok("glass-strong"), foreground: tok("text") },
        card: { DEFAULT: tok("surface"), foreground: tok("text") },

        // Bizmo adları
        brand: {
          DEFAULT: tok("accent"),
          strong: tok("accent-strong"),
          ink: tok("accent-ink"),
          soft: tok("accent-soft"),
          contrast: tok("accent-contrast"),
        },
        page: tok("bg"),
        sunken: tok("bg-sunken"),
        surface: { DEFAULT: tok("surface"), 2: tok("surface-2"), 3: tok("surface-3") },
        fg: tok("text"),
        fg2: tok("text-2"),
        fg3: tok("text-3"),
        divider: tok("divider"),
        "border-strong": tok("border-strong"),
        "glass-border": tok("glass-border"),
        scrim: tok("scrim"),
        hover: tok("hover"),
        press: tok("press"),
        field: tok("field"),
        data: tone("data", { solid: tok("data-solid"), contrast: tok("data-contrast") }),
        success: tone("success"),
        warning: tone("warning", { tone: tok("warning-tone") }),
        danger: tone("danger", { solid: tok("danger-solid") }),
        info: tone("info"),
        series: {
          1: tok("series-1"),
          2: tok("series-2"),
          3: tok("series-3"),
          4: tok("series-4"),
          5: tok("series-5"),
          6: tok("series-6"),
        },
      },
      // Tailwind adları korunur, değerler Bizmo ölçeğine oturur (DESIGN.md §4.2)
      borderRadius: {
        sm: "var(--bz-radius-xs)", // 6 · kod, kbd, küçük etiket
        DEFAULT: "var(--bz-radius-xs)",
        md: "8px", // takvim günü, küçük kutu
        lg: "var(--bz-radius-sm)", // 10 · düğme, menü öğesi, küçük kart
        xl: "12px", // giriş alanı, segment, simge düğmesi
        "2xl": "var(--bz-radius-md)", // 16 · kart, tablo sarmalayıcı, menü, toast
        "3xl": "var(--bz-radius-lg)", // 26 · pencere, çekmece, komut paleti
      },
      boxShadow: {
        sm: "0 1px 2px rgb(24 35 47 / 0.06)",
        DEFAULT: "var(--bz-shadow-1)",
        md: "var(--bz-shadow-1)",
        lg: "var(--bz-shadow-2)",
        xl: "var(--bz-shadow-3)",
        "2xl": "var(--bz-shadow-3)",
        1: "var(--bz-shadow-1)",
        2: "var(--bz-shadow-2)",
        3: "var(--bz-shadow-3)",
        green: "var(--bz-shadow-green)",
      },
      transitionTimingFunction: {
        DEFAULT: "var(--bz-ease)",
        bizmo: "var(--bz-ease)",
        "bizmo-exit": "var(--bz-ease-exit)",
      },
      height: {
        control: "var(--bz-control-md)",
        "control-sm": "var(--bz-control-sm)",
        "control-lg": "var(--bz-control-lg)",
        field: "var(--bz-field-h)",
        topbar: "var(--bz-topbar-h)",
      },
      zIndex: { sticky: "10", topbar: "20", sidebar: "30", dropdown: "50", overlay: "60", modal: "80", toast: "90" },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        "fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down var(--bz-duration-base) var(--bz-ease)",
        "accordion-up": "accordion-up var(--bz-duration-base) var(--bz-ease-exit)",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "fade-in": "fade-in var(--bz-duration-slow) var(--bz-ease) forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
