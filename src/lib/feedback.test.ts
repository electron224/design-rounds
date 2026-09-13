import { describe, expect, it } from "vitest";
import { staticFeedback } from "./feedback";
import { problemBySlug } from "./problems";

const parkingLot = problemBySlug("parking-lot")!;

describe("staticFeedback (offline rubric)", () => {
  it("flags missing object-model concepts with fixes", () => {
    const fb = staticFeedback(
      parkingLot,
      "objects",
      JSON.stringify([
        { name: "ParkingLot", attributes: "floors, pricing", methods: "allocate, release", relationship: "has-a" },
        { name: "Vehicle", attributes: "plate, type", methods: "", relationship: "uses" }
      ])
    );
    expect(fb.provider).toBe("static");
    expect(fb.issues.length).toBeGreaterThan(0);
    expect(fb.issues[0]).toHaveProperty("fix");
    expect(fb.optimizations.join(" ")).toMatch(/Can it be optimized/i);
  });

  it("floors near-empty submissions to 1s instead of averages", () => {
    for (const [stage, payload] of [
      ["objects", "[]"],
      ["flow", "a diagram"],
      ["code", "class X"],
      ["clarify", "why?"]
    ] as const) {
      const fb = staticFeedback(parkingLot, stage, payload);
      expect(
        Object.values(fb.scores),
        stage
      ).toEqual([1, 1, 1, 1, 1, 1]);
      expect(fb.verdict).toMatch(/nothing to grade/i);
    }
  });

  it("calls out unchanged starter code", () => {
    const fb = staticFeedback(
      parkingLot,
      "code",
      `Project (1 file(s)):\n- Solution.java\n\n===== FILE: Solution.java =====\n${parkingLot.codeStarter.java}\n// my note`
    );
    expect(fb.scores.Completeness).toBe(1);
    expect(fb.issues.some((i) => i.what.match(/starter/i))).toBe(true);
  });

  it("rewards covering the expected classes", () => {
    const payload = JSON.stringify(
      parkingLot.referenceObjects.map((o) => ({ name: o.name }))
    );
    const fb = staticFeedback(parkingLot, "objects", payload);
    expect(fb.scores.Completeness).toBeGreaterThanOrEqual(4);
  });

  it("judges each submitted class right, extra, or weak", () => {
    const fb = staticFeedback(
      parkingLot,
      "objects",
      JSON.stringify([
        { name: "Ticket", attributes: "entryTime", methods: "fee()" },
        { name: "Spaceship", attributes: "x", methods: "fly()" },
        { name: "Mystery", attributes: "", methods: "" }
      ])
    );
    const byName = Object.fromEntries(fb.itemVerdicts.map((v) => [v.name, v]));
    expect(byName.Ticket.verdict).toBe("right");
    expect(byName.Ticket.note).toMatch(/Ticket/);
    expect(byName.Spaceship.verdict).toBe("extra");
    expect(byName.Mystery.verdict).toBe("weak");
  });

  it("requires error branches in the flow stage", () => {
    const fb = staticFeedback(
      parkingLot,
      "flow",
      "sequenceDiagram\n Client ->> ParkingLot : allocate vehicle\n ParkingLot -->> Client : ticket"
    );
    expect(
      fb.issues.some((i) => i.what.match(/error|alternate/i))
    ).toBe(true);
  });

  it("reviews multi-file code payloads", () => {
    const fb = staticFeedback(
      parkingLot,
      "code",
      "===== FILE: model/Slot.java =====\nclass Slot { String id; }"
    );
    expect(fb.strengths.length).toBeGreaterThan(0);
    expect(fb.patternSuggestions).toContain("Strategy");
  });

  it("grades clarifying questions against the expected set", () => {
    const empty = staticFeedback(parkingLot, "clarify", "");
    expect(empty.scores.Completeness).toBe(1);
    expect(empty.issues.length).toBeGreaterThan(0);

    const sharp = staticFeedback(
      parkingLot,
      "clarify",
      "Who are the users, drivers or valets? Is pricing fixed at entry or computed at exit? Single lot or many lots sharing users?"
    );
    expect(sharp.scores.Completeness).toBeGreaterThanOrEqual(4);
  });

  it("credits a sharp out-of-list question like parking a bus", () => {
    const fb = staticFeedback(parkingLot, "clarify", "Can we park a bus ??");
    expect(fb.scores.Completeness).toBe(2);
    expect(fb.strengths.join(" ")).toMatch(/bus/i);
    expect(fb.verdict).toMatch(/good instincts/i);
    // The other expected questions are still honestly missing.
    expect(fb.issues.length).toBe(3);
  });

  it("recognizes generic clarification intents", () => {
    const fb = staticFeedback(parkingLot, "clarify", "Who are the users?");
    expect(fb.scores.Completeness).toBeGreaterThanOrEqual(2);
    expect(fb.strengths.length).toBeGreaterThan(0);
  });
});
