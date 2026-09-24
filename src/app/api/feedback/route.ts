import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gradeStage } from "@/lib/llm";
import type { StageHistory } from "@/lib/prompts";
import { problemBySlug } from "@/lib/problems";
import { hldBySlug } from "@/lib/hld";
import { checkLimit, clientIp, rateLimited } from "@/lib/ratelimit";
import { getUserId } from "@/lib/auth";
import { ensureAttempt, getDb, nowSql } from "@/lib/db";
import { decryptKey, vaultEnabled } from "@/lib/keyvault";
import { nanoid } from "nanoid";

const Body = z.object({
  slug: z.string(),
  stage: z.enum([
    "clarify",
    "objects",
    "flow",
    "code",
    "requirements",
    "capacity",
    "api",
    "diagram",
    "deepdive"
  ]),
  payload: z.string().min(1).max(60000),
  attemptId: z.string().optional(),
  timerMin: z.number().int().min(1).max(240).optional(),
  // Bring-your-own-key: provider id + model are allowlist-checked server-side.
  llm: z
    .object({
      provider: z.string().max(50),
      key: z.string().max(500),
      model: z.string().max(100)
    })
    .optional()
});

export async function POST(req: NextRequest) {
  // Grading spends owner LLM quota — throttle per IP before parsing.
  const limit = checkLimit(`feedback:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!limit.ok) return rateLimited(limit.retryAfterSec);
  const json = await req.json();
  const parsed = Body.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { slug, stage, payload, attemptId, timerMin, llm } = parsed.data;
  const problem = problemBySlug(slug) ?? hldBySlug(slug);
  if (!problem)
    return NextResponse.json({ error: "Unknown problem" }, { status: 404 });

  // Key resolution: vault (logged-in savers, browser sends nothing) →
  // transient BYOK (guests) → owner env → static. First hit wins.
  let config = llm;
  if (!config && vaultEnabled()) {
    try {
      const vaultUser = await getUserId().catch(() => null);
      if (vaultUser) {
        const db = await getDb();
        const row = (await db.get(
          "SELECT provider, model, cipher FROM user_llm_keys WHERE userId = ?",
          vaultUser
        )) as
          | { provider: string; model: string; cipher: string }
          | undefined;
        if (row)
          config = {
            provider: row.provider,
            model: row.model,
            key: decryptKey(row.cipher, vaultUser, row.provider)
          };
      }
    } catch {
      /* vault miss or bad row — fall through to owner/static */
    }
  }

  // Prior stages' verdicts give the model the full attempt context, so later
  // stages are judged on coherence too — not in isolation.
  let history: StageHistory[] = [];
  if (attemptId) {
    try {
      const db = await getDb();
      const rows = (await db.all(
        "SELECT stage, feedback FROM submissions WHERE attemptId = ? AND stage != ? ORDER BY createdAt ASC",
        attemptId,
        stage
      )) as { stage: string; feedback: string }[];
      history = rows.flatMap((r) => {
        try {
          const fb = JSON.parse(r.feedback) as {
            verdict?: string;
            scores?: Record<string, number>;
          };
          return typeof fb.verdict === "string"
            ? [{ stage: r.stage, verdict: fb.verdict, scores: fb.scores ?? {} }]
            : [];
        } catch {
          return [];
        }
      });
    } catch {
      /* history is a bonus, never a blocker */
    }
  }

  const feedback = await gradeStage(problem, stage, payload, {
    config,
    history
  });

  try {
    const db = await getDb();
    const aid = attemptId ?? nanoid();
    const userId = await getUserId().catch(() => null);
    const mins =
      timerMin ??
      ("timeDefaultMin" in problem ? problem.timeDefaultMin : 45);
    await ensureAttempt(aid, slug, mins, userId);
    const scores = Object.values(feedback.scores);
    const avg = scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    await db.run(
      "INSERT INTO submissions (id, attemptId, stage, payload, feedback, score) VALUES (?, ?, ?, ?, ?, ?)",
      nanoid(),
      aid,
      stage,
      payload,
      JSON.stringify(feedback),
      avg
    );
    await db.run(
      `UPDATE attempts SET updatedAt = ${nowSql()} WHERE id = ?`,
      aid
    );
    return NextResponse.json({ feedback, attemptId: aid });
  } catch {
    return NextResponse.json({ feedback, attemptId: attemptId ?? null });
  }
}
