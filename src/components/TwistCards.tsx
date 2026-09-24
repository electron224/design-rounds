"use client";

import type { FollowUp } from "@/lib/types";

/** Interviewer twists as peek-at-hint cards. Presentational. */
export default function TwistCards({ twists }: { twists: FollowUp[] }) {
  return (
    <div className="mt-2 space-y-2">
      {twists.map((t, i) => (
        <details
          key={i}
          className="rounded-md border bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <summary className="cursor-pointer font-medium">
            Twist {i + 1}: {t.prompt}
          </summary>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            <strong>Hint:</strong> {t.hint}
          </p>
        </details>
      ))}
    </div>
  );
}
