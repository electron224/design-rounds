"use client";

import { useState } from "react";

const PROMOS = [
  { id: "student", label: "Student −10%", apply: (p: number) => p * 0.9 },
  { id: "coupon", label: "Coupon −₹20", apply: (p: number) => Math.max(0, p - 20) },
  { id: "surge", label: "Surge +25%", apply: (p: number) => p * 1.25 },
] as const;

const BASE = 200;

/** Decorator: promos wrap the fare — the pricer is never edited. */
export default function DecoratorSim() {
  const [on, setOn] = useState<string[]>(["student"]);
  const toggle = (id: string) =>
    setOn((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const active = PROMOS.filter((p) => on.includes(p.id));
  const total = active.reduce((p, x) => x.apply(p), BASE);

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {PROMOS.map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            aria-pressed={on.includes(p.id)}
            className={`rounded-md border-2 px-2 py-1 text-xs font-semibold ${
              on.includes(p.id)
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div data-testid="deco-stack" className="mt-2 rounded-md bg-zinc-100 p-2 font-mono text-[11px] dark:bg-zinc-800">
        Pricer
        {active.map((p) => (
          <span key={p.id}> → <span className="rounded bg-indigo-200 px-1 dark:bg-indigo-800">{p.label}</span></span>
        ))}
        {active.length === 0 && <span className="text-zinc-400"> (no wrappers)</span>}
      </div>
      <div className="mt-2 rounded-md bg-zinc-100 p-2 text-center dark:bg-zinc-800">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">₹{BASE} base →</span>{" "}
        <strong data-testid="deco-total" className="font-mono text-xl">
          ₹{total.toFixed(0)}
        </strong>
      </div>
      <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
        same interface in/out · order of wrapping changes the total — try it
      </p>
    </div>
  );
}
