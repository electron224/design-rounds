import { describe, expect, it } from "vitest";
import { buildReport } from "./report";

const fb = (scores: Record<string, number>, issues: unknown[] = []) =>
  JSON.stringify({ scores, issues, strengths: [], optimizations: [] });

describe("buildReport", () => {
  it("returns null score with nothing submitted", () => {
    const r = buildReport("a1", "atm", [], null);
    expect(r.score10).toBeNull();
    expect(r.stages).toEqual([]);
    expect(r.focusAreas).toEqual([]);
  });

  it("scores out of 10 from latest-per-stage and ranks focus areas", () => {
    const r = buildReport(
      "a1",
      "atm",
      [
        {
          stage: "objects",
          feedback: fb(
            { Completeness: 4, Clarity: 2 },
            [
              { severity: "warning", what: "Missing X", why: "y", fix: "z" },
              { severity: "critical", what: "No errors", why: "y", fix: "z" }
            ]
          ),
          score: 3,
          createdAt: "2026-01-01"
        },
        {
          stage: "objects",
          feedback: fb({ Completeness: 5, Clarity: 5 }, []),
          score: 5,
          createdAt: "2026-01-02"
        }
      ],
      null
    );
    // Latest objects submission (5); 3 stages unsubmitted → 5/20*10.
    expect(r.score10).toBe(2.5);
    expect(r.stages).toEqual([{ stage: "objects", score: 5 }]);
    // Weakest dimensions across submitted stages.
    expect(r.weakestDimensions[0]).toEqual({ name: "Completeness", avg: 5 });
  });

  it("counts unsubmitted stages as zero in the final", () => {
    const r = buildReport(
      "a1",
      "atm",
      ["clarify", "objects", "flow", "code"].map((stage) => ({
        stage,
        feedback: fb({ Completeness: 5 }),
        score: 5,
        createdAt: "2026-01-01"
      })),
      null
    );
    expect(r.score10).toBe(10);
  });

  it("dedupes issues, critical first", () => {
    const issue = (severity: string, what: string) => ({
      severity,
      what,
      why: "w",
      fix: "f"
    });
    const r = buildReport(
      "a1",
      "atm",
      [
        {
          stage: "code",
          feedback: fb(
            { Completeness: 3 },
            [issue("warning", "Same"), issue("critical", "Top")]
          ),
          score: 3,
          createdAt: "2026-01-01"
        },
        {
          stage: "flow",
          feedback: fb({ Completeness: 3 }, [issue("warning", "Same")]),
          score: 3,
          createdAt: "2026-01-01"
        }
      ],
      null
    );
    expect(r.score10).toBe(3);
    expect(r.focusAreas.map((i) => i.what)).toEqual(["Top", "Same"]);
  });

  it("recomputes coherence from drafts", () => {
    const r = buildReport(
      "a1",
      "atm",
      [
        {
          stage: "objects",
          feedback: fb({ Completeness: 4 }),
          score: 4,
          createdAt: "2026-01-01"
        }
      ],
      {
        classes: [{ name: "Card" }, { name: "CashBox" }],
        flow: "User -> Card : insert",
        flowMode: "mermaid",
        files: [{ path: "Card.java", content: "class Card {}" }]
      }
    );
    expect(r.coherence?.missingInCode).toEqual(["CashBox"]);
    expect(r.coherence?.missingInFlow).toEqual(["CashBox"]);
  });
});
