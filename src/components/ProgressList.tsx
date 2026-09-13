"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { problemBySlug } from "@/lib/problems";

interface AttemptRow {
  id: string;
  problemSlug: string;
  timerMin: number;
  status: string;
  stages: number;
  avgScore: number | null;
  updatedAt: string;
}

function guestIndex(): { id: string; slug: string }[] {
  try {
    return JSON.parse(
      window.localStorage.getItem("lld_attempt_index") ?? "[]"
    );
  } catch {
    return [];
  }
}

/** Progress: server attempts for accounts, localStorage index for guests. */
export default function ProgressList({ loggedIn }: { loggedIn: boolean }) {
  const [rows, setRows] = useState<AttemptRow[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const mine = loggedIn
          ? await fetch("/api/attempts?mine=1").then((r) => r.json())
          : { attempts: [] };
        const guestIds = guestIndex().map((e) => e.id);
        const guests = guestIds.length
          ? await fetch(`/api/attempts?ids=${guestIds.join(",")}`).then((r) =>
              r.json()
            )
          : { attempts: [] };
        const seen = new Set<string>();
        const merged: AttemptRow[] = [
          ...(mine.attempts ?? []),
          ...(guests.attempts ?? [])
        ].filter((a: AttemptRow) => (seen.has(a.id) ? false : (seen.add(a.id), true)));
        setRows(merged);
      } catch {
        setRows([]);
      }
    })();
  }, [loggedIn]);

  if (rows === null)
    return <p className="mt-4 text-sm text-zinc-500">Loading your attempts…</p>;
  if (rows.length === 0)
    return (
      <div className="mt-4 rounded-md border border-dashed p-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        No attempts yet.{" "}
        <Link href="/problems" className="text-indigo-600 underline dark:text-indigo-400">
          Pick a problem and start
        </Link>{" "}
        — pausing mid-way is fine, everything autosaves.
      </div>
    );

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {rows.map((a) => {
        const p = problemBySlug(a.problemSlug);
        return (
          <div key={a.id} className="rounded-md border bg-white p-4 dark:bg-zinc-900">
            <div className="font-semibold">{p?.title ?? a.problemSlug}</div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {a.status === "finished" ? "Finished" : "In progress"} ·{" "}
              {a.stages} stage{a.stages === 1 ? "" : "s"} submitted
              {a.avgScore != null && (
                <> · avg <strong>{a.avgScore.toFixed(1)}/5</strong></>
              )}{" "}
              · {new Date(a.updatedAt).toLocaleDateString()}
            </p>
            <div className="mt-2 flex gap-2 text-sm">
              <Link
                href={`/practice/${a.problemSlug}?attempt=${a.id}&t=${a.timerMin}`}
                className="rounded border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Continue
              </Link>
              <Link
                href={`/report/${a.id}`}
                className="rounded border px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Score
              </Link>
              <Link
                href={`/practice/${a.problemSlug}?t=${a.timerMin}`}
                className="rounded border px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Start fresh
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
