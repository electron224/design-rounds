"use client";
import { useEffect } from "react";
import {
  THEME_COOKIE,
  THEME_EVENT,
  THEME_KEY,
  THEME_SYSTEM_COOKIE,
  applyThemeChoice,
  loadThemeChoice,
  resolveIsDark,
  systemIsDark,
  watchSystemTheme
} from "@/lib/theme";

function writeCookie(name: string, value: string): void {
  try {
    document.cookie = `${name}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* private mode */
  }
}

/**
 * Owns the <html> theme class after mount: applies the stored choice (or OS),
 * stays subscribed to OS/toggle/cross-tab changes, and records the resolved
 * values in cookies so SSR pre-paints correctly next visit. Renders nothing —
 * and crucially no <script> tags, which React refuses to execute.
 */
export default function ThemeProvider() {
  useEffect(() => {
    const apply = () => {
      const choice = loadThemeChoice();
      // Migrate legacy localStorage-only choices into the SSR cookie.
      if (choice !== "system") writeCookie(THEME_COOKIE, choice);
      const dark = resolveIsDark(choice, systemIsDark());
      applyThemeChoice(choice);
      // Last-known OS value: lets the server pre-paint System followers.
      if (choice === "system") writeCookie(THEME_SYSTEM_COOKIE, dark ? "dark" : "light");
    };
    apply();
    const unwatch = watchSystemTheme(apply);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === THEME_KEY) apply();
    };
    window.addEventListener(THEME_EVENT, apply);
    window.addEventListener("storage", onStorage);
    return () => {
      unwatch();
      window.removeEventListener(THEME_EVENT, apply);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
