"use client";
import { useEffect, useRef, useState } from "react";

export default function Timer({
  minutes,
  initialLeft,
  onExpire,
  onTick
}: {
  minutes: number;
  /** Seconds remaining from a previous visit — resumes instead of restarting. */
  initialLeft?: number;
  onExpire: () => void;
  onTick?: (secLeft: number, elapsed: number) => void;
}) {
  const total = minutes * 60;
  const [left, setLeft] = useState(() =>
    Math.min(
      total,
      Math.max(0, initialLeft ?? total)
    )
  );
  const [paused, setPaused] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const expired = useRef(false);
  const seenTick = useRef(false);
  const cbRef = useRef({ onExpire, onTick, total });
  useEffect(() => {
    cbRef.current = { onExpire, onTick, total };
  });

  // Leaving the tab pauses the clock — coming back resumes where it stopped.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setPaused(true);
        setAutoPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      seenTick.current = true;
      // Updater must stay pure — parent callbacks fire from the effect below.
      setLeft((l) => Math.max(0, l - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  // Notify parent (elapsed time / expiry) as an effect, never during render
  // or inside another component's state updater. A resume that opens at 0
  // shows "time up" without re-submitting — only real tick-down expires.
  useEffect(() => {
    const { onTick, onExpire, total } = cbRef.current;
    onTick?.(left, total - left);
    if (left === 0 && seenTick.current && !expired.current) {
      expired.current = true;
      onExpire();
    }
  }, [left]);

  const m = Math.floor(left / 60);
  const s = left % 60;
  const urgent = left < 300;

  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${urgent ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950" : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"}`}
    >
      <span className="font-mono text-lg font-bold">
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
      <button
        onClick={() => {
          setPaused((p) => !p);
          setAutoPaused(false);
        }}
        className="rounded border px-2 py-0.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {paused ? "Resume" : "Pause"}
      </button>
      {autoPaused && paused && left > 0 && (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Auto-paused while you were away
        </span>
      )}
      {left === 0 && (
        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
          Time up — auto-submitted (overtime flagged)
        </span>
      )}
    </div>
  );
}
