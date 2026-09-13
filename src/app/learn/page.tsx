import { RESOURCES } from "@/lib/resources";

const GROUPS: Record<string, string> = {
  oops: "OOP",
  solid: "SOLID principles",
  pattern: "Design patterns",
  article: "UML / Diagramming",
  video: "Videos"
};

export default function LearnPage() {
  const groups = Object.keys(GROUPS);
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">Learn — OOP · SOLID · Patterns</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Curated links surfaced contextually per problem and in every feedback
        panel. Master these before speed-running problems.
      </p>
      {groups.map((g) => (
        <div key={g} className="mt-6">
          <h2 className="font-semibold">{GROUPS[g]}</h2>
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
