"use client";

import { useState } from "react";

type Seat = "FREE" | "HELD" | "BOOKED";

const TRANSITIONS: Record<Seat, { to: Seat; label: string }[]> = {
  FREE: [{ to: "HELD", label: "hold (10 min TTL)" }],
  HELD: [
    { to: "BOOKED", label: "confirm payment" },
    { to: "FREE", label: "expire / cancel" },
  ],
  BOOKED: [{ to: "FREE", label: "cancel → refund" }],
};

/** State: only legal transitions are clickable — behavior follows status. */
export default function StateSim() {
  const [state, setState] = useState<Seat>("FREE");
  const [trail, setTrail] = useState<Seat[]>(["FREE"]);
  const go = (to: Seat, label: string) => {
    setState(to);
    setTrail((t) => [...t, to]);
    void label;
  };
  const reset = () => {
    setState("FREE");
    setTrail(["FREE"]);
  };

  return (
    <div>
      <div className="flex items-center gap-1">
        {(["FREE", "HELD", "BOOKED"] as Seat[]).map((s) => (
          <span key={s} className="flex flex-1 items-center gap-1">
            <span
              data-testid={`state-${s}`}
              className={`flex-1 rounded-md border-2 px-1 py-2 text-center text-xs font-bold transition-colors ${
                s === state
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : trail.includes(s)
                    ? "border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950"
                    : "border-zinc-300 text-zinc-400 dark:border-zinc-700"
              }`}
            >
              {s}
            </span>
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {TRANSITIONS[state].map((t) => (
          <button
            key={t.to + t.label}
            onClick={() => go(t.to, t.label)}
            className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            {t.label} →
          </button>
        ))}
        <button
          onClick={reset}
          className="rounded-md border px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Reset
        </button>
      </div>
      <p data-testid="state-trail" className="mt-2 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        trail: {trail.join(" → ")}
      </p>
      <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        no if-ladder · expiry is a transition, cancel is a refund transition
      </p>
    </div>
  );
}
