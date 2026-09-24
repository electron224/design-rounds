import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { problemBySlug } from "@/lib/problems";
import { hldBySlug } from "@/lib/hld";
import { buildReport } from "@/lib/report";

const STAGE_LABEL: Record<string, string> = {
  clarify: "0 · Clarify",
  objects: "1 · Entities",
  flow: "2 · Flow",
  code: "3 · Code",
  requirements: "0 · Requirements",
  capacity: "1 · Capacity",
  api: "2 · API",
  diagram: "3 · Diagram",
  deepdive: "4 · Deep-dive"
};

export default async function ReportPage({
  params
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const db = await getDb();
  const attempt = (await db.get(
    "SELECT * FROM attempts WHERE id = ?",
    attemptId
  )) as Record<string, unknown> | undefined;
  if (!attempt) notFound();
  if (attempt.userId) {
    const userId = await getUserId().catch(() => null);
    if (userId !== attempt.userId) notFound();
  }
  const problem = problemBySlug(attempt.problemSlug as string);
  const hld = problem ? null : hldBySlug(attempt.problemSlug as string);
  if (!problem && !hld) notFound();
  const title = problem?.title ?? hld!.title;
  const slug = problem?.slug ?? hld!.slug;
  const totalStages = hld ? 5 : 4;
  const continueHref = hld
    ? `/hld/${slug}?tab=solve`
    : `/practice/${slug}?attempt=${attemptId}&t=${attempt.timerMin}`;
  const nextHref = hld ? "/hld" : "/problems";

  const submissions = (await db.all(
    "SELECT stage, feedback, score, createdAt FROM submissions WHERE attemptId = ? ORDER BY createdAt ASC",
    attemptId
  )) as { stage: string; feedback: string; score: number; createdAt: string }[];
  let drafts: Record<string, unknown> | null = null;
  try {
    drafts = attempt.drafts ? JSON.parse(attempt.drafts as string) : null;
  } catch {
    drafts = null;
  }
  const report = buildReport(attemptId, slug, submissions, drafts, totalStages);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/progress" className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← My progress
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title} — final score</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Attempt {attempt.status === "finished" ? "finished" : "in progress"} ·{" "}
            {new Date(attempt.updatedAt as string).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={continueHref}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Keep practicing
          </Link>
          <Link
            href={nextHref}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Next problem
          </Link>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-zinc-900 p-6 text-white dark:border dark:border-zinc-800">
        {report.score10 === null ? (
          <p className="text-sm text-zinc-300">
            Nothing submitted yet — scores appear after your first stage submit.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <span className="font-mono text-5xl font-bold">{report.score10}</span>
            <span className="text-zinc-400">/ 10</span>
            <p className="max-w-md text-sm text-zinc-300">
              {report.score10 >= 8
                ? "Interview-ready on this one. Attack the twists or move up the track."
                : report.score10 >= 6
                  ? "Solid base — the focus areas below are your cheapest points."
                  : "Foundation first — rework the focus areas, then resubmit stages."}
            </p>
          </div>
        )}
        {report.stages.length > 0 && (
          <>
            <p className="mt-4 text-xs text-zinc-400">
              {report.stages.length} of {totalStages} stages submitted — unsubmitted stages score zero.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
            {report.stages.map((s) => (
              <span key={s.stage} className="rounded-full bg-zinc-800 px-3 py-1 text-xs">
                {STAGE_LABEL[s.stage] ?? s.stage}: <strong>{s.score.toFixed(1)}/5</strong>
              </span>
            ))}
            </div>
          </>
        )}
      </div>

      {report.weakestDimensions.length > 0 && (
        <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">Weakest dimensions</h2>
          <ul className="mt-1 space-y-1 text-sm">
            {report.weakestDimensions.map((d) => (
              <li key={d.name}>
                {d.name}: <strong>{d.avg}/5</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.focusAreas.length > 0 && (
        <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">Where to improve</h2>
          <ul className="mt-2 space-y-2">
            {report.focusAreas.map((it, i) => (
              <li key={i} className="rounded border p-2 text-sm dark:border-zinc-700">
                <span
                  className={`mr-2 rounded px-1.5 py-0.5 text-xs ${it.severity === "critical" ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : it.severity === "warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                >
                  {it.severity}
                </span>
                <strong>{it.what}</strong>
                <div className="text-zinc-600 dark:text-zinc-400">Why: {it.why}</div>
                <div>Fix: {it.fix}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.coherence && (
        <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
          <h2 className="font-semibold">Coherence snapshot</h2>
          {report.coherence.missingInFlow.length === 0 &&
          report.coherence.missingInCode.length === 0 &&
          report.coherence.unmodeledInCode.length === 0 ? (
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              One system across model, flow, and code at report time. ✓
            </p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {report.coherence.missingInFlow.map((e) => (
                <li key={`f-${e}`}>⚠ <strong>{e}</strong> modeled but absent from the flow.</li>
              ))}
              {report.coherence.missingInCode.map((e) => (
                <li key={`c-${e}`}>⚠ <strong>{e}</strong> modeled but missing from the code.</li>
              ))}
              {report.coherence.unmodeledInCode.map((e) => (
                <li key={`u-${e}`}>⚠ <strong>{e}</strong> coded but never modeled.</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
