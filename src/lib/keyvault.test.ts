import { beforeEach, describe, expect, it } from "vitest";
import {
  decryptKey,
  encryptKey,
  last4,
  vaultEnabled,
} from "./keyvault";

// Fixed fixture — never a real key.
process.env.KEYVAULT_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeEach(() => {
  process.env.KEYVAULT_SECRET =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("keyvault", () => {
  it("round-trips a key", () => {
    const cipher = encryptKey("gsk-test-key", "user-1", "groq");
    expect(cipher).not.toContain("gsk-test-key");
    expect(decryptKey(cipher, "user-1", "groq")).toBe("gsk-test-key");
  });

  it("binds ciphertext to user + provider (AAD)", () => {
    const cipher = encryptKey("gsk-test-key", "user-1", "groq");
    expect(() => decryptKey(cipher, "user-2", "groq")).toThrow();
    expect(() => decryptKey(cipher, "user-1", "openai")).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const cipher = encryptKey("gsk-test-key", "user-1", "groq");
    const tampered = cipher.slice(0, -2) + (cipher.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptKey(tampered, "user-1", "groq")).toThrow();
  });

  it("is disabled without a valid secret", () => {
    process.env.KEYVAULT_SECRET = "";
    expect(vaultEnabled()).toBe(false);
    expect(() => encryptKey("x", "u", "p")).toThrow();
    process.env.KEYVAULT_SECRET = "short";
    expect(vaultEnabled()).toBe(false);
  });

  it("masks keys to last4", () => {
    expect(last4("gsk-test-1234")).toBe("…1234");
    expect(last4("ab")).toBe("…ab");
  });
});
