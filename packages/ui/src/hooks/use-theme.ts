"use client";

import { useCallback, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  currentResolvedTheme,
  readThemePreference,
  setThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "../lib/theme";

/**
 * Tema tercihi ve çözülmüş tema. <html data-theme> değişimini izler; sistem modunda işletim sistemi
 * temasına, başka sekmedeki değişikliğe de uyar.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    setPreference(readThemePreference());
    setResolved(currentResolvedTheme());

    const root = document.documentElement;
    const observer = new MutationObserver(() => setResolved(currentResolvedTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onMedia = () => {
      if (readThemePreference() === "system") applyTheme("system");
    };
    media.addEventListener("change", onMedia);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = readThemePreference();
      setPreference(next);
      applyTheme(next);
    };
    window.addEventListener("storage", onStorage);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", onMedia);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    setResolved(setThemePreference(next));
  }, []);

  return { preference, resolved, setTheme };
}
