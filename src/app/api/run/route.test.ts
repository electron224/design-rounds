import { spawnSync } from "child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const SAVED_PISTON_URL = process.env.PISTON_API_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (SAVED_PISTON_URL === undefined) delete process.env.PISTON_API_URL;
  else process.env.PISTON_API_URL = SAVED_PISTON_URL;
});

function runRequest(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

const hasTool = (cmd: string) =>
  spawnSync(cmd, ["--version"], { timeout: 10000 }).status === 0;

describe("POST /api/run via remote runner", () => {
  it("forwards the entry file first and returns the run result", async () => {
    process.env.PISTON_API_URL = "http://runner.test";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        language: "python",
        version: "3.10.0",
        run: { stdout: "6\n", stderr: "", output: "6\n", code: 0, signal: null }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await runRequest({
      files: [
        { path: "util.py", content: "X = 1" },
        { path: "main.py", content: "print(2 * 3)" }
      ],
      entryPath: "main.py",
      stdin: ""
    });
    expect(res.status).toBe(200);
    expect((await res.json()).run.stdout).toBe("6\n");

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.language).toBe("python");
    expect(sent.files[0].name).toBe("main.py");
  });

  it("returns 502 with a helpful message when the runner is down", async () => {
    process.env.PISTON_API_URL = "http://runner.test";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );
    const res = await runRequest({
      files: [{ path: "a.py", content: "print(1)" }],
      entryPath: "a.py",
      stdin: ""
    });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/runner/i);
  });
});

describe("POST /api/run validation", () => {
  it("rejects non-runnable entry files and invalid bodies", async () => {
    delete process.env.PISTON_API_URL;
    const badExt = await runRequest({
      files: [{ path: "notes.md", content: "# hi" }],
      entryPath: "notes.md",
      stdin: ""
    });
    expect(badExt.status).toBe(400);
    expect((await badExt.json()).error).toMatch(/not runnable/i);
    expect((await runRequest({})).status).toBe(400);
  });

  it("routes remote-only languages to PISTON_API_URL when running locally", async () => {
    delete process.env.PISTON_API_URL;
    const res = await runRequest({
      files: [{ path: "a.swift", content: "print(1)" }],
      entryPath: "a.swift",
      stdin: ""
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/PISTON_API_URL/);
  });

  it("rejects unsafe paths", async () => {
    delete process.env.PISTON_API_URL;
    const res = await runRequest({
      files: [{ path: "../evil.py", content: "print(1)" }],
      entryPath: "../evil.py",
      stdin: ""
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/run locally (host toolchains)", () => {
  it.runIf(hasTool("python3"))("executes python with stdin", async () => {
    delete process.env.PISTON_API_URL;
    const res = await runRequest({
      files: [
        {
          path: "main.py",
          content: "import sys\nprint(int(sys.stdin.read().strip()) * 2)"
        }
      ],
      entryPath: "main.py",
      stdin: "21"
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.run.stdout).toBe("42\n");
    expect(data.run.code).toBe(0);
  });

  it.runIf(hasTool("javac"))("compiles and runs java, surfacing errors", async () => {
    delete process.env.PISTON_API_URL;
    const ok = await runRequest({
      files: [
        { path: "Main.java", content: "public class Main { public static void main(String[] a) { System.out.println(7 * 6); } }" }
      ],
      entryPath: "Main.java",
      stdin: ""
    });
    expect(ok.status).toBe(200);
    const data = await ok.json();
    expect(data.compile.code).toBe(0);
    expect(data.run.stdout).toBe("42\n");

    const bad = await runRequest({
      files: [{ path: "Main.java", content: "public class Main { broken!!" }],
      entryPath: "Main.java",
      stdin: ""
    });
    expect(bad.status).toBe(200);
    const badData = await bad.json();
    expect(badData.compile.code).not.toBe(0);
    expect(badData.run).toBeNull();
  });
});

describe("POST /api/run hardening", () => {
  const SAVED_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...SAVED_ENV };
  });

  function runAs(
    ip: string,
    body: unknown,
    env: Record<string, string | undefined>
  ) {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return POST(
      new NextRequest("http://localhost/api/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": ip
        },
        body: JSON.stringify(body)
      })
    );
  }

  const tiny = {
    files: [{ path: "a.py", content: "print(1)" }],
    entryPath: "a.py",
    stdin: ""
  };

  it("refuses local execution in production without an explicit opt-in", async () => {
    const res = await runAs("ratelimit-killswitch", tiny, {
      NODE_ENV: "production",
      PISTON_API_URL: undefined,
      ALLOW_LOCAL_RUN: undefined
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /disabled/i
    );
  });

  it("honors ALLOW_LOCAL_RUN=1 in production", async () => {
    const res = await runAs("ratelimit-killswitch-optin", tiny, {
      NODE_ENV: "production",
      PISTON_API_URL: undefined,
      ALLOW_LOCAL_RUN: "1"
    });
    expect(res.status).toBe(200);
  });

  it("throttles brute force with 429 + Retry-After", async () => {
    const bad = {
      files: [{ path: "notes.md", content: "x" }],
      entryPath: "notes.md",
      stdin: ""
    };
    let last = 0;
    for (let i = 0; i < 21; i++) {
      last = (
        await runAs("ratelimit-flood", bad, {
          NODE_ENV: "test",
          PISTON_API_URL: undefined,
          ALLOW_LOCAL_RUN: undefined
        })
      ).status;
    }
    expect(last).toBe(429);
  });
});
