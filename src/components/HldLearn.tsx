"use client";

import { useCallback, useEffect, useState } from "react";
import HldFlow, { type FlowPacket } from "./HldFlow";
import HldPlayground, { type PlaygroundValue } from "./HldPlayground";
import {
  cacheStepIndex,
  clampRps,
  estimateCapacity,
  type FlowStep,
  type HLDProblem,
} from "@/lib/hld";

const LOG_CAP = 6;

export function speedBucket(rps: number): number {
  if (rps >= 30000) return 400;
  if (rps >= 8000) return 550;
  return 750;
}

export function concurrency(rps: number): number {
  if (rps >= 30000) return 3;
  if (rps >= 8000) return 2;
  return 1;
}

export interface SimState {
  vals: PlaygroundValue;
  packets: FlowPacket[];
  log: string[];
  flash: { idx: number; kind: "hit" | "miss" } | null;
  seq: number;
}

/**
 * Pure single-tick transition — atomic, so batched ticks can never clobber
 * each other (each functional update builds on the previous result).
 * `roll` is drawn by the caller to keep this pure.
 */
export function nextSim(
  s: SimState,
  roll: number,
  steps: FlowStep[],
  branchIdx: number
): SimState {
  const last = steps.length - 1;
  const entries: string[] = [];
  let flash: SimState["flash"] = null;

  const moved: FlowPacket[] = [];
  for (const p of s.packets) {
    const step = p.step + 1;
    if (step === branchIdx && branchIdx >= 0 && p.kind === "fly") {
      if (roll < s.vals.cacheHit) {
        flash = { idx: branchIdx, kind: "hit" };
        entries.push(
          `HIT  req → ${steps[branchIdx].label} absorbs it (9ms) → 302 back`
        );
        continue; // short-circuit: never reaches the DB
      }
      flash = { idx: branchIdx, kind: "miss" };
      moved.push({ ...p, step, kind: "miss" });
      continue;
    }
    if (step > last) {
      const path = steps.map((x) => x.label).join(" → ");
      entries.push(
        `${p.kind === "miss" ? "MISS" : "REQ "} req → ${path} (38ms) → 302`
      );
      continue;
    }
    moved.push({ ...p, step });
  }

  let { seq, packets } = { seq: s.seq, packets: moved };
  if (packets.length < concurrency(s.vals.rps)) {
    packets = [{ id: seq, step: 0, kind: "fly" }, ...packets];
    seq += 1;
  }
  return {
    ...s,
    packets,
    seq,
    flash,
    log: [...s.log, ...entries].slice(-LOG_CAP),
  };
}

/**
 * Linked learn section: sliders drive the packet simulation (speed, volume,
 * cache hit/miss branching, shard load) and the numbers update together.
 */
export default function HldLearn({ problem }: { problem: HLDProblem }) {
  const steps = problem.flow;
  const branchIdx = cacheStepIndex(steps);
  const [sim, setSim] = useState<SimState>(() => ({
    vals: {
      rps: clampRps(problem.capacityWorked.rps * 10),
      cacheHit: 0.8,
      shards: 4,
    },
    packets: [],
    log: [],
    flash: null,
    seq: 1,
  }));
  const [playing, setPlaying] = useState(
    () =>
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function" ||
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const advance = useCallback(() => {
    const roll = Math.random();
    setSim((s) => nextSim(s, roll, steps, branchIdx));
  }, [steps, branchIdx]);

  const bucket = speedBucket(sim.vals.rps);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(advance, bucket);
    return () => clearInterval(t);
  }, [playing, bucket, advance]);

  const patch = (p: Partial<PlaygroundValue>) =>
    setSim((s) => ({ ...s, vals: { ...s.vals, ...p } }));

  const jumpTo = (i: number) =>
    setSim((s) => ({
      ...s,
      packets:
        s.packets.length > 0
          ? [{ ...s.packets[0], step: i }, ...s.packets.slice(1)]
          : [{ id: s.seq, step: i, kind: "fly" as const }],
      seq: s.packets.length > 0 ? s.seq : s.seq + 1,
    }));

  const activeIdx = sim.packets.reduce((m, p) => Math.max(m, p.step), 0);
  const out = estimateCapacity({ ...sim.vals, readRatio: 0.9 });
  const perShard = Math.round(out.dbRps / sim.vals.shards);

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white p-4 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Request flow — watch a request travel</h3>
          <div className="flex gap-2 text-sm">
            <button
              data-testid="flow-play"
              onClick={() => setPlaying((p) => !p)}
              className="rounded-md border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {playing ? "Pause" : "Play"}
            </button>
            <button
              data-testid="flow-step"
              onClick={advance}
              className="rounded-md border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Step →
            </button>
          </div>
        </div>
        <div className="mt-3">
          <HldFlow
            steps={steps}
            activeIdx={activeIdx}
            packets={sim.packets}
            flash={sim.flash}
            dbNote={`×${sim.vals.shards} · ${perShard.toLocaleString()} rps each`}
            onPick={jumpTo}
          />
        </div>
        <ol
          data-testid="flow-log"
          aria-live="polite"
          className="mt-3 space-y-1 rounded-md bg-zinc-950 p-2 font-mono text-[11px] leading-5 text-zinc-200 dark:bg-black"
        >
          {sim.log.length === 0 && (
            <li className="text-zinc-500">
              {sim.packets.length > 0
                ? "request in flight…"
                : playing
                  ? "sending traffic…"
                  : "paused — press Play or Step →"}
            </li>
          )}
          {sim.log.map((e, i) => (
            <li
              key={`${i}-${e}`}
              className={i === sim.log.length - 1 ? "text-green-300" : "text-zinc-400"}
            >
              {e}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-md border bg-white p-4 dark:bg-zinc-900">
        <h3 className="font-semibold">Capacity playground — move the sliders</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Packet speed, cache hits, and shard load above follow these live.
        </p>
        <div className="mt-2">
          <HldPlayground value={sim.vals} onChange={patch} />
        </div>
      </div>
    </div>
  );
}
