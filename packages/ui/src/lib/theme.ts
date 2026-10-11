/**
 * Tema modu (DESIGN.md §7): tercih "light" | "dark" | "system", <html data-theme> ile uygulanır.
 * Tailwind'in dark: varyantı ve sonner gibi üçüncü taraf bileşenler için .dark sınıfı da eşitlenir.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "bz-theme";
/** Önceki sürümün anahtarı: eski tercihler kaybolmasın diye okunur */
const LEGACY_THEME_STORAGE_KEY = "theme";

/**
 * İlk boyamadan önce <head> içinde çalışır; temanın yanıp sönmesini önler.
 * Tercih yoksa işletim sistemi teması izlenir.
 */
export const themeInitScript = `(function(){try{var s=localStorage.getItem("${THEME_STORAGE_KEY}")||localStorage.getItem("${LEGACY_THEME_STORAGE_KEY}");var d=s==="dark"||((!s||s==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.classList.toggle("dark",d);}catch(e){}})();`;

export function readThemePreference(): ThemePreference {
  try {
    const stored =
      localStorage.getItem(THEME_STORAGE_KEY) ?? localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Özel pencere / engellenmiş depolama: sistem teması
  }
  return "system";
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref !== "system") return pref;
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.classList.toggle("dark", resolved === "dark");
  return resolved;
}

export function setThemePreference(pref: ThemePreference): ResolvedTheme {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
    localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  } catch {
    // Tercih saklanamazsa yalnız bu oturumda uygulanır
  }
  return applyTheme(pref);
}

export function currentResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}
