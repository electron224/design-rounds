import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { nanoid } from "nanoid";
import { getDb, nowSql } from "./db";

export const SESSION_COOKIE = "lld_session";
const SESSION_DAYS = 30;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Local accounts in SQLite. Passwords: scrypt (stdlib) + per-user salt.
 * Sessions: random tokens in a sessions table + httpOnly cookie. No deps,
 * no OAuth, no env setup — guests keep working without any of this.
 */
function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return check.length === expected.length && timingSafeEqual(check, expected);
}

export function validateCredentials(
  name: string,
  email: string,
  password: string
): string | null {
  if (name.trim().length < 2) return "Name needs at least 2 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Enter a valid email address.";
  if (password.length < 8) return "Password needs at least 8 characters.";
  return null;
}

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<{ user: PublicUser } | { error: string }> {
  const invalid = validateCredentials(name, email, password);
  if (invalid) return { error: invalid };
  const db = await getDb();
  const cleanEmail = email.trim().toLowerCase();
  const exists = await db.get("SELECT id FROM users WHERE email = ?", cleanEmail);
  if (exists) return { error: "An account with this email already exists." };
  const user: PublicUser = {
    id: nanoid(),
    name: name.trim(),
    email: cleanEmail
  };
  await db.run(
    "INSERT INTO users (id, name, email, passwordHash) VALUES (?, ?, ?, ?)",
    user.id,
    user.name,
    user.email,
    hashPassword(password)
  );
  return { user };
}

export async function authenticate(
  email: string,
  password: string
): Promise<{ user: PublicUser } | { error: string }> {
  const db = await getDb();
  const row = (await db.get(
    "SELECT id, name, email, passwordHash FROM users WHERE email = ?",
    email.trim().toLowerCase()
  )) as (PublicUser & { passwordHash: string }) | undefined;
  if (!row || !verifyPassword(password, row.passwordHash))
    return { error: "Wrong email or password." };
  return { user: { id: row.id, name: row.name, email: row.email } };
}

export async function createSession(userId: string): Promise<string> {
  const token = nanoid(48);
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 3600 * 1000
  ).toISOString();
  const db = await getDb();
  await db.run(
    "INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)",
    token,
    userId,
    expiresAt
  );
  return token;
}

export async function getUserByToken(token: string): Promise<PublicUser | null> {
  const db = await getDb();
  const row = (await db.get(
    `SELECT u.id, u.name, u.email FROM users u
       JOIN sessions s ON s.userId = u.id
       WHERE s.token = ? AND s.expiresAt > ${nowSql()}`,
    token
  )) as PublicUser | undefined;
  return row ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM sessions WHERE token = ?", token);
}

function cookieFlags(): string {
  // Secure only in production so plain-HTTP local dev keeps working.
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function sessionCookie(token: string): string {
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  return `${SESSION_COOKIE}=${token}; ${cookieFlags()}; Expires=${expires.toUTCString()}`;
}

export function expiredSessionCookie(): string {
  return `${SESSION_COOKIE}=; ${cookieFlags()}; Max-Age=0`;
}

/** Current request's user id, or null for guests. */
export async function getUserId(): Promise<string | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return (await getUserByToken(token))?.id ?? null;
  } catch {
    return null;
  }
}

/** Current request's user, or null for guests. */
export async function getSessionUser(): Promise<PublicUser | null> {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return await getUserByToken(token);
  } catch {
    return null;
  }
}
