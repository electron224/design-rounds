// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_COOKIE,
  THEME_KEY,
  applyThemeChoice,
  loadThemeChoice,
  resolveInitialDark,
  resolveIsDark,
  saveThemeChoice
} from "./theme";

function clearCookies() {
  for (const name of [THEME_COOKIE, "lld_theme_system"]) {
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

function stubMatchMedia(dark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: dark && query.includes("dark"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  });
}

beforeEach(() => {
  window.localStorage.clear();
  clearCookies();
  document.documentElement.classList.remove("dark");
  stubMatchMedia(false);
  vi.restoreAllMocks();
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("resolveIsDark", () => {
  it("follows the OS choice only in system mode", () => {
    expect(resolveIsDark("system", true)).toBe(true);
    expect(resolveIsDark("system", false)).toBe(false);
    expect(resolveIsDark("dark", false)).toBe(true);
    expect(resolveIsDark("light", true)).toBe(false);
  });
});

describe("theme persistence + application", () => {
  it("defaults to system with no stored value", () => {
    expect(loadThemeChoice()).toBe("system");
  });

  it("saves an explicit choice and toggles the .dark class", () => {
    saveThemeChoice("dark");
    expect(window.localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    saveThemeChoice("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("system choice clears storage and tracks the OS", () => {
    stubMatchMedia(true);
    saveThemeChoice("system");
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    applyThemeChoice("system");
    stubMatchMedia(false);
    applyThemeChoice("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("notifies listeners so canvases/editors can follow", () => {
    const seen: string[] = [];
    window.addEventListener("lld-theme-change", (e) =>
      seen.push((e as CustomEvent).detail)
    );
    saveThemeChoice("dark");
    expect(seen).toEqual(["dark"]);
  });

  it("mirrors the choice into a cookie for SSR pre-paint", () => {
    saveThemeChoice("dark");
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    saveThemeChoice("system");
    expect(document.cookie).not.toContain(`${THEME_COOKIE}=dark`);
  });
});

describe("resolveInitialDark (SSR first paint)", () => {
  it("explicit choice wins, else last-known OS, else light", () => {
    expect(resolveInitialDark("dark", undefined)).toBe(true);
    expect(resolveInitialDark("dark", "light")).toBe(true);
    expect(resolveInitialDark("light", "dark")).toBe(false);
    expect(resolveInitialDark("system", "dark")).toBe(true);
    expect(resolveInitialDark("system", "light")).toBe(false);
    expect(resolveInitialDark(undefined, undefined)).toBe(false);
  });
});
