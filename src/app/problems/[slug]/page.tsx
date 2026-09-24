import Link from "next/link";
import { notFound } from "next/navigation";
import AttemptAction from "@/components/AttemptAction";
import TimerConfig from "@/components/TimerConfig";
import TwistCards from "@/components/TwistCards";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { problemBySlug, trackNeighbors } from "@/lib/problems";
import { resourceById } from "@/lib/resources";

export default async function ProblemDetail({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = problemBySlug(slug);
  if (!p) notFound();
  const { prev, next, index, total } = trackNeighbors(slug);
  let serverAttempt: { id: string; status: string } | null = null;
  const detailUser = await getSessionUser().catch(() => null);
  if (detailUser) {
    try {
      const db = await getDb();
      const row = (await db.get(
        "SELECT id, status FROM attempts WHERE userId = ? AND problemSlug = ? ORDER BY updatedAt DESC LIMIT 1",
        detailUser.id,
        slug
      )) as { id: string; status: string } | undefined;
      if (row) serverAttempt = row;
    } catch {
      /* DB unavailable — timer covers Start */
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/problems" className="text-sm text-indigo-600 hover:underline">
        ← All problems
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{p.title}</h1>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{p.difficulty}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Step {index + 1} of {total} in the {p.track} track
      </p>
      <nav aria-label="Track neighbors" className="mt-1 flex gap-4 text-sm">
        {prev && (
          <Link href={`/problems/${prev.slug}`} className="text-indigo-600 hover:underline dark:text-indigo-400">← {prev.title}</Link>
        )}
        {next && (
          <Link href={`/problems/${next.slug}`} className="text-indigo-600 hover:underline dark:text-indigo-400">{next.title} →</Link>
        )}
      </nav>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{p.summary}</p>

      <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
        <h2 className="font-semibold">Functional requirements</h2>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {p.functionalRequirements.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <h3 className="mt-3 text-sm font-semibold">Non-goals (HLD / out of scope)</h3>
        <ul className="list-disc pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          {p.nonGoals.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Constraints: {p.constraints.join(" · ")} · Patterns: {p.patterns.join(", ")} ·
          SOLID focus: {p.solidFocus.join(" · ")}
        </p>
      </div>

      <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
        <h2 className="font-semibold">Ask first — strong candidates open with these</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Stage 0 is graded on questions that would change the design. Read
          each one, guess <em>why</em> it matters, then expand.
        </p>
        <div className="mt-2 space-y-2">
          {p.expectedQuestions.map((q) => (
            <details key={q.question} className="rounded-md border p-2 text-sm dark:border-zinc-700">
              <summary className="cursor-pointer font-medium">{q.question}</summary>
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                <strong>Why it matters:</strong> {q.why}
              </p>
            </details>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
        <h2 className="font-semibold">Start practice — configure timer</h2>
        <div className="mt-2">
          <AttemptAction
            slug={p.slug}
            timerMin={p.timeDefaultMin}
            serverAttempt={serverAttempt}
            hideWhenFresh
          />
        </div>
        <TimerConfig slug={p.slug} defaultMin={p.timeDefaultMin} />
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Type any duration (1–240 min) or pick a quick preset. It can also be
          passed as <code>?t=50</code> in the practice URL.
        </p>
      </div>

      <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
        <h2 className="font-semibold">How a strong answer thinks — revealed after you submit</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Peek if you must, but these land 10× harder after your own attempt.
          The practice room shows them stage by stage.
        </p>
        <ol className="mt-2 space-y-1 text-sm">
          {p.decisions.map((d, i) => (
            <li key={i} className="flex gap-2">
              <span
                aria-hidden
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-bold text-paper dark:bg-chalk dark:text-ink"
              >
                {i + 1}
              </span>
              <span>{d}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-4">
        <h2 className="font-semibold">Interviewer twists — requirements change mid-round</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          The follow-ups interviewers actually ask next. Attempt them against
          your design before peeking at the hint.
        </p>
        <TwistCards twists={p.followUps} />
      </div>

      <div className="mt-4 rounded-md border bg-white p-4 dark:bg-zinc-900">
        <h2 className="font-semibold">Recommended learning for this problem</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {p.resources.map((r, i) => {
            const full = resourceById(r.resourceId);
            if (!full) return null;
            return (
              <li key={i}>
                <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{r.stage}</span>
                <a href={full.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline dark:text-indigo-400">
                  {full.title}
                </a>
                <span className="text-zinc-600 dark:text-zinc-400"> — {r.reason}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
