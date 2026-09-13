import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimits,
  checkLimit,
  clientIp,
  rateLimited
} from "./ratelimit";

afterEach(() => {
  __resetRateLimits();
  vi.useRealTimers();
});

describe("checkLimit", () => {
  it("allows up to the limit then blocks with retry-after", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    expect(checkLimit("a", 2, 1000).ok).toBe(true);
    expect(checkLimit("a", 2, 1000).ok).toBe(true);
    const blocked = checkLimit("a", 2, 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
  });

  it("refills after the window and isolates keys", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    expect(checkLimit("a", 1, 1000).ok).toBe(true);
    expect(checkLimit("a", 1, 1000).ok).toBe(false);
    expect(checkLimit("b", 1, 1000).ok).toBe(true);
    vi.setSystemTime(1001);
    expect(checkLimit("a", 1, 1000).ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("prefers the first forwarded address", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" }
    });
    expect(clientIp(req)).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x/"))).toBe("local");
  });

  it("rateLimited carries 429 + Retry-After", async () => {
    const res = rateLimited(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(((await res.json()) as { error: string }).error).toMatch(/slow down/i);
  });
});
