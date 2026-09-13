"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  readAttemptForSlug,
  readAttemptIndexRaw,
  subscribeAttemptIndex,
  type AttemptRef
} from "@/lib/attemptIndex";

/**
 * Per-problem entry action: Resume an in-progress attempt, Review a finished
 * one, or Start fresh. Prefers the server record (cross-device) for accounts,
 * else the guest browser index.
 */
export default function AttemptAction({
  slug,
  timerMin,
  serverAttempt,
  size = "md",
  hideWhenFresh = false
}: {
  slug: string;
  timerMin: number;
  serverAttempt: AttemptRef | null;
  size?: "sm" | "md";
  /** Render nothing when there is no prior attempt (e.g. detail page owns Start). */
  hideWhenFresh?: boolean;
}) {
  // Hydration-safe: server and first client paint both see the empty index
  // (Start); the stored entry resolves silently right after hydration.
  const rawIndex = useSyncExternalStore(
    subscribeAttemptIndex,
    readAttemptIndexRaw,
    () => "[]"
  );
  const local = readAttemptForSlug(slug, rawIndex);

  const inProgress =
    serverAttempt?.status !== "finished" && serverAttempt
      ? serverAttempt
      : local?.status !== "finished"
        ? local
        : null;
  const finished =
    !inProgress &&
    (serverAttempt?.status === "finished" ? serverAttempt : local);

  const btn =
    size === "sm" ? "px-2 py-1 text-xs" : "px-4 py-1.5 text-sm font-semibold";

  if (inProgress)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Paused earlier?
        </span>
        <Link
          href={`/practice/${slug}?attempt=${inProgress.id}&t=${timerMin}`}
          className={`rounded-md bg-indigo-600 text-white hover:bg-indigo-500 ${btn}`}
        >
          Resume
        </Link>
        <Link
          href={`/practice/${slug}?t=${timerMin}`}
          className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400"
        >
          start fresh
        </Link>
      </span>
    );

  if (finished)
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Attempted before?
        </span>
        <Link
          href={`/report/${finished.id}`}
          className={`rounded-md border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ${btn}`}
        >
          Review score
        </Link>
        <Link
          href={`/practice/${slug}?t=${timerMin}`}
          className="text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400"
        >
          retake
        </Link>
      </span>
    );

  if (hideWhenFresh) return null;

  return (
    <Link
      href={`/practice/${slug}?t=${timerMin}`}
      className={`rounded-md bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 ${btn}`}
    >
      Start
    </Link>
  );
}
