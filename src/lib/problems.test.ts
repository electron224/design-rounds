import { describe, expect, it } from "vitest";
import {
  PROBLEMS,
  buildSkeleton,
  trackGroups,
  trackNeighbors,
  trackOrder
} from "./problems";
import { RESOURCES, resourceById } from "./resources";

describe("problem bank integrity", () => {
  it("ships 10 problems with unique slugs", () => {
    expect(PROBLEMS).toHaveLength(10);
    expect(new Set(PROBLEMS.map((p) => p.slug)).size).toBe(10);
  });

  it("every problem has requirements, reference solution and starters", () => {
    for (const p of PROBLEMS) {
      expect(p.functionalRequirements.length).toBeGreaterThanOrEqual(4);
      expect(p.referenceObjects.length).toBeGreaterThanOrEqual(3);
      expect(p.referenceFlow.length).toBeGreaterThanOrEqual(1);
      for (const lang of ["java", "python", "typescript"] as const) {
        expect(p.codeStarter[lang]?.length).toBeGreaterThan(0);
      }
      expect(p.timeDefaultMin).toBeGreaterThan(0);
    }
  });

  it("every problem resource ref resolves to a real resource", () => {
    for (const p of PROBLEMS) {
      expect(p.resources.length).toBeGreaterThan(0);
      for (const r of p.resources) {
        expect(resourceById(r.resourceId), `${p.slug}:${r.resourceId}`).toBeDefined();
      }
    }
  });

  it("every problem has clarifying questions for Stage 0", () => {
    for (const p of PROBLEMS) {
      expect(p.expectedQuestions.length, `${p.slug}:questions`).toBeGreaterThanOrEqual(3);
      for (const q of p.expectedQuestions) {
        expect(q.question.length).toBeGreaterThan(10);
        expect(q.why.length).toBeGreaterThan(10);
      }
    }
  });

  it("every problem sits on the track with decisions + follow-ups", () => {
    const orders = PROBLEMS.map((p) => p.order).sort((a, b) => a - b);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const p of PROBLEMS) {
      expect(["starter", "core", "stretch"]).toContain(p.track);
      expect(p.decisions.length, `${p.slug}:decisions`).toBeGreaterThanOrEqual(3);
      expect(p.followUps.length, `${p.slug}:followUps`).toBeGreaterThanOrEqual(2);
      for (const f of p.followUps) {
        expect(f.prompt.length).toBeGreaterThan(10);
        expect(f.hint.length).toBeGreaterThan(10);
      }
    }
    // Starter problems come before stretch ones.
    const ordered = trackOrder();
    expect(ordered[0].track).toBe("starter");
    expect(ordered[ordered.length - 1].track).toBe("stretch");
  });
});

describe("track navigation + model skeleton", () => {
  it("groups problems by track in order", () => {
    const groups = trackGroups();
    expect(groups.map((g) => g.track)).toEqual(["starter", "core", "stretch"]);
    expect(groups[0].problems).toHaveLength(4);
    expect(groups[1].problems).toHaveLength(4);
    expect(groups[2].problems).toHaveLength(2);
  });

  it("links prev/next steps through the whole track", () => {
    const first = trackOrder()[0];
    const n1 = trackNeighbors(first.slug);
    expect(n1.prev).toBeNull();
    expect(n1.next).not.toBeNull();
    expect(n1.index).toBe(0);
    expect(n1.total).toBe(10);

    const last = trackOrder()[9];
    const n2 = trackNeighbors(last.slug);
    expect(n2.next).toBeNull();
    expect(n2.prev?.slug).toBe(trackOrder()[8].slug);
  });

  it("builds a skeleton naming every reference class + decision", () => {
    const p = PROBLEMS[0];
    const out = buildSkeleton(p);
    for (const o of p.referenceObjects) {
      const name = o.name.split(/[^A-Za-z]/)[0];
      expect(out).toContain(`class ${name}`);
    }
    for (const d of p.decisions) expect(out).toContain(d);
  });
});

describe("learning resources", () => {
  it("uses only https links and no blocked domains", () => {
    for (const r of RESOURCES) {
      expect(r.url.startsWith("https://"), r.id).toBe(true);
      expect(r.url).not.toMatch(/refactoring\.guru/);
    }
  });

  it("covers OOP, SOLID, patterns and UML", () => {
    const types = new Set(RESOURCES.map((r) => r.type));
    for (const t of ["oops", "solid", "pattern", "article"] as const) {
      expect(types.has(t), t).toBe(true);
    }
  });
});
