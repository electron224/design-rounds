import { describe, expect, it } from "vitest";
import {
  HLD_PROBLEMS,
  cacheStepIndex,
  clampRps,
  estimateCapacity,
  hldBySlug,
  shardStatus,
} from "./hld";

describe("hld", () => {
  it("ships classic 3", () => {
    expect(HLD_PROBLEMS.map((p) => p.slug).sort()).toEqual([
      "rate-limiter",
      "twitter-timeline",
      "url-shortener",
    ]);
  });
  it("resolves by slug", () => {
    expect(hldBySlug("url-shortener")?.title).toBe("URL Shortener");
  });
  it("capacity math scales with cache hit + shards", () => {
    const out = estimateCapacity({
      rps: 1000,
      readRatio: 0.9,
      cacheHit: 0.8,
      shards: 4,
    });
    expect(out.dbRps).toBeCloseTo(1000 * 0.9 * 0.2 + 1000 * 0.1);
    expect(out.storagePerDayGB).toBeGreaterThan(0);
  });
  it("clamps playground RPS into slider range", () => {
    expect(clampRps(200000)).toBeLessThanOrEqual(100000);
    expect(clampRps(500)).toBe(500);
  });
  it("flags hot shards", () => {
    expect(shardStatus(500)).toBe("healthy");
    expect(shardStatus(3000)).toBe("warm");
    expect(shardStatus(20000)).toBe("hot");
  });
  it("finds the cache hop for hit/miss branching", () => {
    const p = hldBySlug("url-shortener")!;
    expect(cacheStepIndex(p.flow)).toBeGreaterThan(0);
  });
});
