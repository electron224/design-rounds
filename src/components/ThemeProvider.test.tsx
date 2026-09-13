// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import ThemeProvider from "./ThemeProvider";

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
  document.cookie = "lld_theme=; Max-Age=0; Path=/";
  document.cookie = "lld_theme_system=; Max-Age=0; Path=/";
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

describe("ThemeProvider", () => {
  it("renders nothing but applies the OS theme and records it", () => {
    stubMatchMedia(true);
    const { container } = render(<ThemeProvider />);
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("lld_theme_system=dark");
  });

  it("honors an explicit stored choice over the OS", () => {
    stubMatchMedia(true);
    window.localStorage.setItem("lld_theme", "light");
    render(<ThemeProvider />);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
