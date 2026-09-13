import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

function testKey(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/llm-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/llm-test", () => {
  it("confirms a working key without echoing it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const res = await testKey({
      provider: "gemini",
      key: "AIza-test",
      model: "gemini-3.5-flash-lite"
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(JSON.stringify(data)).not.toContain("AIza-test");
  });

  it("translates provider rejections into plain hints", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 })
    );
    const data = await (
      await testKey({ provider: "gemini", key: "bad", model: "gemini-3.5-flash-lite" })
    ).json();
    expect(data.ok).toBe(false);
    expect(data.detail).toMatch(/rejected/i);
  });

  it("rejects unknown providers and bad bodies without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const data = await (
      await testKey({ provider: "evil", key: "x", model: "x" })
    ).json();
    expect(data.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(((await (await testKey({})).json()) as { ok: boolean }).ok).toBe(false);
  });

  it("reports unreachable providers instead of hanging", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const data = await (
      await testKey({ provider: "groq", key: "x", model: "llama-3.1-8b-instant" })
    ).json();
    expect(data.ok).toBe(false);
    expect(data.detail).toMatch(/reach/i);
  });
});
