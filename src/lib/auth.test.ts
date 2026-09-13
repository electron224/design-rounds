import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

// Isolated temp DB for account tests.
process.env.LLD_DB_PATH = path.join(
  os.tmpdir(),
  `lld-auth-test-${process.pid}-${Date.now()}.db`
);

import {
  SESSION_COOKIE,
  authenticate,
  createSession,
  createUser,
  deleteSession,
  expiredSessionCookie,
  getUserByToken,
  sessionCookie,
  validateCredentials
} from "./auth";
import { getDb } from "./db";
import { GET as meRoute, POST as action } from "@/app/api/auth/[action]/route";

afterAll(async () => {
  try {
    const db = await getDb();
    await db.close();
    fs.unlinkSync(process.env.LLD_DB_PATH!);
  } catch {
    /* best-effort cleanup */
  }
});

function me(token: string | null) {
  return meRoute(
    new NextRequest("http://localhost/api/auth/me", {
      headers: token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}
    }),
    { params: Promise.resolve({ action: "me" }) }
  );
}

function postAction(
  actionName: string,
  body: unknown,
  token: string | null = null
) {
  return action(
    new NextRequest(`http://localhost/api/auth/${actionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {})
      },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ action: actionName }) }
  );
}

describe("local accounts", () => {
  it("validates credentials before touching the DB", () => {
    expect(validateCredentials("A", "a@b.c", "password1")).toMatch(/name/i);
    expect(validateCredentials("Ann", "not-an-email", "password1")).toMatch(
      /email/i
    );
    expect(validateCredentials("Ann", "a@b.c", "short")).toMatch(/password/i);
    expect(validateCredentials("Ann", "a@b.c", "password1")).toBeNull();
  });

  it("signs up, rejects duplicates, and logs in", async () => {
    const created = await createUser("Ann", "Ann@Example.com", "password1");
    expect("user" in created).toBe(true);
    if (!("user" in created)) return;
    expect(created.user.email).toBe("ann@example.com");

    expect(
      "error" in (await createUser("Ann2", "ann@example.com", "password1"))
    ).toBe(true);

    const ok = await authenticate("ANN@example.com", "password1");
    expect("user" in ok && ok.user.id).toBe(created.user.id);
    expect(
      "error" in (await authenticate("ann@example.com", "wrongpass"))
    ).toBe(true);
    expect(
      "error" in (await authenticate("nobody@example.com", "password1"))
    ).toBe(true);
  });

  it("issues and resolves sessions, logout kills them", async () => {
    const created = await createUser("Bob", "bob@example.com", "password123");
    if (!("user" in created)) throw new Error("signup failed");
    const token = await createSession(created.user.id);
    expect((await getUserByToken(token))?.email).toBe("bob@example.com");
    expect(await getUserByToken("bogus")).toBeNull();
    await deleteSession(token);
    expect(await getUserByToken(token)).toBeNull();
  });
});

describe("auth API surface", () => {
  it("signup → me → logout → me(null), unknown actions 404", async () => {
    const signup = await postAction("signup", {
      name: "Cat",
      email: "cat@example.com",
      password: "password123"
    });
    expect(signup.status).toBe(200);
    const cookie = signup.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain(SESSION_COOKIE);
    const token = cookie.split(";")[0].split("=")[1];

    const logged = await me(token);
    expect(((await logged.json()) as { user: { email: string } }).user.email).toBe(
      "cat@example.com"
    );

    const badLogin = await postAction("login", {
      email: "cat@example.com",
      password: "nope-nope-nope"
    });
    expect(badLogin.status).toBe(401);

    const logout = await postAction("logout", {}, token);
    expect(logout.status).toBe(200);

    const gone = await me(token);
    expect(((await gone.json()) as { user: null }).user).toBeNull();

    const unknown = await postAction("nope", {});
    expect(unknown.status).toBe(404);
  });
});

describe("auth hardening", () => {
  const env = process.env as Record<string, string | undefined>;
  const SAVED_NODE_ENV = env.NODE_ENV;

  afterEach(() => {
    env.NODE_ENV = SAVED_NODE_ENV;
  });

  it("throttles credential brute force with 429", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (
        await action(
          new NextRequest("http://localhost/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-forwarded-for": "auth-flood-test"
            },
            body: JSON.stringify({ email: "x@y.z", password: "wrongwrong" })
          }),
          { params: Promise.resolve({ action: "login" }) }
        )
      ).status;
    }
    expect(last).toBe(429);
  });

  it("sets Secure cookies only in production", () => {
    env.NODE_ENV = "production";
    expect(sessionCookie("tok")).toMatch(/; Secure/);
    env.NODE_ENV = "test";
    expect(sessionCookie("tok")).not.toMatch(/; Secure/);
    expect(expiredSessionCookie()).not.toMatch(/; Secure/);
    env.NODE_ENV = SAVED_NODE_ENV;
  });
});
