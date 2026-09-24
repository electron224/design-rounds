import Link from "next/link";
import { PROBLEMS } from "@/lib/problems";

function MiniCard({ name, lines }: { name: string; lines: string[] }) {
  return (
    <div className="w-40 shrink-0 overflow-hidden rounded-md border-2 border-paper/90 bg-paper text-ink">
      <div className="border-b-2 border-ink/80 px-2 py-1 font-mono text-xs font-bold">
        {name}
      </div>
      <ul className="px-2 py-1 font-mono text-[11px] leading-5">
        {lines.map((l) => (
          <li key={l} className="truncate">
            + {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiagramArrow() {
  return (
    <svg
      aria-hidden
      width="40"
      height="16"
      viewBox="0 0 40 16"
      className="shrink-0 rotate-90 text-[#7aa2f7] sm:rotate-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <line x1="2" y1="8" x2="30" y2="8" />
      <polyline points="24,2 32,8 24,14" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="grid items-center gap-8 rounded-xl bg-ink p-8 text-paper md:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 text-sm text-[#9db4f0]">
            <span aria-hidden className="inline-block h-0.5 w-6 bg-[#9db4f0]" />
            An interview room for low-level design
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl">
            Think in classes. Defend every line.
          </h1>
          <p className="mt-3 max-w-xl leading-7 text-paper/80">
            Pick a problem. Ask sharp questions, model the entities, draw the
            flow, write the code — then get every stage reviewed against
            SOLID and design patterns, with a timer running.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/problems"
              className="rounded-md bg-paper px-4 py-2 text-sm font-semibold text-ink hover:bg-white"
            >
              Browse 10 problems
            </Link>
            <Link
              href="/hld"
              className="rounded-md bg-[#7aa2f7] px-4 py-2 text-sm font-semibold text-ink hover:bg-[#9db4f0]"
            >
              Try animated HLD →
            </Link>
            <Link
              href="/learn"
              className="rounded-md border border-paper/40 px-4 py-2 text-sm text-paper hover:bg-white/10"
            >
              Learn OOP / SOLID / Patterns
            </Link>
          </div>
        </div>
        <Link
          href="/problems/parking-lot"
          className="group justify-self-start md:justify-self-end"
          aria-label="Open the Parking Lot problem"
        >
          <div className="flex flex-col items-center gap-1">
            <div className="flex flex-col items-center gap-1 sm:flex-row">
              <MiniCard name="ParkingLot" lines={["floors", "pricing", "allocate()"]} />
              <DiagramArrow />
              <MiniCard name="Ticket" lines={["entryTime", "slot", "fee()"]} />
              <DiagramArrow />
              <MiniCard name="Slot" lines={["type", "status", "hold()"]} />
            </div>
            <span className="mt-2 text-xs text-paper/60 group-hover:text-paper group-hover:underline">
              A real Stage-1 model — open the Parking Lot problem
            </span>
          </div>
        </Link>
      </div>

      <h2 className="mt-8 text-lg font-semibold">How a session works</h2>
      <ol className="mt-2 grid gap-3 md:grid-cols-4">
        {[
          ["1 · Requirements + timer", "Read functional reqs, set 15–60 min, start the clock."],
          ["2 · Entities", "Name core entities as visual cards — properties, behaviors."],
          ["3 · Flow", "Connect the entity boxes; happy + error paths."],
          ["4 · Code + feedback", "Write classes; get SOLID/pattern review per stage."]
        ].map(([t, d]) => (
          <li key={t} className="rounded-md border bg-white p-3 text-sm dark:bg-zinc-900">
            <strong>{t}</strong>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">{d}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-lg font-semibold">Popular problems</h2>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        {PROBLEMS.slice(0, 6).map((p) => (
          <Link
            key={p.slug}
            href={`/problems/${p.slug}`}
            className="rounded-md border bg-white p-3 hover:border-indigo-400 dark:bg-zinc-900"
          >
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{p.difficulty}</span>
            <div className="mt-1 font-semibold">{p.title}</div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400">{p.summary}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
