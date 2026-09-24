import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import postgres from "postgres";

/**
 * One tiny interface, two backends. SQLite (better-sqlite3 file) is the
 * default — zero setup, perfect for local dev and single-node deploys.
 * Set DATABASE_URL and every query below runs on Postgres instead
 * (serverless-safe). Same tables, same `?` placeholders, same call sites —
 * only `await`s were added.
 */
export interface Db {
  get<T>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  all<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  run(sql: string, ...params: unknown[]): Promise<void>;
  /** Schema/migration statements (possibly multiple, never user input). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/** now() in the active backend's dialect. Interpolated, never user input. */
export function nowSql(): string {
  return process.env.DATABASE_URL ? "now()" : "datetime('now')";
}

export function isPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    problemSlug TEXT NOT NULL,
    timerMin INTEGER NOT NULL,
    timeSpentSec INTEGER DEFAULT 0,
    status TEXT DEFAULT 'in_progress',
    userId TEXT,
    drafts TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    attemptId TEXT NOT NULL,
    stage TEXT NOT NULL,
    payload TEXT NOT NULL,
    feedback TEXT,
    score REAL,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (attemptId) REFERENCES attempts(id)
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS user_llm_keys (
    userId TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    cipher TEXT NOT NULL,
    last4 TEXT NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    problemSlug TEXT NOT NULL,
    timerMin INTEGER NOT NULL,
    timeSpentSec INTEGER DEFAULT 0,
    status TEXT DEFAULT 'in_progress',
    userId TEXT,
    drafts TEXT,
    createdAt TIMESTAMPTZ DEFAULT now(),
    updatedAt TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    attemptId TEXT NOT NULL,
    stage TEXT NOT NULL,
    payload TEXT NOT NULL,
    feedback TEXT,
    score REAL,
    createdAt TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (attemptId) REFERENCES attempts(id)
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    createdAt TIMESTAMPTZ DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS user_llm_keys (
    userId TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    cipher TEXT NOT NULL,
    last4 TEXT NOT NULL,
    updatedAt TIMESTAMPTZ DEFAULT now(),
    FOREIGN KEY (userId) REFERENCES users(id)
  );
`;

class SqliteDb implements Db {
  constructor(private db: Database.Database) {}
  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }
  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }
  async run(sql: string, ...params: unknown[]): Promise<void> {
    this.db.prepare(sql).run(...params);
  }
  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }
  async close(): Promise<void> {
    this.db.close();
  }
}

/** Our queries use `?`; postgres.js wants $1, $2… — translated here. */
export function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${(i += 1)}`);
}

class PgDb implements Db {
  constructor(private sql: ReturnType<typeof postgres>) {}
  async get<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const rows = (await this.sql.unsafe(toPg(sql), params as never[])) as T[];
    return rows[0];
  }
  async all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    return (await this.sql.unsafe(toPg(sql), params as never[])) as T[];
  }
  async run(sql: string, ...params: unknown[]): Promise<void> {
    await this.sql.unsafe(toPg(sql), params as never[]);
  }
  async exec(sql: string): Promise<void> {
    // One statement at a time (parameterized path can't batch).
    for (const stmt of sql.split(";")) {
      const trimmed = stmt.trim();
      if (trimmed) await this.sql.unsafe(trimmed);
    }
  }
  async close(): Promise<void> {
    await this.sql.end();
  }
}

let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (isPostgres()) {
    const sql = postgres(process.env.DATABASE_URL!, { max: 5 });
    const pg = new PgDb(sql);
    await pg.exec(PG_SCHEMA);
    // IF NOT EXISTS keeps this safe to run on every boot.
    for (const col of ["userId TEXT", "drafts TEXT"]) {
      await pg.exec(`ALTER TABLE attempts ADD COLUMN IF NOT EXISTS ${col}`);
    }
    db = pg;
    return db;
  }
  // LLD_DB_PATH lets integration tests use an isolated temp database.
  const override = process.env.LLD_DB_PATH;
  let file: string;
  if (override) {
    file = override;
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } else {
    const dir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    file = path.join(dir, "lld.db");
  }
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  const sq = new SqliteDb(sqlite);
  await sq.exec(SQLITE_SCHEMA);
  // Migration for databases created before userId/drafts existed.
  for (const col of ["userId TEXT", "drafts TEXT"]) {
    try {
      await sq.exec(`ALTER TABLE attempts ADD COLUMN ${col}`);
    } catch {
      /* column already present */
    }
  }
  db = sq;
  return db;
}

/** Test-only: drops the cached connection (lets tests switch databases). */
export function __resetDbForTests(): void {
  db = null;
}

/**
 * Idempotent attempt creation. The two dialects spell "ignore conflicts"
 * differently (OR IGNORE vs ON CONFLICT), so it lives here, not at call sites.
 */
export async function ensureAttempt(
  id: string,
  problemSlug: string,
  timerMin: number,
  userId: string | null
): Promise<void> {
  const db = await getDb();
  if (isPostgres()) {
    await db.run(
      "INSERT INTO attempts (id, problemSlug, timerMin, userId) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING",
      id,
      problemSlug,
      timerMin,
      userId
    );
  } else {
    await db.run(
      "INSERT OR IGNORE INTO attempts (id, problemSlug, timerMin, userId) VALUES (?, ?, ?, ?)",
      id,
      problemSlug,
      timerMin,
      userId
    );
  }
}
