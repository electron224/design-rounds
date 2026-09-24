"use client";

import { useState } from "react";

const STRATEGIES = [
  { id: "flat", label: "Flat", desc: "₹50 + ₹0.5/min", calc: (m: number) => 50 + m * 0.5 },
  { id: "hourly", label: "Hourly", desc: "₹20 / hour started", calc: (m: number) => 20 * Math.max(1, Math.ceil(m / 60)) },
  { id: "weekend", label: "Weekend", desc: "2× flat", calc: (m: number) => 2 * (50 + m * 0.5) },
] as const;

/** Strategy: swap pricing live — ParkingLot code never changes. */
export default function StrategySim() {
  const [active, setActive] = useState<string>("flat");
  const [mins, setMins] = useState(90);
  const s = STRATEGIES.find((x) => x.id === active)!;

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {STRATEGIES.map((x) => (
          <button
            key={x.id}
            onClick={() => setActive(x.id)}
            title={x.desc}
            className={`rounded-md border-2 px-2 py-1 text-xs font-semibold ${
              x.id === active
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <label className="mt-2 block text-sm">
        Parked: <strong data-testid="strat-mins">{mins} min</strong>
        <input
          type="range"
          aria-label="Minutes parked"
          min={10}
          max={600}
          step={10}
          value={mins}
          onChange={(e) => setMins(Number(e.target.value))}
          className="mt-1 w-full accent-indigo-600"
        />
      </label>
      <div className="mt-2 rounded-md bg-zinc-100 p-2 text-center dark:bg-zinc-800">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {s.label} ({s.desc}) →
        </span>{" "}
        <strong data-testid="strat-total" className="font-mono text-xl">
          ₹{s.calc(mins).toFixed(0)}
        </strong>
      </div>
      <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        lot.allocate() untouched · Weekend pricing = 1 new class, 0 edits
      </p>
    </div>
  );
}
