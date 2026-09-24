"use client";

import type { FlowStep } from "@/lib/hld";

export interface FlowPacket {
  id: number;
  /** Current hop index. */
  step: number;
  kind: "fly" | "hit" | "miss";
}

export interface FlowFlash {
  idx: number;
  kind: "hit" | "miss";
}

/**
 * Presentational request-flow diagram. Simulation state (packets, active hop)
 * is owned by the parent (`HldLearn`) so sliders and flow stay in sync.
 */
export default function HldFlow({
  steps,
  activeIdx,
  packets,
  flash,
  dbNote,
  onPick,
}: {
  steps: FlowStep[];
  activeIdx: number;
  packets: FlowPacket[];
  flash: FlowFlash | null;
  dbNote?: string;
  onPick: (i: number) => void;
}) {
  const pct = (step: number) => ((step + 0.5) / steps.length) * 100;

  return (
    <div>
      <ol className="flex items-stretch gap-1 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <li key={s.id} className="flex min-w-0 flex-1 items-stretch">
            <button
              onClick={() => onPick(i)}
              className={`w-full min-w-20 rounded-md border-2 px-1 py-2 text-center transition-colors ${
                flash && flash.idx === i
                  ? flash.kind === "hit"
                    ? "border-green-500 bg-green-50 dark:bg-green-950"
                    : "border-red-400 bg-red-50 dark:bg-red-950"
                  : i === activeIdx
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : i < activeIdx
                      ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950"
                      : "border-zinc-300 dark:border-zinc-700"
              }`}
            >
              <span className="block truncate text-xs font-bold">{s.label}</span>
              <span
                className={`mt-0.5 block text-[10px] ${
                  i === activeIdx
                    ? "text-white/80"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                hop {i + 1}
                {dbNote && s.id.toLowerCase().includes("db") ? ` · ${dbNote}` : ""}
              </span>
            </button>
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={`mx-0.5 self-center text-lg font-bold ${
                  i < activeIdx
                    ? "text-indigo-600"
                    : "text-zinc-300 dark:text-zinc-700"
                }`}
              >
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      {/* Packet lane — dots hop box to box via CSS transition. */}
      <div
        className="relative mt-1 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800"
        role="img"
        aria-label="Live request packets traveling through the flow"
      >
        {packets.length === 0 && (
          <span className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-400">
            paused — press Play to send traffic
          </span>
        )}
        {packets.map((p) => (
          <span
            key={p.id}
            title={p.kind === "hit" ? "cache hit" : p.kind === "miss" ? "cache miss" : "in flight"}
            className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-500 ease-linear ${
              p.kind === "hit"
                ? "bg-green-500"
                : p.kind === "miss"
                  ? "bg-red-400"
                  : "bg-[#c2402a]"
            }`}
            style={{ left: `${pct(Math.min(p.step, steps.length - 1))}%` }}
          />
        ))}
      </div>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        <strong className="text-zinc-900 dark:text-zinc-100">
          {activeIdx + 1}. {steps[activeIdx].label}:
        </strong>{" "}
        {steps[activeIdx].detail}
      </p>
    </div>
  );
}
