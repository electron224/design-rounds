export type ThemeChoice = "light" | "dark" | "system";

export const THEME_KEY = "lld_theme";
export const THEME_EVENT = "lld-theme-change";
// Mirror of the choice + last-known OS value for SSR pre-paint (no scripts).
export const THEME_COOKIE = "lld_theme";
export const THEME_SYSTEM_COOKIE = "lld_theme_system";

export function loadThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* private mode — fall through to system */
  }
  return "system";
}

export function systemIsDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Subscribes to OS theme changes; no-op where matchMedia is unavailable. */
export function watchSystemTheme(cb: () => void): () => void {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return () => {};
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  } catch {
    return () => {};
  }
}

export function resolveIsDark(choice: ThemeChoice, systemDark: boolean): boolean {
  return choice === "system" ? systemDark : choice === "dark";
}

/**
 * Server-side first paint: an explicit choice wins, otherwise the last-known
 * OS value recorded by ThemeProvider. First-ever visit has neither and paints
 * light; the provider corrects it on mount (single flash, once ever).
 */
export function resolveInitialDark(
  explicit: string | undefined,
  systemCookie: string | undefined
): boolean {
  if (explicit === "dark") return true;
  if (explicit === "light") return false;
  return systemCookie === "dark";
}

function writeCookie(name: string, value: string | null): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie =
      value === null
        ? `${name}=; Path=/; Max-Age=0; SameSite=Lax`
        : `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* private mode — session-only */
  }
}

/** Applies the effective theme to <html>. Safe to call on the server (no-op). */
export function applyThemeChoice(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle(
    "dark",
    resolveIsDark(choice, systemIsDark())
  );
}

/** Persists the candidate's choice, applies it, and notifies listeners. */
export function saveThemeChoice(choice: ThemeChoice): void {
  if (typeof window !== "undefined") {
    try {
      if (choice === "system") window.localStorage.removeItem(THEME_KEY);
      else window.localStorage.setItem(THEME_KEY, choice);
    } catch {
      /* private mode — choice applies for this session only */
    }
  }
  // Cookie mirror lets the server pre-paint the theme — no script tags needed.
  writeCookie(THEME_COOKIE, choice === "system" ? null : choice);
  applyThemeChoice(choice);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: choice }));
  }
}
