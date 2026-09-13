"use client";
import { useMemo, useState } from "react";
import {
  SUPPORTED_RUN_EXTENSIONS,
  pistonLanguageForPath,
  type RunFile
} from "@/lib/runtimes";

interface StageResult {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
}

interface RunResponse {
  language?: string;
  version?: string | null;
  compile?: StageResult | null;
  run?: StageResult | null;
  error?: string;
}

/**
 * Compile + run console for the code stage: picks an entry file, accepts
 * stdin ("inputs accordingly"), and shows compile errors / program output.
 */
export default function RunPanel({ files }: { files: RunFile[] }) {
  const runnable = useMemo(
    () =>
      files.filter((f) => pistonLanguageForPath(f.path) !== null).sort((a, b) =>
        a.path.localeCompare(b.path)
      ),
    [files]
  );
  const [entry, setEntry] = useState<string | null>(null);
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResponse | null>(null);

  const entryPath = entry ?? runnable[0]?.path ?? null;

  const run = async () => {
    if (!entryPath) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files, entryPath, stdin })
      });
      setResult(await res.json());
    } catch {
      setResult({ error: "Could not reach the run endpoint." });
    } finally {
      setRunning(false);
    }
  };

  const block = (title: string, text: string, tone: "out" | "err") =>
    text ? (
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {title}
        </p>
        <pre
          className={`mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded p-2 font-mono text-xs ${
            tone === "err"
              ? "bg-red-950 text-red-200"
              : "bg-zinc-950 text-zinc-100"
          }`}
        >
          {text}
        </pre>
      </div>
    ) : null;

  return (
    <div className="mt-3 rounded-md border bg-white p-3 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Run</h3>
        {runnable.length > 0 ? (
          <select
            value={entryPath ?? ""}
            onChange={(e) => setEntry(e.target.value)}
            title="Entry file (sent first to the runner)"
            className="rounded border bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {runnable.map((f) => (
              <option key={f.path} value={f.path}>
                {f.path} ({pistonLanguageForPath(f.path)})
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            No runnable files — supported: {SUPPORTED_RUN_EXTENSIONS.join(", ")}
          </span>
        )}
        <button
          onClick={run}
          disabled={running || !entryPath}
          className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
        >
          {running ? "Running…" : "▶ Run"}
        </button>
        {result && !result.error && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {result.language}
            {result.version ? ` ${result.version}` : ""} · exit{" "}
            {result.run?.code ?? result.compile?.code ?? "?"}
          </span>
        )}
      </div>

      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Input (stdin)
          </p>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder={"1 2 3\nhello"}
            spellCheck={false}
            className="mt-1 h-28 w-full rounded border bg-white p-2 font-mono text-xs text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            Tip: runs on this machine (python, node, java — needs a Main
            method to print output). Multi-file runs share one folder; Java
            must skip the `package` line. Set PISTON_API_URL server-side for
            more languages.
          </p>
        </div>
        <div className="space-y-2">
          {result?.error && (
            <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {result.error}
            </p>
          )}
          {result?.compile &&
            (result.compile.code !== 0 ||
              result.compile.stderr ||
              result.compile.stdout) && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Compile
                </p>
                {block("stdout", result.compile.stdout, "out")}
                {block("stderr", result.compile.stderr, "err")}
              </div>
            )}
          {result?.run && (
            <div className="space-y-2">
              {block("Output", result.run.stdout || result.run.output, "out")}
              {block("Errors", result.run.stderr, "err")}
              {!result.run.stdout &&
                !result.run.stderr &&
                !result.run.output && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Program exited with code {result.run.code ?? "?"} and no
                    output.
                  </p>
                )}
            </div>
          )}
          {!result && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Output appears here after a run.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
