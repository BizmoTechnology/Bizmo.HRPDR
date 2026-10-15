/**
 * Bizmo Universal Theme · Tailwind CSS v3 preset
 *   // tailwind.config.js
 *   module.exports = { presets: [require("@bizmo/theme/tailwind.preset.cjs")], darkMode: ["class", '[data-theme="dark"]'] }
 * tokens.css ayrıca yüklenmelidir (renkler CSS değişkeni olarak okunur).
 */
const v = (n) => `var(--bz-${n})`;
module.exports = {
  theme: {
    extend: {
      fontFamily: { sans: [v("font-sans")], display: [v("font-display")], mono: [v("font-mono")] },
      colors: {
        page: v("bg"), sunken: v("bg-sunken"), surface: { DEFAULT: v("surface"), 2: v("surface-2"), 3: v("surface-3") },
        fg: { DEFAULT: v("text"), 2: v("text-2"), 3: v("text-3") },
        divider: v("divider"), hover: v("hover"), press: v("press"), field: v("field"),
        accent: { DEFAULT: v("accent"), strong: v("accent-strong"), soft: v("accent-soft"), ink: v("accent-ink"), contrast: v("accent-contrast") },
        data: { DEFAULT: v("data"), ink: v("data-ink"), soft: v("data-soft"), solid: v("data-solid"), contrast: v("data-contrast") },
        success: { DEFAULT: v("success"), ink: v("success-ink"), soft: v("success-soft") },
        warning: { DEFAULT: v("warning"), ink: v("warning-ink"), soft: v("warning-soft") },
        danger: { DEFAULT: v("danger"), ink: v("danger-ink"), soft: v("danger-soft"), solid: v("danger-solid") },
        info: { DEFAULT: v("info"), ink: v("info-ink"), soft: v("info-soft") },
        series: { 1: v("series-1"), 2: v("series-2"), 3: v("series-3"), 4: v("series-4"), 5: v("series-5"), 6: v("series-6") },
        bizmo: { green: v("green-500"), blue: v("blue-500"), navy: v("navy-800"), cream: v("cream-100") },
      },
      borderRadius: { xs: v("radius-xs"), sm: v("radius-sm"), md: v("radius-md"), lg: v("radius-lg") },
      boxShadow: { 1: v("shadow-1"), 2: v("shadow-2"), 3: v("shadow-3"), green: v("shadow-green") },
      transitionTimingFunction: { bizmo: v("ease"), "bizmo-exit": v("ease-exit") },
      height: { control: v("control-md"), "control-sm": v("control-sm"), "control-lg": v("control-lg"), topbar: v("topbar-h") },
      width: { sidebar: v("sidebar-w"), "sidebar-collapsed": v("sidebar-w-collapsed") },
      zIndex: { sticky: "10", topbar: "20", sidebar: "30", dropdown: "50", overlay: "60", modal: "80", toast: "90" },
    },
  },
};
