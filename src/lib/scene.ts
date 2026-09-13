/**
 * Converts an Excalidraw whiteboard scene into plain text the feedback engine
 * (static rubric or LLM) can review: boxes with labels, connectors with
 * labels, and free notes. Keeps the whiteboard machine-reviewable without
 * image understanding.
 */

interface SketchEl {
  id: string;
  type: string;
  text?: string;
  containerId?: string | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
  strokeColor?: string;
  backgroundColor?: string;
}

// Near-black strokes (Excalidraw light-theme defaults) vanish on dark canvas;
// near-white strokes vanish on light canvas. Only these extremes are remapped.
const DARK_STROKES = new Set([
  "#1e1e1e",
  "#000000",
  "#000",
  "#343a40",
  "#212529"
]);
const LIGHT_STROKES = new Set([
  "#ffffff",
  "#fff",
  "#f8f9fa",
  "#e9ecef",
  "#dee2e6"
]);

/**
 * Remaps extreme stroke/background colors so a scene drawn in one theme stays
 * visible after switching to the other. Deliberate colors (red, blue, …)
 * are left untouched. Text glyphs use `strokeColor` in Excalidraw, so they
 * are covered by the same mapping.
 */
export function normalizeSceneForTheme(
  input: readonly object[],
  dark: boolean
): object[] {
  return (input as SketchEl[]).map((el) => {
    const out = { ...el };
    const stroke = (el.strokeColor ?? "").toLowerCase();
    if (dark && DARK_STROKES.has(stroke)) out.strokeColor = "#ffffff";
    else if (!dark && LIGHT_STROKES.has(stroke)) out.strokeColor = "#1e1e1e";
    const bg = (el.backgroundColor ?? "").toLowerCase();
    if (bg === "#000000" || bg === "#1e1e1e")
      out.backgroundColor = "transparent";
    return out;
  });
}

const BOX_TYPES = new Set(["rectangle", "diamond", "ellipse"]);

function labelOf(
  boxId: string,
  byId: Map<string, SketchEl>,
  texts: SketchEl[]
): string {
  // Bound text (double-click text inside a shape) …
  const direct = texts.find((t) => t.containerId === boxId);
  if (direct?.text?.trim()) return direct.text.trim().replace(/\s+/g, " ");
  // …or a start/end binding target that is itself a box.
  const box = byId.get(boxId);
  if (box?.text?.trim()) return box.text.trim().replace(/\s+/g, " ");
  return "(unlabeled shape)";
}

export function summarizeScene(input: readonly object[]): string {
  const els = input as SketchEl[];
  if (els.length === 0)
    return "Whiteboard UML sketch: EMPTY — the candidate drew nothing.";

  const byId = new Map(els.map((e) => [e.id, e]));
  const texts = els.filter((e) => e.type === "text");
  const boxes = els.filter((e) => BOX_TYPES.has(e.type));
  const arrows = els.filter((e) => e.type === "arrow" || e.type === "line");
  const freedraw = els.filter((e) => e.type === "freedraw").length;

  const lines: string[] = [
    `Whiteboard UML sketch (${boxes.length} shapes, ${arrows.length} connectors${freedraw ? `, ${freedraw} freehand strokes` : ""}):`
  ];

  const boxLabels = new Map<string, string>();
  for (const b of boxes) {
    const label = labelOf(b.id, byId, texts);
    boxLabels.set(b.id, label);
    const kind = b.type === "diamond" ? "decision" : "class/component";
    lines.push(`- ${kind} "${label}"`);
  }

  const usedTextIds = new Set<string>();
  for (const b of boxes) {
    const t = texts.find((x) => x.containerId === b.id);
    if (t) usedTextIds.add(t.id);
  }

  for (const a of arrows) {
    const fromId = a.startBinding?.elementId;
    const toId = a.endBinding?.elementId;
    const from = fromId
      ? (boxLabels.get(fromId) ?? labelOf(fromId, byId, texts))
      : "(canvas)";
    const to = toId
      ? (boxLabels.get(toId) ?? labelOf(toId, byId, texts))
      : "(canvas)";
    const tag = texts.find((x) => x.containerId === a.id);
    if (tag) usedTextIds.add(tag.id);
    const tagText = tag?.text?.trim().replace(/\s+/g, " ");
    lines.push(`- ${from} -> ${to}${tagText ? ` : "${tagText}"` : ""}`);
  }

  // Standalone notes (error branches, state names, concurrency notes…)
  for (const t of texts) {
    if (usedTextIds.has(t.id) || t.containerId) continue;
    const body = t.text?.trim().replace(/\s+/g, " ");
    if (body) lines.push(`- Note: "${body}"`);
  }

  if (boxes.length === 0 && arrows.length === 0)
    lines.push("(No UML shapes detected — use rectangles for classes/components and arrows for flows.)");

  return lines.join("\n");
}

export interface SeedEntity {
  name: string;
  attributes?: string;
  methods?: string;
}

const SEED_W = 220;
const SEED_H = 132;
const SEED_GAP = 36;

/**
 * Turns entity cards into Excalidraw boxes (rectangle + bound label) so the
 * flow board starts from the Stage-1 model instead of a blank canvas.
 * Deterministic ids keep restores stable; caller decides light/dark strokes.
 */
export function seedEntityBoxes(
  entities: SeedEntity[],
  dark: boolean
): object[] {
  const stroke = dark ? "#ffffff" : "#1e1e1e";
  const out: Record<string, unknown>[] = [];
  entities
    .map((e) => e.name.trim())
    .filter(Boolean)
    .slice(0, 12)
    .forEach((name, i) => {
      const boxId = `seed-box-${i}`;
      const textId = `seed-text-${i}`;
      const y = 24 + i * (SEED_H + SEED_GAP);
      out.push({
        id: boxId,
        type: "rectangle",
        x: 40,
        y,
        width: SEED_W,
        height: SEED_H,
        angle: 0,
        strokeColor: stroke,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 2,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: { type: 3 },
        boundElements: [{ id: textId, type: "text" }],
        link: null,
        locked: false
      });
      out.push({
        id: textId,
        type: "text",
        x: 48,
        y: y + 16,
        width: SEED_W - 16,
        height: 40,
        angle: 0,
        strokeColor: stroke,
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 1,
        strokeStyle: "solid",
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        roundness: null,
        boundElements: [],
        link: null,
        locked: false,
        fontSize: 20,
        fontFamily: 1,
        text: name,
        rawText: name,
        textAlign: "center",
        verticalAlign: "top",
        containerId: boxId,
        originalText: name,
        lineHeight: 1.25
      });
    });
  return out;
}
