import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runLocally } from "@/lib/localrun";
import { checkLimit, clientIp, rateLimited } from "@/lib/ratelimit";
import {
  pistonLanguageForPath,
  validateRunInput
} from "@/lib/runtimes";

const Body = z.object({
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(200),
        content: z.string().max(100_000)
      })
    )
    .min(1)
    .max(20),
  entryPath: z.string().min(1).max(200),
  stdin: z.string().max(20_000).default("")
});

const RUNNER_UNREACHABLE =
  "Remote code runner is unreachable. Your code is safe — try again, or " +
  "leave PISTON_API_URL unset to run on this machine instead.";

/**
 * Executes the candidate's project. Strategy:
 * 1. PISTON_API_URL set → remote Piston-compatible runner (deployments).
 * 2. Otherwise → local execution, but ONLY with an explicit opt-in in
 *    production (ALLOW_LOCAL_RUN=1). Running stranger code on a public host
 *    by default would be remote-code-execution as a feature.
 * The entry file goes first; remote multi-file projects are flattened to
 * basenames. Local runs happen in a fresh temp dir, 10s timeout each stage.
 */
export async function POST(req: NextRequest) {
  const limit = checkLimit(`run:${clientIp(req)}`, 20, 10 * 60 * 1000);
  if (!limit.ok) return rateLimited(limit.retryAfterSec);
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid run request." }, { status: 400 });

  const { files, entryPath, stdin } = parsed.data;
  const language = pistonLanguageForPath(entryPath);
  if (!language)
    return NextResponse.json(
      {
        error: `"${entryPath}" is not runnable. Open a runnable file (java, py, js, ts, go, c, cpp, rs, rb, php, kt, cs, swift, scala, sh).`
      },
      { status: 400 }
    );

  const invalid = validateRunInput(files, stdin);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const base = (process.env.PISTON_API_URL ?? "").trim();
  const localAllowed =
    process.env.ALLOW_LOCAL_RUN === "1" ||
    process.env.NODE_ENV !== "production";
  if (!base && !localAllowed)
    return NextResponse.json(
      {
        error:
          "Code execution is disabled on this server. The hoster can enable a sandboxed runner via PISTON_API_URL."
      },
      { status: 403 }
    );
  if (!base) {
    // Local execution (see src/lib/localrun.ts).
    const result = await runLocally(language, files, entryPath, stdin);
    if (result.error)
      return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      language,
      version: null,
      compile: result.compile,
      run: result.run
    });
  }

  const ordered = [...files].sort((a, b) => {
    if (a.path === entryPath) return -1;
    if (b.path === entryPath) return 1;
    return a.path.localeCompare(b.path);
  });

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (process.env.PISTON_API_KEY)
      headers.Authorization = process.env.PISTON_API_KEY;
    const res = await fetch(`${base}/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        language,
        version: "*",
        files: ordered.map((f) => ({
          // Runners execute a flat file list; packages/namespaces may not resolve.
          name: f.path.split("/").pop() ?? f.path,
          content: f.content
        })),
        stdin,
        compile_timeout: 10000,
        run_timeout: 10000
      }),
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`runner responded ${res.status}`);
    const data = await res.json();
    const pick = (s: unknown) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        stdout: typeof o.stdout === "string" ? o.stdout : "",
        stderr: typeof o.stderr === "string" ? o.stderr : "",
        output: typeof o.output === "string" ? o.output : "",
        code: typeof o.code === "number" ? o.code : null,
        signal: typeof o.signal === "string" ? o.signal : null
      };
    };
    return NextResponse.json({
      language,
      version: typeof data.version === "string" ? data.version : null,
      compile: data.compile ? pick(data.compile) : null,
      run: data.run ? pick(data.run) : null
    });
  } catch {
    return NextResponse.json({ error: RUNNER_UNREACHABLE }, { status: 502 });
  }
}
