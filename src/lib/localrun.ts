import { spawn, type ChildProcess } from "child_process";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import type { RunFile } from "./runtimes";

export interface StageOutput {
  stdout: string;
  stderr: string;
  output: string;
  code: number | null;
  signal: string | null;
}

export interface LocalRunResult {
  compile: StageOutput | null;
  run: StageOutput | null;
  error?: string;
}

/** Piston language names this machine can execute without a remote runner. */
export const LOCAL_LANGUAGES = new Set(["python", "javascript", "java"]);

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_CHARS = 50_000;

interface CmdResult extends StageOutput {
  timedOut: boolean;
  spawnFailed: string | null;
}

function truncate(s: string): string {
  return s.length > MAX_OUTPUT_CHARS
    ? s.slice(0, MAX_OUTPUT_CHARS) + "\n…[output truncated]"
    : s;
}

function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  stdin: string
): Promise<CmdResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (partial: Omit<CmdResult, "output">) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const out = truncate(partial.stdout);
      const err = truncate(partial.stderr);
      resolve({ ...partial, stdout: out, stderr: err, output: out + err });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, TIMEOUT_MS);
    // Unref so a hung child can never keep the server alive past the kill.
    (timer as unknown as { unref?: () => void }).unref?.();

    let child: ChildProcess;
    try {
      child = spawn(cmd, args, { cwd });
    } catch (e) {
      finish({
        stdout: "",
        stderr: "",
        code: null,
        signal: null,
        timedOut: false,
        spawnFailed: e instanceof Error ? e.message : String(e)
      });
      return;
    }
    const procOut = child.stdout;
    const procErr = child.stderr;
    const procIn = child.stdin;
    if (!procOut || !procErr || !procIn) {
      finish({
        stdout: "",
        stderr: "",
        code: null,
        signal: null,
        timedOut: false,
        spawnFailed: "could not attach to child process stdio"
      });
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
      return;
    }
    procOut.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    procErr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (e: Error & { code?: string }) =>
      finish({
        stdout,
        stderr,
        code: null,
        signal: null,
        timedOut: false,
        spawnFailed:
          e.code === "ENOENT"
            ? `runtime "${cmd}" not found on this machine`
            : e.message
      })
    );
    child.on("close", (code, signal) =>
      finish({
        stdout: timedOut
          ? stdout + `\n…[killed after ${TIMEOUT_MS / 1000}s timeout]`
          : stdout,
        stderr,
        code,
        signal,
        timedOut,
        spawnFailed: null
      })
    );
    try {
      procIn.write(stdin);
      procIn.end();
    } catch {
      /* stdin closed by the child already */
    }
  });
}

/**
 * Executes a project on this host inside a fresh temp dir (removed after).
 * Supports python, javascript (node) and default-package java. Anything else
 * must go through a remote Piston runner (PISTON_API_URL).
 */
export async function runLocally(
  language: string,
  files: RunFile[],
  entryPath: string,
  stdin: string
): Promise<LocalRunResult> {
  for (const f of files) {
    if (path.isAbsolute(f.path) || f.path.split("/").includes(".."))
      return {
        compile: null,
        run: null,
        error: `Unsafe path rejected: "${f.path}".`
      };
  }
  if (!LOCAL_LANGUAGES.has(language))
    return {
      compile: null,
      run: null,
      error:
        `"${entryPath}" needs a remote runner (this machine runs: java, ` +
        `javascript, python). Set PISTON_API_URL to a self-hosted Piston instance.`
    };

  const dir = await mkdtemp(path.join(os.tmpdir(), "lld-run-"));
  try {
    for (const f of files) {
      const dest = path.join(dir, f.path);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, f.content);
    }

    if (language === "python") {
      let r = await runCmd("python3", [entryPath], dir, stdin);
      if (r.spawnFailed?.includes("not found"))
        r = await runCmd("python", [entryPath], dir, stdin);
      if (r.spawnFailed) return { compile: null, run: null, error: r.spawnFailed };
      return { compile: null, run: r };
    }

    if (language === "javascript") {
      const r = await runCmd("node", [entryPath], dir, stdin);
      if (r.spawnFailed) return { compile: null, run: null, error: r.spawnFailed };
      return { compile: null, run: r };
    }

    // Java: default package only (typical for LLD practice).
    const entry = files.find((f) => f.path === entryPath);
    if (entry && /^\s*package\s+/m.test(entry.content))
      return {
        compile: null,
        run: null,
        error:
          "Java packages aren't supported by the local runner — remove the " +
          "`package` line or set PISTON_API_URL for full builds."
      };
    const javaFiles = files.filter((f) => f.path.endsWith(".java")).map((f) => f.path);
    const compile = await runCmd("javac", javaFiles, dir, "");
    if (compile.spawnFailed)
      return { compile: null, run: null, error: compile.spawnFailed };
    if (compile.code !== 0) return { compile, run: null };
    const mainClass = path.basename(entryPath, ".java");
    const run = await runCmd("java", ["-cp", dir, mainClass], dir, stdin);
    if (run.spawnFailed)
      return { compile, run: null, error: run.spawnFailed };
    return { compile, run };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
