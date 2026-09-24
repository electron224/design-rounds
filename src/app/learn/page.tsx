import Link from "next/link";
import { CONCEPTS } from "@/lib/concepts";
import { problemBySlug } from "@/lib/problems";
import { RESOURCES } from "@/lib/resources";
import StrategySim from "@/components/StrategySim";
import ObserverSim from "@/components/ObserverSim";
import StateSim from "@/components/StateSim";
import DecoratorSim from "@/components/DecoratorSim";

const GROUPS: Record<string, string> = {
  oops: "OOP",
  solid: "SOLID principles",
  pattern: "Design patterns",
  article: "UML / Diagramming",
  video: "Videos"
};

const SIMS: Record<string, () => React.JSX.Element> = {
  strategy: StrategySim,
  observer: ObserverSim,
  state: StateSim,
  decorator: DecoratorSim
};

export default function LearnPage() {
  const groups = Object.keys(GROUPS);
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Learn — play with the patterns first</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Each pattern below is a live simulation drawn from real problems in
        the track. Play, then read the design move — it&apos;s the same move
        the rubric grades.
      </p>

      <div className="mt-4 space-y-4">
        {CONCEPTS.map((c, i) => {
          const Sim = SIMS[c.id];
          return (
            <section
              key={c.id}
              className="rounded-md border bg-white p-4 dark:bg-zinc-900"
            >
              <div className="flex items-baseline gap-2">
                <span
                  aria-hidden
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold text-paper dark:bg-chalk dark:text-ink"
                >
                  {i + 1}
                </span>
                <h2 className="font-semibold">{c.title}</h2>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{c.idea}</p>
              <div className="mt-3 rounded-md border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
                <Sim />
              </div>
              <p className="mt-2 text-xs">
                <strong>Design move:</strong>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">{c.designMove}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Graded in:{" "}
                {c.problemSlugs.map((slug, j) => (
                  <span key={slug}>
                    {j > 0 && ", "}
                    <Link
                      href={`/problems/${slug}`}
                      className="text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {problemBySlug(slug)?.title ?? slug}
                    </Link>
                  </span>
                ))}
              </p>
            </section>
          );
        })}
      </div>

      <h2 className="mt-8 text-lg font-semibold">Deeper reading</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Curated links, surfaced contextually per problem and in every feedback
        panel.
      </p>
      {groups.map((g) => (
        <div key={g} className="mt-4">
          <h3 className="text-sm font-semibold">{GROUPS[g]}</h3>
          <ul className="mt-1 space-y-1">
            {RESOURCES.filter((r) => r.type === g).map((r) => (
              <li key={r.id} className="rounded-md border bg-white p-2 text-sm dark:bg-zinc-900">
                <a href={r.url} target="_blank" rel="noreferrer" className="text-indigo-600 underline dark:text-indigo-400">
                  {r.title}
                </a>
                <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{r.topic}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </main>
  );
}
