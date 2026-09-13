import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

process.env.LLD_DB_PATH = path.join(
  os.tmpdir(),
  `lld-attempts-test-${process.pid}-${Date.now()}.db`
);

import { getDb } from "@/lib/db";
import { GET, PATCH, POST } from "./route";

afterAll(async () => {
  try {
    const db = await getDb();
    await db.close();
    fs.unlinkSync(process.env.LLD_DB_PATH!);
  } catch {
    /* best-effort cleanup */
  }
});

function req(url: string, body?: unknown, method = "GET") {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

describe("attempts persistence", () => {
  it("creates, patches drafts, and reads back an attempt", async () => {
    const created = await POST(
      req("/api/attempts", { problemSlug: "atm", timerMin: 40 }, "POST")
    );
    expect(created.status).toBe(200);
    const { attemptId } = await created.json();
    expect(attemptId).toBeTruthy();

    const patched = await PATCH(
      req(
        "/api/attempts",
        {
          attemptId,
          drafts: { questions: "Who are the users?", timeLeftSec: 1234 }
        },
        "PATCH"
      )
    );
    expect((await patched.json()).ok).toBe(true);

    const got = await GET(req(`/api/attempts?attemptId=${attemptId}`));
    expect(got.status).toBe(200);
    const data = await got.json();
    expect(data.attempt.problemSlug).toBe("atm");
    expect(data.attempt.drafts.questions).toBe("Who are the users?");
    expect(data.attempt.drafts.timeLeftSec).toBe(1234);
    expect(data.submissions).toEqual([]);
  });

  it("rejects invalid payloads and unknown ids", async () => {
    expect((await POST(req("/api/attempts", {}, "POST"))).status).toBe(400);
    expect(
      (await PATCH(req("/api/attempts", { attemptId: "nope", drafts: {} }, "PATCH"))).status
    ).toBe(404);
    expect((await GET(req("/api/attempts?attemptId=nope"))).status).toBe(404);
  });

  it("lists guest attempts by id but hides other users' attempts", async () => {
    const created = await POST(
      req("/api/attempts", { problemSlug: "atm", timerMin: 40 }, "POST")
    );
    const { attemptId } = await created.json();

    const list = await GET(req(`/api/attempts?ids=${attemptId},nope`));
    const ids = ((await list.json()).attempts as { id: string }[]).map(
      (a) => a.id
    );
    expect(ids).toContain(attemptId);

    // Claim it for another user → guests can no longer see it.
    const db = await getDb();
    await db.run("UPDATE attempts SET userId = ? WHERE id = ?", "someone-else", attemptId);
    const hidden = await GET(req(`/api/attempts?ids=${attemptId}`));
    expect(((await hidden.json()).attempts as unknown[])).toHaveLength(0);
    expect((await GET(req(`/api/attempts?attemptId=${attemptId}`))).status).toBe(404);
  });

  it("returns no server list for guests", async () => {
    const mine = await GET(req("/api/attempts?mine=1"));
    expect(((await mine.json()).attempts as unknown[])).toEqual([]);
  });
});
