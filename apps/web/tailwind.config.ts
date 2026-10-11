import type { Config } from "tailwindcss";

// Renkler, köşeler, gölgeler ve yazı aileleri Bizmo Universal Theme token'larından gelir (packages/ui/tailwind.preset.cjs).
export default {
  presets: [require("@ph/ui/tailwind.preset.cjs")],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  prefix: "",
} satisfies Config;
