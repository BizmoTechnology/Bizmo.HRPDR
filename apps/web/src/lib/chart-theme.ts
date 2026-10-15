"use client";

import { useEffect, useState } from "react";
import { CHROME, SEQUENTIAL, SERIES, STATUS, type Mode } from "@bizmo/theme/charts";
import { useTheme } from "@ph/ui";

/**
 * ApexCharts için Bizmo grafik teması (DESIGN.md §28): sabit sıralı seri paleti, soluk ızgara,
 * 11px soluk eksen etiketi, Inter. Tema değişince bileşen yeniden çizilir.
 */
export function useChartTheme() {
  const { resolved } = useTheme();
  const mode: Mode = resolved;
  const [fontFamily, setFontFamily] = useState(CHROME.light.font);

  useEffect(() => {
    // next/font aile adı (ör. "__Inter_xxx") CSS değişkeninden okunur; SVG font-family özniteliği var() kabul etmez
    const inter = getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim();
    if (inter) setFontFamily(`${inter}, ${CHROME.light.font}`);
  }, []);

  const chrome = CHROME[mode];
  return {
    mode,
    dark: mode === "dark",
    series: SERIES[mode],
    status: STATUS[mode],
    sequential: SEQUENTIAL,
    surface: chrome.surface,
    text: chrome.text,
    text2: chrome.text2,
    muted: chrome.muted,
    grid: chrome.grid,
    axis: chrome.axis,
    fontFamily,
  };
}

export type ChartTheme = ReturnType<typeof useChartTheme>;
