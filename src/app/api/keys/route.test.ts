import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { DELETE, GET, POST } from "./route";

vi.mock("@/lib/auth", () => ({ getUserId: vi.fn() }));
const mockUserId = vi.mocked(getUserId);

process.env.LLD_DB_PATH = path.join(
  os.tmpdir(),
  `lld-keys-test-${process.pid}-${Date.now()}.db`
);
process.env.KEYVAULT_SECRET =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

afterAll(async () => {
  try {
    const db = await getDb();
    await db.close();
    fs.unlinkSync(process.env.LLD_DB_PATH!);
  } catch {
    /* best-effort cleanup */
  }
});

beforeAll(async () => {
  // Vault rows reference users(id) — mirror production (must be logged in).
  const db = await getDb();
  for (const id of ["u1", "u2"]) {
    await db.run(
      "INSERT OR IGNORE INTO users (id, name, email, passwordHash) VALUES (?, ?, ?, ?)",
      id,
      id,
      `${id}@test.local`,
      "x"
    );
  }
});

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/keys", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const SAVE = {
  provider: "groq",
  key: "gsk-test-server-side",
  model: "llama-3.1-8b-instant",
};

describe("/api/keys vault", () => {
  it("rejects anonymous callers", async () => {
    mockUserId.mockResolvedValue(null);
    expect((await GET(req("GET"))).status).toBe(401);
    expect((await POST(req("POST", SAVE))).status).toBe(401);
    expect((await DELETE(req("DELETE"))).status).toBe(401);
  });

  it("saves, reports status without key material, and revokes", async () => {
    mockUserId.mockResolvedValue("u1");
    const saved = await (await POST(req("POST", SAVE))).json();
    expect(saved.saved).toBe(true);
    expect(saved.provider).toBe("groq");
    expect(saved.last4).toBe("…side");
    expect(JSON.stringify(saved)).not.toContain("gsk-test-server-side");

    const status = await (await GET(req("GET"))).json();
    expect(status).toMatchObject({ saved: true, provider: "groq", last4: "…side" });
    expect(JSON.stringify(status)).not.toContain("gsk-test-server-side");

    const db = await getDb();
    const row = (await db.get("SELECT cipher FROM user_llm_keys WHERE userId = ?", "u1")) as {
      cipher: string;
    };
    expect(row.cipher).not.toContain("gsk-test-server-side");

    expect((await (await DELETE(req("DELETE"))).json()).saved).toBe(false);
    expect((await (await GET(req("GET"))).json()).saved).toBe(false);
  });

  it("rejects unknown providers without storing", async () => {
    mockUserId.mockResolvedValue("u2");
    const res = await POST(req("POST", { ...SAVE, provider: "evil" }));
    expect(res.status).toBe(400);
    const status = await (await GET(req("GET"))).json();
    expect(status.saved).toBe(false);
  });
});
