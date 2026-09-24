import Link from "next/link";
import { notFound } from "next/navigation";
import { hldBySlug } from "@/lib/hld";
import HldLearn from "@/components/HldLearn";
import HldSolver from "@/components/HldSolver";

export default async function HldDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const p = hldBySlug(slug);
  if (!p) notFound();
  const tab = sp.tab === "solve" ? "solve" : "learn";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/hld" className="text-sm text-indigo-600 hover:underline">
        ← All HLD problems
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{p.title}</h1>
        <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
          {p.difficulty}
        </span>
      </div>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{p.summary}</p>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/hld/${p.slug}?tab=learn`}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            tab === "learn"
              ? "bg-indigo-600 text-white"
              : "border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          ▶ Learn (animated)
        </Link>
        <Link
          href={`/hld/${p.slug}?tab=solve`}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            tab === "solve"
              ? "bg-indigo-600 text-white"
              : "border hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          ✏ Solve (interactive)
        </Link>
      </div>

      {tab === "learn" ? (
        <div className="mt-4 space-y-4">
          <HldLearn problem={p} />
          <div className="rounded-md border bg-white p-4 dark:bg-zinc-900">
            <h3 className="font-semibold">Components</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {p.components.map((c) => (
                <li key={c.name}>
                  <strong>{c.name}</strong>
                  <span className="text-zinc-600 dark:text-zinc-400"> — {c.role}</span>
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={`/hld/${p.slug}?tab=solve`}
            className="block rounded-md bg-ink p-3 text-center text-sm font-semibold text-paper dark:bg-chalk dark:text-ink"
          >
            Got the flow? Solve it yourself →
          </Link>
        </div>
      ) : (
        <div className="mt-4">
          <HldSolver problem={p} />
        </div>
      )}
    </main>
  );
}
