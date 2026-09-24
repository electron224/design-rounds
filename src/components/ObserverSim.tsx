"use client";

import { useState } from "react";

const EVENTS = [
  { id: "a-up", label: "Answer ↑", delta: 10 },
  { id: "q-up", label: "Question ↑", delta: 5 },
  { id: "down", label: "Downvote", delta: -2 },
] as const;

/** Observer: one vote event, reputation reacts on its own. */
export default function ObserverSim() {
  const [rep, setRep] = useState(15);
  const [log, setLog] = useState<string[]>([]);
  const fire = (label: string, delta: number) => {
    setRep((r) => Math.max(1, r + delta));
    setLog((l) => [`${label} ${delta > 0 ? "+" : ""}${delta} → ReputationService, BadgeCheck notified`, ...l].slice(0, 4));
  };
  const pct = Math.min(100, (rep / 200) * 100);

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {EVENTS.map((e) => (
          <button
            key={e.id}
            onClick={() => fire(e.label, e.delta)}
            className="rounded-md border px-2 py-1 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {e.label} ({e.delta > 0 ? `+${e.delta}` : e.delta})
          </button>
        ))}
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>Reputation</span>
          <strong data-testid="obs-rep" className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{rep}</strong>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-700">
          <div
            data-testid="obs-bar"
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      </div>
      <ol data-testid="obs-log" className="mt-2 space-y-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        {log.length === 0 && <li>cast a vote — watch subscribers react…</li>}
        {log.map((e, i) => (
          <li key={i} className={i === 0 ? "text-green-700 dark:text-green-400" : ""}>{e}</li>
        ))}
      </ol>
      <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        Vote store never edited · badges subscribe without touching voting
      </p>
    </div>
  );
}
