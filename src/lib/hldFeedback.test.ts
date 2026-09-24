import { describe, expect, it } from "vitest";
import {
  buildHldPrompt,
  hldStaticFeedback,
  type HldStage,
} from "./hldFeedback";
import { hldBySlug } from "./hld";

const shortener = hldBySlug("url-shortener")!;
const stages: HldStage[] = ["requirements", "capacity", "api", "diagram", "deepdive"];

describe("hldStaticFeedback", () => {
  it("covers every stage with HLD dimensions", () => {
    for (const stage of stages) {
      const fb = hldStaticFeedback(shortener, stage, "placeholder payload ".repeat(20));
      expect(Object.keys(fb.scores)).toEqual([
        "Completeness",
        "Scale numbers",
        "Bottleneck analysis",
        "Tradeoffs",
        "Edge cases",
        "Clarity",
      ]);
      expect(fb.provider).toBe("static");
      expect(fb.verdict.length).toBeGreaterThan(0);
    }
  });

  it("floors near-empty submissions to 1s", () => {
    const fb = hldStaticFeedback(shortener, "api", "GET");
    expect(Object.values(fb.scores).every((s) => s === 1)).toBe(true);
    expect(fb.issues[0].severity).toBe("critical");
  });

  it("rewards full requirements coverage with per-item verdicts", () => {
    const payload = shortener.requirements.join("\n");
    const fb = hldStaticFeedback(shortener, "requirements", payload);
    expect(fb.scores.Completeness).toBe(5);
    expect(fb.itemVerdicts).toHaveLength(shortener.requirements.length);
    expect(fb.itemVerdicts.every((v) => v.verdict === "right")).toBe(true);
  });

  it("grades capacity against the worked reference", () => {
    const close = hldStaticFeedback(shortener, "capacity", `plan for ${shortener.capacityWorked.rps} writes/s with redis cache and 4 shards`);
    expect(close.scores["Scale numbers"]).toBeGreaterThanOrEqual(4);
    const far = hldStaticFeedback(shortener, "capacity", "plan for 5 writes/s total, one big postgres box, no cache at all xyzzy ".repeat(5));
    expect(far.scores["Scale numbers"]).toBeLessThanOrEqual(2);
  });

  it("counts API endpoints and diagram edges", () => {
    const api = hldStaticFeedback(
      shortener,
      "api",
      "POST /v1/shorten takes url returns code\nGET /:code 302 redirect\nGET /v1/stats/:code click counts"
    );
    expect(api.scores.Completeness).toBeGreaterThanOrEqual(4);
    const edges = shortener.components.slice(0, 3).join("→");
    const diagram = hldStaticFeedback(shortener, "diagram", `Client→CDN\nCDN→LB\nLB→App\nApp→Cache\nCache→DB ${edges}`);
    expect(diagram.scores.Completeness).toBeGreaterThanOrEqual(4);
  });
});

describe("buildHldPrompt", () => {
  it("uses HLD interviewer voice with reference + history", () => {
    const { system, user } = buildHldPrompt(shortener, "capacity", "500 writes/s", [
      { stage: "requirements", verdict: "solid", scores: { Completeness: 4 } },
    ]);
    expect(system).toMatch(/high.level|HLD/i);
    expect(system).toMatch(/Scale numbers/);
    expect(user).toContain("URL Shortener");
    expect(user).toContain("500 writes/s");
    expect(user).toMatch(/coherence/i);
  });
});
