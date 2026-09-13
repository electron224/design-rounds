"use client";
import { sanitizeStageFeedback } from "@/lib/safeFeedback";
import type { StageFeedback } from "@/lib/types";

export default function FeedbackPanel({
  feedback
}: {
  feedback: StageFeedback | null;
}) {
  // Final net: whatever shape arrives (fresh or restored history), only
  // render-safe strings reach the JSX below.
  const safe = feedback ? sanitizeStageFeedback(feedback) : null;
  if (!safe)
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-zinc-500 dark:text-zinc-400">
        Submit a stage to get feedback: strengths, issues, pattern/SOLID gaps,
        “can it be optimized?”, and resource links.
      </div>
    );
  return (
    <div className="space-y-3 rounded-md border bg-white p-4 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Feedback</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          via{" "}
          {safe.provider === "llm"
            ? (safe.engine ?? "LLM")
            : "static rubric"}
        </span>
      </div>
      {safe.llmError && (
        <p className="rounded bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          AI review failed ({safe.llmError}) — static rubric shown instead.
          Check your key/model in AI settings, then resubmit.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {Object.entries(safe.scores).map(([k, v]) => (
          <span
            key={k}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
          >
            {k}: <strong>{v}/5</strong>
          </span>
        ))}
      </div>
      <p className="rounded bg-indigo-50 p-2 text-sm dark:bg-indigo-950 dark:text-indigo-100">{safe.verdict}</p>
      {safe.strengths.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-green-700 dark:text-green-400">Strengths</h4>
          <ul className="list-disc pl-5 text-sm">
            {safe.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {safe.itemVerdicts.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Your items — right or wrong?</h4>
          <ul className="mt-1 space-y-1">
            {safe.itemVerdicts.map((it, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${it.verdict === "right" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" : it.verdict === "weak" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                >
                  {it.verdict === "right" ? "✓ right" : it.verdict === "weak" ? "! weak" : "? extra"}
                </span>
                <span>
                  <strong>{it.name}</strong>
                  {it.note && <span className="text-zinc-600 dark:text-zinc-400"> — {it.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {safe.issues.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">
            What to improve
          </h4>
          <ul className="space-y-2">
            {safe.issues.map((it, i) => (
              <li key={i} className="rounded border p-2 text-sm">
                <span
                  className={`mr-2 rounded px-1.5 py-0.5 text-xs ${it.severity === "critical" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : it.severity === "warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                >
                  {it.severity}
                </span>
                <strong>{it.what}</strong>
                <div className="text-zinc-600 dark:text-zinc-400">Why: {it.why}</div>
                <div className="text-zinc-800 dark:text-zinc-200">Fix: {it.fix}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {safe.optimizations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Can it be optimized?</h4>
          <ul className="list-disc pl-5 text-sm">
            {safe.optimizations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}
      {safe.patternSuggestions.length > 0 && (
        <p className="text-sm">
          <strong>Patterns to consider:</strong>{" "}
          {safe.patternSuggestions.join(", ")}
        </p>
      )}
      {safe.resources.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Learn next</h4>
          <ul className="list-disc pl-5 text-sm">
            {safe.resources.map((r, i) => (
              <li key={i}>
                <a
                  className="text-indigo-600 underline dark:text-indigo-400"
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.title}
                </a>{" "}
                — {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
