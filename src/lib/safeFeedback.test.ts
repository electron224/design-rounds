import { describe, expect, it } from "vitest";
import { sanitizeStageFeedback } from "./safeFeedback";

describe("sanitizeStageFeedback", () => {
  it("renders the exact crashing shape harmless", () => {
    const fb = sanitizeStageFeedback({
      scores: { Completeness: 4 },
      optimizations: [
        { optimization: "Cache pricing", feasibility: "easy", impact: "high" }
      ],
      verdict: "ok",
      provider: "llm"
    });
    expect(fb.optimizations).toEqual(["Cache pricing — easy — high"]);
    expect(JSON.stringify(fb)).not.toContain("[object Object]");
  });

  it("coerces scores, severities, urls and verdicts", () => {
    const fb = sanitizeStageFeedback({
      scores: { Completeness: "5", Bogus: "high", Negative: -3, Huge: 99 },
      issues: [
        { severity: "critical", what: { deep: ["x"] }, why: 7 },
        "plain string",
        null
      ],
      resources: [{ title: "t", url: { evil: true }, reason: null }],
      verdict: 42,
      provider: "weird"
    });
    expect(fb.scores).toEqual({ Completeness: 5, Negative: 1, Huge: 5 });
    expect(fb.issues[0]).toEqual({
      severity: "critical",
      what: '{"deep":["x"]}',
      why: "7",
      fix: ""
    });
    expect(fb.issues[1].severity).toBe("info");
    expect(fb.resources[0].url).toBe("#");
    expect(fb.verdict).toBe("42");
    expect(fb.provider).toBe("static");
  });

  it("preserves engine and llmError strings, drops non-strings", () => {
    const fb = sanitizeStageFeedback({
      scores: {},
      provider: "llm",
      engine: "Gemini · your key",
      llmError: { code: 400 }
    });
    expect(fb.engine).toBe("Gemini · your key");
    expect(fb.llmError).toBeUndefined();
  });

  it("handles null, arrays and primitives without throwing", () => {
    for (const input of [null, undefined, 42, "str", [1, 2]]) {
      const fb = sanitizeStageFeedback(input);
      expect(fb.provider).toBe("static");
      expect(fb.verdict).toBe("See issues above.");
    }
  });

  it("sanitizes per-item verdicts, defaulting unknown verdicts", () => {
    const fb = sanitizeStageFeedback({
      scores: {},
      itemVerdicts: [
        { name: "Ticket", verdict: "right", note: "good" },
        { name: "X", verdict: "bogus", note: { nested: true } },
        "garbage"
      ]
    });
    expect(fb.itemVerdicts).toEqual([
      { name: "Ticket", verdict: "right", note: "good" },
      { name: "X", verdict: "extra", note: '{"nested":true}' },
      { name: "Untitled", verdict: "extra", note: "" }
    ]);
  });
});
