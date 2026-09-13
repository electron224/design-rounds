"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PRESETS = [15, 30, 45, 60];

export default function TimerConfig({
  slug,
  defaultMin
}: {
  slug: string;
  defaultMin: number;
}) {
  const [mins, setMins] = useState<number>(defaultMin);
  const router = useRouter();

  const start = () => {
    const n = Math.min(240, Math.max(1, Math.round(Number(mins) || defaultMin)));
    router.push(`/practice/${slug}?t=${n}`);
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="timer-mins" className="text-sm">
          Minutes (1–240):
        </label>
        <input
          id="timer-mins"
          type="number"
          min={1}
          max={240}
          value={mins}
          onChange={(e) => setMins(Number(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && start()}
          className="w-24 rounded border bg-white px-2 py-1 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <button
          onClick={start}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
        >
            Start practice
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">Quick:</span>
        {PRESETS.map((m) => (
          <button
            key={m}
            onClick={() => setMins(m)}
            className={`rounded-full border px-2.5 py-0.5 ${mins === m ? "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-300" : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}
          >
            {m}m
          </button>
        ))}
        <span className="ml-1 text-zinc-400 dark:text-zinc-500">
          (default for this problem: {defaultMin}m)
        </span>
      </div>
    </div>
  );
}
