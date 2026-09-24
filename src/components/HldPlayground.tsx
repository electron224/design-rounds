"use client";

import { useState } from "react";
import { clampRps, estimateCapacity, shardStatus } from "@/lib/hld";

export interface PlaygroundValue {
  rps: number;
  cacheHit: number;
  shards: number;
}

/**
 * Capacity sliders. Works uncontrolled (standalone, defaults) or controlled
 * (parent passes value+onChange, e.g. HldLearn to sync flow + numbers).
 */
export default function HldPlayground({
  defaultRps = 5000,
  value,
  onChange,
}: {
  defaultRps?: number;
  value?: PlaygroundValue;
  onChange?: (patch: Partial<PlaygroundValue>) => void;
}) {
  const [local, setLocal] = useState<PlaygroundValue>(() => ({
    rps: clampRps(defaultRps),
    cacheHit: 0.8,
    shards: 4,
  }));
  const v: PlaygroundValue = {
    rps: value?.rps ?? local.rps,
    cacheHit: value?.cacheHit ?? local.cacheHit,
    shards: value?.shards ?? local.shards,
  };
  const set = (patch: Partial<PlaygroundValue>) => {
    onChange?.(patch);
    setLocal((l) => ({ ...l, ...patch }));
  };

  const out = estimateCapacity({ ...v, readRatio: 0.9 });
  const perShard = out.dbRps / v.shards;
  const status = shardStatus(perShard);
  // Bar scale: DB load bar relative to 50k, per-shard relative to 10k.
  const dbPct = Math.min(100, (out.dbRps / 50000) * 100);
  const shardPct = Math.min(100, (perShard / 10000) * 100);

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm">
          Traffic: <strong data-testid="rps-label">{v.rps.toLocaleString()} rps</strong>
          <input
            type="range"
            aria-label="Traffic in requests per second"
            min={100}
            max={100000}
            step={100}
            value={v.rps}
            onChange={(e) => set({ rps: Number(e.target.value) })}
            className="mt-1 w-full accent-indigo-600"
          />
        </label>
        <label className="text-sm">
          Cache hit: <strong data-testid="hit-label">{Math.round(v.cacheHit * 100)}%</strong>
          <input
            type="range"
            aria-label="Cache hit rate"
            min={0}
            max={0.95}
            step={0.05}
            value={v.cacheHit}
            onChange={(e) => set({ cacheHit: Number(e.target.value) })}
            className="mt-1 w-full accent-indigo-600"
          />
        </label>
        <label className="text-sm">
          DB shards: <strong data-testid="shards-label">{v.shards}</strong>
          <input
            type="range"
            aria-label="Database shard count"
            min={1}
            max={32}
            step={1}
            value={v.shards}
            onChange={(e) => set({ shards: Number(e.target.value) })}
            className="mt-1 w-full accent-indigo-600"
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-md bg-zinc-100 p-2 dark:bg-zinc-800">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>DB load</span>
            <span
              data-testid="shard-status"
              className={`rounded px-1.5 py-0.5 font-bold ${
                status === "hot"
                  ? "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200"
                  : status === "warm"
                    ? "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                    : "bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200"
              }`}
            >
              {status}
            </span>
          </div>
          <div data-testid="db-load" className="font-mono text-lg font-bold">
            {Math.round(out.dbRps).toLocaleString()} rps
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-300 dark:bg-zinc-700">
            <div
              data-testid="db-bar"
              className={`h-full transition-all ${status === "hot" ? "bg-red-500" : status === "warm" ? "bg-amber-500" : "bg-green-500"}`}
              style={{ width: `${Math.max(2, dbPct)}%` }}
            />
          </div>
        </div>
        <div className="rounded-md bg-zinc-100 p-2 dark:bg-zinc-800">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Per shard</div>
          <div data-testid="per-shard" className="font-mono text-lg font-bold">
            {Math.round(perShard).toLocaleString()} rps
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-300 dark:bg-zinc-700">
            <div
              className="h-full bg-indigo-500 transition-all"
              style={{ width: `${Math.max(2, shardPct)}%` }}
            />
          </div>
        </div>
        <div className="rounded-md bg-zinc-100 p-2 dark:bg-zinc-800">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Storage / day</div>
          <div data-testid="storage" className="font-mono text-lg font-bold">
            {out.storagePerDayGB.toFixed(1)} GB
          </div>
          <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            writes only — cache never stores, it shields
          </div>
        </div>
      </div>

      {status === "hot" && (
        <p data-testid="hot-warning" className="mt-2 rounded-md bg-red-50 p-2 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
          Bottleneck: each shard takes {Math.round(perShard).toLocaleString()} rps —
          add shards or push cache-hit higher and watch this clear live.
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Reads 90% / writes 10% · DB = reads×(1−hit) + writes. The packet flow
        above reacts to these sliders in real time.
      </p>
    </div>
  );
}
