"use client";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSystemTheme } from "@/lib/useSystemTheme";
import { normalizeSceneForTheme, seedEntityBoxes, type SeedEntity } from "@/lib/scene";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((m) => m.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center text-sm text-zinc-500">
        Loading whiteboard…
      </div>
    )
  }
);

/**
 * Freehand UML whiteboard (Excalidraw). Every stroke/shape is lifted to the
 * parent via onChange; the parent-owned scene is fed back as initialData so
 * toggling between stages/modes never loses the drawing.
 */
export default function Whiteboard({
  initialScene,
  seeds,
  onChange
}: {
  initialScene: readonly object[];
  /** Entity cards from Stage 1 — become starter boxes on a blank board. */
  seeds: SeedEntity[];
  onChange: (elements: readonly object[]) => void;
}) {
  const dark = useSystemTheme();
  // Frozen at mount: a saved drawing always wins; seeds only fill a blank
  // board (theme remounts re-normalize the same frozen base, never redraw).
  const [initial] = useState(() => ({
    scene: initialScene,
    seedBoxes: seedEntityBoxes(seeds, dark)
  }));
  const normalized = useMemo(
    () =>
      normalizeSceneForTheme(
        initial.scene.length > 0 ? initial.scene : initial.seedBoxes,
        dark
      ),
    [initial, dark]
  );
  return (
    <div>
      <p className="mb-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Tip: your entity cards start as boxes — connect them with arrows
        (double-click an arrow to label it). Label error branches
        (full / invalid / expire) too.
      </p>
      <div className="h-[600px] overflow-hidden rounded-md border bg-white dark:border-zinc-700">
        <Excalidraw
          key={dark ? "dark" : "light"}
          theme={dark ? "dark" : "light"}
          initialData={{
            elements: normalized as never,
            appState: {
              viewBackgroundColor: dark ? "#18181b" : "#ffffff",
              currentItemStrokeColor: dark ? "#ffffff" : "#1e1e1e"
            }
          }}
          onChange={(elements) => onChange(elements)}
        />
      </div>
    </div>
  );
}
