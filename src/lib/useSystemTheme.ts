"use client";
import { useEffect, useState } from "react";
import {
  THEME_EVENT,
  THEME_KEY,
  loadThemeChoice,
  resolveIsDark,
  systemIsDark,
  watchSystemTheme
} from "./theme";

/**
 * Effective dark-mode flag. Follows the candidate's override
 * (Light/Dark/System) and stays in sync with OS changes + toggle events.
 */
export function useSystemTheme(): boolean {
  // Lazy init is SSR-safe and avoids setState-in-effect lint errors.
  const [dark, setDark] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? resolveIsDark(loadThemeChoice(), systemIsDark())
      : false
  );
  useEffect(() => {
    const recompute = () =>
      setDark(resolveIsDark(loadThemeChoice(), systemIsDark()));
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === THEME_KEY) recompute();
    };
    const unwatch = watchSystemTheme(recompute);
    window.addEventListener(THEME_EVENT, recompute);
    window.addEventListener("storage", onStorage);
    recompute();
    return () => {
      unwatch();
      window.removeEventListener(THEME_EVENT, recompute);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return dark;
}
