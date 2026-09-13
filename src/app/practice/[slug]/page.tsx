import { notFound } from "next/navigation";
import Link from "next/link";
import { problemBySlug } from "@/lib/problems";
import PracticeWizard from "@/components/PracticeWizard";

export default async function PracticePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string; attempt?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const problem = problemBySlug(slug);
  if (!problem) notFound();
  const t = Math.min(240, Math.max(1, parseInt(sp.t ?? "", 10) || problem.timeDefaultMin));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/problems/${slug}`} className="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
            ← Requirements
          </Link>
          <h1 className="text-xl font-bold">
            {problem.title} <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">· {t} min · {problem.difficulty}</span>
          </h1>
        </div>
        <Link href="/problems" className="text-sm text-zinc-600 hover:underline dark:text-zinc-400">
          Switch problem
        </Link>
      </div>
      <details className="mt-2 rounded-md border bg-white p-3 text-sm dark:bg-zinc-900">
        <summary className="cursor-pointer font-semibold">Show functional requirements</summary>
        <ul className="mt-1 list-disc pl-5">
          {problem.functionalRequirements.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </details>
      <div className="mt-4">
        <PracticeWizard
          problem={problem}
          timerMin={t}
          resumeAttemptId={sp.attempt ?? null}
        />
      </div>
    </main>
  );
}
