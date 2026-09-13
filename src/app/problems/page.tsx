import Link from "next/link";
import AttemptAction from "@/components/AttemptAction";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PROBLEMS, trackGroups } from "@/lib/problems";

const TRACK_BLURB: Record<string, string> = {
  starter: "Do these first, in order — core OOP + one pattern each.",
  core: "The interview mainstream — state machines, concurrency, ledgers.",
  stretch: "Hard rounds and differentiators — attempt after the core."
};

export default async function ProblemsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; difficulty?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").toLowerCase();
  const diff = sp.difficulty ?? "All";
  const list = PROBLEMS.filter(
    (p) =>
      (diff === "All" || p.difficulty === diff) &&
      (!q ||
        p.title.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q)) ||
        p.patterns.some((t) => t.toLowerCase().includes(q)))
  );
  // Latest attempt per problem for signed-in users (guests resolve locally).
  const serverMap = new Map<string, { id: string; status: string }>();
  const user = await getSessionUser().catch(() => null);
  if (user) {
    try {
      const db = await getDb();
      const rows = (await db.all(
        "SELECT id, problemSlug, status FROM attempts WHERE userId = ? ORDER BY updatedAt DESC",
        user.id
      )) as { id: string; problemSlug: string; status: string }[];
      for (const r of rows)
        if (!serverMap.has(r.problemSlug))
          serverMap.set(r.problemSlug, { id: r.id, status: r.status });
    } catch {
      /* DB unavailable — cards fall back to Start */
    }
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">LLD Problems</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Functional requirements first — then clarify, entities, flow, code.
        Follow the thread in order, or filter the full set below.
      </p>
      <h2 className="mt-6 text-lg font-semibold">Start here — the beginner track</h2>
      {trackGroups().map(({ track, problems }) => (
        <div key={track} className="mt-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <strong className="font-semibold capitalize text-zinc-900 dark:text-zinc-100">{track}</strong>
            {" — "}{TRACK_BLURB[track]}
          </p>
          <ol className="mt-2 space-y-0 border-l-2 border-zinc-300 pl-0 dark:border-zinc-700">
            {problems.map((p) => (
              <li key={p.slug} className="relative py-2 pl-8">
                <span
                  aria-hidden
                  className="absolute left-[-13px] top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold text-paper dark:bg-chalk dark:text-ink"
                >
                  {p.order}
                </span>
                <Link
                  href={`/problems/${p.slug}`}
                  className="block rounded-md border bg-white p-3 hover:border-blueprint dark:bg-zinc-900"
                >
                  <span className="block text-sm font-semibold">{p.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {p.difficulty}, about {p.timeDefaultMin} minutes
                  </span>
                  <span className="mt-1 block font-mono text-[11px] text-blueprint dark:text-[#9db4f0]">
                    {p.patterns.join(", ")}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <h2 className="mt-8 font-semibold">All problems</h2>
      <form className="mt-4 flex gap-2" method="GET">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search title, tag, pattern…"
          className="w-full rounded-md border bg-white px-3 py-1.5 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <select
          name="difficulty"
          defaultValue={diff}
          className="rounded-md border bg-white px-2 py-1.5 text-sm text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {["All", "Easy", "Medium", "Hard"].map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <button className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
          Filter
        </button>
      </form>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {list.map((p) => (
          <div
            key={p.slug}
            className="rounded-md border bg-white p-4 hover:border-indigo-400 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{p.difficulty}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">About {p.timeDefaultMin} min</span>
            </div>
            <Link href={`/problems/${p.slug}`} className="mt-1 block font-semibold hover:text-indigo-600">{p.title}</Link>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">{p.summary}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {p.patterns.map((t) => (
                <span key={t} className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">{t}</span>
              ))}
            </div>
            <div className="mt-3">
              <AttemptAction
                slug={p.slug}
                timerMin={p.timeDefaultMin}
                serverAttempt={serverMap.get(p.slug) ?? null}
                size="sm"
              />
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">No matches.</p>}
    </main>
  );
}
