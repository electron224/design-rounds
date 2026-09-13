import { describe, expect, it } from "vitest";
import { normalizeSceneForTheme, seedEntityBoxes, summarizeScene } from "./scene";

describe("summarizeScene", () => {
  it("flags an empty whiteboard", () => {
    expect(summarizeScene([])).toMatch(/EMPTY/i);
  });

  it("extracts labeled boxes, connectors and notes", () => {
    const els = [
      { id: "box1", type: "rectangle" },
      { id: "t1", type: "text", text: "ParkingLot", containerId: "box1" },
      { id: "box2", type: "rectangle" },
      { id: "t2", type: "text", text: "Ticket", containerId: "box2" },
      {
        id: "a1",
        type: "arrow",
        startBinding: { elementId: "box1" },
        endBinding: { elementId: "box2" }
      },
      { id: "t3", type: "text", text: "creates", containerId: "a1" },
      { id: "n1", type: "text", text: "error: full lot", containerId: null }
    ];
    const out = summarizeScene(els);
    expect(out).toContain('"ParkingLot"');
    expect(out).toContain('ParkingLot -> Ticket : "creates"');
    expect(out).toContain('Note: "error: full lot"');
  });

  it("marks unlabeled shapes instead of dropping them", () => {
    const out = summarizeScene([{ id: "b1", type: "diamond" }]);
    expect(out).toMatch(/unlabeled shape/i);
  });
});

describe("normalizeSceneForTheme", () => {
  it("maps near-black strokes to white in dark mode", () => {
    const out = normalizeSceneForTheme(
      [
        { id: "a", type: "rectangle", strokeColor: "#1e1e1e" },
        { id: "t", type: "text", text: "Hi", strokeColor: "#000000" }
      ],
      true
    ) as { strokeColor: string }[];
    expect(out[0].strokeColor).toBe("#ffffff");
    expect(out[1].strokeColor).toBe("#ffffff");
  });

  it("maps near-white strokes to dark in light mode", () => {
    const out = normalizeSceneForTheme(
      [{ id: "a", type: "arrow", strokeColor: "#ffffff" }],
      false
    ) as { strokeColor: string }[];
    expect(out[0].strokeColor).toBe("#1e1e1e");
  });

  it("leaves deliberate colors and uncolored elements alone", () => {
    const els = [
      { id: "a", type: "rectangle", strokeColor: "#e03131", backgroundColor: "#fff5f5" },
      { id: "b", type: "ellipse" }
    ];
    const out = normalizeSceneForTheme(els, true) as typeof els;
    expect(out[0].strokeColor).toBe("#e03131");
    expect(out[0].backgroundColor).toBe("#fff5f5");
    expect(out[1]).toEqual({ id: "b", type: "ellipse" });
  });

  it("clears pure-black fills that would swallow shapes", () => {
    const out = normalizeSceneForTheme(
      [{ id: "a", type: "rectangle", backgroundColor: "#000000" }],
      true
    ) as { backgroundColor: string }[];
    expect(out[0].backgroundColor).toBe("transparent");
  });
});

describe("seedEntityBoxes", () => {
  it("turns entity cards into labeled boxes with deterministic ids", () => {
    const els = seedEntityBoxes(
      [{ name: "Ticket" }, { name: "  " }, { name: "Slot" }],
      false
    ) as Record<string, unknown>[];
    expect(els).toHaveLength(4);
    const boxes = els.filter((e) => e.type === "rectangle");
    const texts = els.filter((e) => e.type === "text");
    expect(boxes.map((b) => b.id)).toEqual(["seed-box-0", "seed-box-1"]);
    expect(texts.map((t) => t.text)).toEqual(["Ticket", "Slot"]);
    expect(texts[0].containerId).toBe("seed-box-0");
    expect(boxes[0].strokeColor).toBe("#1e1e1e");
  });

  it("uses light strokes in dark mode and caps at 12 entities", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ name: `E${i}` }));
    const els = seedEntityBoxes(many, true) as Record<string, unknown>[];
    expect(els).toHaveLength(24);
    expect(els[0].strokeColor).toBe("#ffffff");
  });

  it("seeded boxes summarize back into reviewable text", () => {
    const out = summarizeScene(seedEntityBoxes([{ name: "Ticket" }], false));
    expect(out).toContain('"Ticket"');
  });
});
