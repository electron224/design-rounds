import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { ensureAttempt, getDb, nowSql } from "@/lib/db";
import { getUserId } from "@/lib/auth";

export interface AttemptDrafts {
  questions?: string;
  classes?: unknown;
  flow?: string;
  flowMode?: "draw" | "mermaid";
  scene?: unknown;
  files?: unknown;
  folders?: string[];
}

const CreateBody = z.object({
  problemSlug: z.string().min(1).max(100),
  timerMin: z.number().int().min(1).max(240)
});

const PatchBody = z.object({
  attemptId: z.string().min(1).max(100),
  drafts: z.record(z.string(), z.unknown()),
  status: z.enum(["in_progress", "finished"]).optional()
});

function rowToAttempt(row: Record<string, unknown>) {
  return {
    id: row.id,
    problemSlug: row.problemSlug,
    timerMin: row.timerMin,
    status: row.status,
    drafts: row.drafts ? JSON.parse(row.drafts as string) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

/** An attempt is visible to its owner, or to anyone holding the id (guests). */
async function visibleAttempt(id: string) {
  const db = await getDb();
  const row = (await db.get(
    "SELECT * FROM attempts WHERE id = ?",
    id
  )) as Record<string, unknown> | undefined;
  if (!row) return null;
  if (row.userId) {
    const userId = await getUserId().catch(() => null);
    if (userId !== row.userId) return null;
  }
  return row;
}

/** POST /api/attempts { problemSlug, timerMin } → { attemptId, drafts } */
export async function POST(req: NextRequest) {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const id = nanoid();
  const userId = await getUserId().catch(() => null);
  await ensureAttempt(id, parsed.data.problemSlug, parsed.data.timerMin, userId);
  return NextResponse.json({ attemptId: id, drafts: null });
}

/** PATCH /api/attempts { attemptId, drafts, status? } — autosave + finish. */
export async function PATCH(req: NextRequest) {
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const row = await visibleAttempt(parsed.data.attemptId);
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const db = await getDb();
  // Cap draft size so a giant whiteboard can't bloat the DB (~200KB).
  const drafts = JSON.stringify(parsed.data.drafts).slice(0, 200_000);
  if (parsed.data.status) {
    await db.run(
      `UPDATE attempts SET drafts = ?, status = ?, updatedAt = ${nowSql()} WHERE id = ?`,
      drafts,
      parsed.data.status,
      parsed.data.attemptId
    );
  } else {
    await db.run(
      `UPDATE attempts SET drafts = ?, updatedAt = ${nowSql()} WHERE id = ?`,
      drafts,
      parsed.data.attemptId
    );
  }
  return NextResponse.json({ ok: true });
}

/**
 * GET /api/attempts?attemptId=X → { attempt, submissions }
 * GET /api/attempts?mine=1 → logged-in user's attempts (newest first)
 * GET /api/attempts?ids=a,b → guest attempts by id (for the progress page)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const db = await getDb();
  try {
    const attemptId = searchParams.get("attemptId");
    if (attemptId) {
      const row = await visibleAttempt(attemptId);
      if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });
      const submissions = await db.all(
        "SELECT stage, payload, feedback, score, createdAt FROM submissions WHERE attemptId = ? ORDER BY createdAt ASC",
        attemptId
      );
      return NextResponse.json({ attempt: rowToAttempt(row), submissions });
    }

    if (searchParams.get("mine") === "1") {
      const userId = await getUserId().catch(() => null);
      if (!userId) return NextResponse.json({ attempts: [] });
      const rows = await db.all(
        `SELECT a.*, COALESCE(s.stages, 0) AS stages, s.avgScore FROM attempts a
           LEFT JOIN (SELECT attemptId, CAST(COUNT(*) AS INTEGER) AS stages, CAST(AVG(score) AS REAL) AS avgScore FROM submissions GROUP BY attemptId) s
           ON s.attemptId = a.id
           WHERE a.userId = ? ORDER BY a.updatedAt DESC LIMIT 50`,
        userId
      );
      return NextResponse.json({ attempts: rows });
    }

    const ids = (searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);
    if (ids.length === 0) return NextResponse.json({ attempts: [] });
    const placeholders = ids.map(() => "?").join(",");
    const rows = await db.all(
      `SELECT a.*, COALESCE(s.stages, 0) AS stages, s.avgScore FROM attempts a
         LEFT JOIN (SELECT attemptId, CAST(COUNT(*) AS INTEGER) AS stages, CAST(AVG(score) AS REAL) AS avgScore FROM submissions GROUP BY attemptId) s
         ON s.attemptId = a.id
         WHERE a.id IN (${placeholders}) AND a.userId IS NULL
         ORDER BY a.updatedAt DESC`,
      ...ids
    );
    return NextResponse.json({ attempts: rows });
  } catch {
    return NextResponse.json({ attempts: [], submissions: [] });
  }
}
