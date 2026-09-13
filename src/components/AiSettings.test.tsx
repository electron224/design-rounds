// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AiSettings from "./AiSettings";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AiSettings", () => {
  it("starts on the static rubric with no saved key", () => {
    render(<AiSettings />);
    expect(screen.getByText("AI: static rubric")).toBeInTheDocument();
  });

  it("saves provider + model + key to this browser only", () => {
    render(<AiSettings />);
    fireEvent.click(screen.getByText("Use my key"));
    fireEvent.change(screen.getByTitle("Provider"), {
      target: { value: "groq" }
    });
    fireEvent.change(screen.getByPlaceholderText(/re-enter to change/i), {
      target: { value: "gsk-test-key" }
    });
    fireEvent.click(screen.getByText("Save"));

    expect(screen.getByText(/AI: Groq/)).toBeInTheDocument();
    const saved = JSON.parse(
      window.localStorage.getItem("lld_ai_config")!
    );
    expect(saved).toEqual({
      provider: "groq",
      key: "gsk-test-key",
      model: "llama-3.1-8b-instant"
    });
  });

  it("refuses to save without a key and removes on demand", () => {
    render(<AiSettings />);
    fireEvent.click(screen.getByText("Use my key"));
    fireEvent.click(screen.getByText("Save"));
    expect(screen.getByText(/paste an api key/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("lld_ai_config")).toBeNull();
  });

  it("tests the key against the provider and shows the verdict", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, detail: "Google Gemini key works." })
      })
    );
    render(<AiSettings />);
    fireEvent.click(screen.getByText("Use my key"));
    fireEvent.change(screen.getByPlaceholderText(/re-enter to change/i), {
      target: { value: "AIza-test" }
    });
    fireEvent.click(screen.getByText("Test"));
    expect(await screen.findByText(/key works/)).toBeInTheDocument();
  });
});
