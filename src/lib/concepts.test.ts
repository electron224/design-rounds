import { describe, expect, it } from "vitest";
import { CONCEPTS, conceptById } from "./concepts";
import { problemBySlug } from "./problems";

describe("concepts", () => {
  it("ships the 4 pattern sims", () => {
    expect(CONCEPTS.map((c) => c.id).sort()).toEqual([
      "decorator",
      "observer",
      "state",
      "strategy",
    ]);
  });

  it("resolves by id", () => {
    expect(conceptById("strategy")?.title).toMatch(/strategy/i);
  });

  it("links only real problems", () => {
    for (const c of CONCEPTS) {
      expect(c.problemSlugs.length).toBeGreaterThan(0);
      for (const slug of c.problemSlugs) {
        expect(problemBySlug(slug), `${c.id} → ${slug}`).toBeTruthy();
      }
    }
  });

  it("carries sim payloads for every concept", () => {
    for (const c of CONCEPTS) {
      expect(c.idea.length).toBeGreaterThan(10);
      expect(c.designMove.length).toBeGreaterThan(10);
    }
  });
});
