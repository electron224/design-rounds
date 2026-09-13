import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { POST } from "./route";
import { GET as GET_ATTEMPTS } from "../attempts/route";

// Isolated temp DB — never touches the developer's data/lld.db.
// (getDb reads LLD_DB_PATH lazily, so setting it here is sufficient.)
process.env.LLD_DB_PATH = path.join(
  os.tmpdir(),
  `lld-test-${process.pid}-${Date.now()}.db`
);

afterAll(async () => {
  try {
    const db = await getDb();
    await db.close();
    fs.unlinkSync(process.env.LLD_DB_PATH!);
  } catch {
    /* best-effort cleanup */
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/feedback (integration: route + rubric + sqlite)", () => {
  it("grades the objects stage and persists the submission", async () => {
    const res = await post({
      slug: "parking-lot",
      stage: "objects",
      payload: JSON.stringify([{ name: "Slot" }]),
      timerMin: 30
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.feedback.provider).toBe("static");
    expect(data.attemptId).toBeTruthy();

    const db = await getDb();
    const row = (await db.get(
      "SELECT stage, score FROM submissions WHERE attemptId = ?",
      data.attemptId
    )) as { stage: string; score: number };
    expect(row.stage).toBe("objects");
    expect(row.score).toBeGreaterThan(0);
  });

  it("grades flow and multi-file code payloads", async () => {
    const flow = await post({
      slug: "parking-lot",
      stage: "flow",
      payload: "Whiteboard UML sketch (1 shapes, 0 connectors):\n- class \"Lot\""
    });
    expect((await flow.json()).feedback.scores).toHaveProperty("Completeness");

    const code = await post({
      slug: "parking-lot",
      stage: "code",
      payload: "===== FILE: Lot.java =====\nclass Lot {}"
    });
    expect((await code.json()).feedback.patternSuggestions).toContain("Strategy");
  });

  it("rejects invalid bodies and unknown problems", async () => {
    expect((await post({ slug: "parking-lot" })).status).toBe(400);
    expect(
      (await post({ slug: "nope", stage: "code", payload: "x" })).status
    ).toBe(404);
  });

  it("lists submissions for an attempt", async () => {
    const res = await post({
      slug: "lru-cache",
      stage: "code",
      payload: "class LRUCache {}"
    });
    const { attemptId } = await res.json();
    const list = await GET_ATTEMPTS(
      new NextRequest(`http://localhost/api/attempts?attemptId=${attemptId}`)
    );
    const data = await list.json();
    expect(data.submissions).toHaveLength(1);
    expect(data.submissions[0].stage).toBe("code");
  });

  it("grades via a candidate key against the allowlist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: JSON.stringify({ scores: {}, verdict: "v" }) } }
          ]
        })
      })
    );
    const res = await post({
      slug: "parking-lot",
      stage: "clarify",
      payload:
        "Who are the users, drivers or valets? Is pricing fixed at entry or computed at exit?",
      llm: { provider: "groq", key: "gsk-test", model: "llama-3.1-8b-instant" }
    });
    const data = await res.json();
    expect(data.feedback.provider).toBe("llm");
    expect(data.feedback.engine).toBe("Groq llama-3.1-8b-instant · your key");
  });

  it("ignores a forged provider and still persists static feedback", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await post({
      slug: "parking-lot",
      stage: "clarify",
      payload:
        "Who are the users, drivers or valets? Is pricing fixed at entry or computed at exit?",
      llm: { provider: "evil", key: "x", model: "x" }
    });
    const data = await res.json();
    expect(data.feedback.provider).toBe("static");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(data.attemptId).toBeTruthy();
  });
});
