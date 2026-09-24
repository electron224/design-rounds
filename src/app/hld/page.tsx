import Link from "next/link";
import { HLD_PROBLEMS } from "@/lib/hld";

export default function HldListPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">HLD — learn through animation</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        No static docs. Watch each request travel through the system, move
        sliders to feel capacity, then solve the problem yourself in stages.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {HLD_PROBLEMS.map((p, i) => (
          <Link
            key={p.slug}
            href={`/hld/${p.slug}`}
            className="rounded-md border bg-white p-4 hover:border-indigo-400 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink font-mono text-[11px] font-bold text-paper dark:bg-chalk dark:text-ink">
                {i + 1}
              </span>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                {p.difficulty}
              </span>
            </div>
            <div className="mt-2 font-semibold">{p.title}</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{p.summary}</div>
            <div className="mt-2 font-mono text-[11px] text-blueprint dark:text-[#9db4f0]">
              ▶ animated flow · 🎛 playground · ✏ solver
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
