import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJson, gradeStage } from "./llm";
import { problemBySlug } from "./problems";

const parkingLot = problemBySlug("parking-lot")!;
const PAYLOAD =
  "Who are the users, drivers or valets? Is pricing fixed at entry or computed at exit? Single lot or many lots?";

const LLM_OK = {
  scores: { Completeness: 5 },
  strengths: ["s"],
  issues: [],
  optimizations: [],
  verdict: "v"
};

function stubFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: async () => response
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_MODEL;
});

describe("extractJson", () => {
  it("parses plain and fence-wrapped replies", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(
      extractJson('```json\n{"scores": {"Completeness": 5}}\n```')
    ).toEqual({ scores: { Completeness: 5 } });
    expect(extractJson('Sure! ```{"a": 2}```')).toEqual({ a: 2 });
  });

  it("throws when there is no object at all", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("gradeStage with candidate config (BYOK)", () => {
  it("calls the allowlisted endpoint with the chosen model + key", async () => {
    const fetchMock = stubFetch({ choices: [{ message: { content: JSON.stringify(LLM_OK) } }] });
    vi.stubGlobal("fetch", fetchMock);

    const fb = await gradeStage(parkingLot, "clarify", PAYLOAD, {
      config: { provider: "gemini", key: "AIza-test", model: "gemini-2.0-flash" }
    });
    expect(fb.provider).toBe("llm");
    expect(fb.engine).toBe("Google Gemini gemini-2.0-flash · your key");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    );
    expect(init.headers.Authorization).toBe("Bearer AIza-test");
    expect(JSON.parse(init.body).model).toBe("gemini-2.0-flash");
    // Hung providers must not pile up server requests.
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never fetches for unknown providers or malformed models", async () => {
    const fetchMock = stubFetch({});
    vi.stubGlobal("fetch", fetchMock);

    const evil = await gradeStage(parkingLot, "clarify", PAYLOAD, {
      config: { provider: "evil", key: "x", model: "gemini-2.0-flash" }
    });
    expect(evil.provider).toBe("static");

    const badModel = await gradeStage(parkingLot, "clarify", PAYLOAD, {
      config: { provider: "gemini", key: "x", model: "not a model!" }
    });
    expect(badModel.provider).toBe("static");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to static when the provider rejects the key", async () => {
    vi.stubGlobal("fetch", stubFetch({}, false));
    const fb = await gradeStage(parkingLot, "clarify", PAYLOAD, {
      config: { provider: "groq", key: "bogus", model: "llama-3.1-8b-instant" }
    });
    expect(fb.provider).toBe("static");
  });

  it("keeps the owner-env path working", async () => {
    process.env.LLM_API_KEY = "owner-key";
    const fetchMock = stubFetch({ choices: [{ message: { content: JSON.stringify(LLM_OK) } }] });
    vi.stubGlobal("fetch", fetchMock);

    const fb = await gradeStage(parkingLot, "clarify", PAYLOAD);
    expect(fb.provider).toBe("llm");
    expect(fb.engine).toBe("Owner model gpt-4o-mini");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("reads fence-wrapped model replies instead of discarding them", async () => {
    const fetchMock = stubFetch({
      choices: [
        { message: { content: "```json\n" + JSON.stringify(LLM_OK) + "\n```" } }
      ]
    });
    vi.stubGlobal("fetch", fetchMock);

    const fb = await gradeStage(parkingLot, "clarify", PAYLOAD, {
      config: { provider: "gemini", key: "AIza-test", model: "gemini-2.0-flash" }
    });
    expect(fb.provider).toBe("llm");
    expect(fb.scores).toEqual({ Completeness: 5 });
    expect(fb.llmError).toBeUndefined();
  });

  it("reports the failure reason on the fallback instead of hiding it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) })
    );
    const fb = await gradeStage(parkingLot, "clarify", PAYLOAD, {
      config: { provider: "gemini", key: "AIza-bad", model: "gemini-2.0-flash" }
    });
    expect(fb.provider).toBe("static");
    expect(fb.llmError).toMatch(/LLM 4\d\d|failed|fetch/i);
  });

  it("names the problem and prior stages in the prompt", async () => {
    const fetchMock = stubFetch({ choices: [{ message: { content: JSON.stringify(LLM_OK) } }] });
    vi.stubGlobal("fetch", fetchMock);

    await gradeStage(parkingLot, "code", "class ParkingLot {}", {
      config: { provider: "openai", key: "sk-test", model: "gpt-4o-mini" },
      history: [{ stage: "objects", verdict: "Decent shape", scores: { Completeness: 3 } }]
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const userMsg = body.messages[1].content as string;
    expect(userMsg).toContain("Parking Lot");
    expect(userMsg).toContain("Decent shape");
    expect(userMsg).toContain("Candidate code submission to grade now");
  });

  it("sanitizes creative model shapes into render-safe strings", async () => {
    const fetchMock = stubFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              scores: { Completeness: "5", Clarity: "high" },
              strengths: ["good", 42, null],
              issues: [{ what: "x" }, "plain string issue", null],
              optimizations: [
                {
                  optimization: "Cache pricing",
                  feasibility: "easy",
                  impact: "high"
                }
              ],
              verdict: null
            })
          }
        }
      ]
    });
    vi.stubGlobal("fetch", fetchMock);

    const fb = await gradeStage(parkingLot, "code", "class ParkingLot {}", {
      config: { provider: "openai", key: "sk-test", model: "gpt-4o-mini" }
    });
    expect(fb.provider).toBe("llm");
    // Every rendered field is a string (or array of strings) — never an object.
    expect(fb.scores).toEqual({ Completeness: 5 });
    expect(fb.strengths).toEqual(["good", "42"]);
    expect(fb.optimizations).toEqual(["Cache pricing — easy — high"]);
    expect(typeof fb.verdict).toBe("string");
    for (const i of fb.issues) {
      expect(typeof i.what).toBe("string");
      expect(typeof i.why).toBe("string");
      expect(typeof i.fix).toBe("string");
    }
    // Nothing renderable was lost: the object content survived as text.
    expect(JSON.stringify(fb)).not.toContain("[object Object]");
  });
});
