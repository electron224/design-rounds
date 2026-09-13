import { describe, expect, it } from "vitest";
import {
  LLM_PROVIDERS,
  MODEL_ID_RE,
  isValidModel,
  providerById
} from "./providers";

describe("provider allowlist", () => {
  it("exposes only https endpoints on known hosts", () => {
    expect(LLM_PROVIDERS.length).toBeGreaterThanOrEqual(3);
    const ids = new Set<string>();
    for (const p of LLM_PROVIDERS) {
      expect(ids.has(p.id), `duplicate ${p.id}`).toBe(false);
      ids.add(p.id);
      expect(p.baseUrl.startsWith("https://"), p.id).toBe(true);
      expect(p.models.length).toBeGreaterThan(0);
      expect(p.models.some((m) => m.id === p.defaultModel)).toBe(true);
    }
  });

  it("resolves by id and rejects unknowns", () => {
    expect(providerById("gemini")?.baseUrl).toContain("googleapis.com");
    expect(providerById("evil")).toBeUndefined();
  });

  it("caps model ids to a safe charset", () => {
    expect(isValidModel("gemini-2.0-flash")).toBe(true);
    expect(isValidModel("openai/gpt-4o-mini")).toBe(true);
    // Dots/slashes stay legal (versions, OpenRouter ids) — the id only ever
    // travels as a JSON string to an allowlisted host, never a path or shell.
    expect(isValidModel("model id with spaces")).toBe(false);
    expect(isValidModel("x".repeat(101))).toBe(false);
    expect(isValidModel("")).toBe(false);
    expect(MODEL_ID_RE.test("model; rm -rf")).toBe(false);
  });
});
