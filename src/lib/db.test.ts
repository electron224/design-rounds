import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import {
  __resetDbForTests,
  ensureAttempt,
  getDb,
  isPostgres,
  nowSql,
  toPg
} from "./db";

function tempDb(name: string) {
  process.env.LLD_DB_PATH = path.join(
    os.tmpdir(),
    `lld-db-test-${name}-${process.pid}-${Date.now()}.db`
  );
  __resetDbForTests();
}

afterAll(async () => {
  try {
    await (await getDb()).close();
  } catch {
    /* best-effort cleanup */
  }
  __resetDbForTests();
  delete process.env.LLD_DB_PATH;
});

describe("db layer", () => {
  it("stays on SQLite without DATABASE_URL", () => {
    delete process.env.DATABASE_URL;
    expect(isPostgres()).toBe(false);
    expect(nowSql()).toBe("datetime('now')");
  });

  it("round-trips through the Db interface", async () => {
    tempDb("crud");
    const db = await getDb();
    await db.run("INSERT INTO attempts (id, problemSlug, timerMin) VALUES (?, ?, ?)", "a1", "atm", 40);
    expect(
      (await db.get<{ problemSlug: string }>(
        "SELECT problemSlug FROM attempts WHERE id = ?",
        "a1"
      ))?.problemSlug
    ).toBe("atm");
    expect(
      (await db.all<{ id: string }>("SELECT id FROM attempts")).map((r) => r.id)
    ).toEqual(["a1"]);
    expect(await db.get("SELECT id FROM attempts WHERE id = ?", "nope")).toBeUndefined();
    fs.unlinkSync(process.env.LLD_DB_PATH!);
  });

  it("ensureAttempt is idempotent", async () => {
    tempDb("idempotent");
    await ensureAttempt("dup", "atm", 40, null);
    await ensureAttempt("dup", "atm", 40, null);
    const db = await getDb();
    const rows = await db.all<{ n: number }>(
      "SELECT COUNT(*) AS n FROM attempts WHERE id = ?",
      "dup"
    );
    // COUNT(*) comes back numeric on both backends (CAST in app queries).
    expect(Number(rows[0].n)).toBe(1);
    fs.unlinkSync(process.env.LLD_DB_PATH!);
  });

  it("translates ? placeholders to $n for Postgres", () => {
    expect(toPg("SELECT * FROM t WHERE a = ? AND b = ?")).toBe(
      "SELECT * FROM t WHERE a = $1 AND b = $2"
    );
    expect(toPg("SELECT 1")).toBe("SELECT 1");
  });
});
