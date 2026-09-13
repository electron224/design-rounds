import { buildPrompt, type StageHistory } from "./prompts";
import { sanitizeStageFeedback } from "./safeFeedback";
import { staticFeedback } from "./feedback";
import { isValidModel, providerById } from "./providers";
import type { LLDProblem, Stage, StageFeedback } from "./types";

export interface LlmRequestConfig {
  provider: string;
  key: string;
  model: string;
}

/**
 * Pulls the JSON object out of a model reply. Models (Gemini especially)
 * wrap JSON in ```json fences despite "return JSON only" instructions.
 */
export function extractJson(raw: string): unknown {
  const unfenced = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "");
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(unfenced.slice(start, end + 1));
    throw new Error("No JSON object in model reply");
  }
}

/**
 * LLM abstraction, two ways on:
 * 1. Candidate key (BYOK): validated against the provider allowlist —
 *    unknown providers or malformed models fall back to static, and the
 *    endpoint URL always comes from our table, never the client (no SSRF).
 * 2. Owner env (LLM_API_KEY / LLM_BASE_URL, e.g. local Ollama needs no key).
 * Calls an OpenAI-compatible chat-completions endpoint; any failure falls
 * back to the deterministic static rubric. Keys are never logged or stored.
 */
export async function gradeStage(
  problem: LLDProblem,
  stage: Stage,
  payload: string,
  opts?: { config?: LlmRequestConfig; history?: StageHistory[] }
): Promise<StageFeedback> {
  let base: string;
  let model: string;
  let key: string | undefined;
  let engine: string;

  const cfg = opts?.config;
  if (cfg?.key?.trim()) {
    const provider = providerById(cfg.provider);
    const chosen = cfg.model?.trim() ?? "";
    if (!provider || !isValidModel(chosen)) {
      return staticFeedback(problem, stage, payload);
    }
    base = provider.baseUrl;
    model = chosen;
    key = cfg.key.trim();
    engine = `${provider.label} ${model} · your key`;
  } else {
    key = process.env.LLM_API_KEY?.trim();
    base = (process.env.LLM_BASE_URL ?? "https://api.openai.com/v1").replace(
      /\/+$/,
      ""
    );
    const hasCustomBase =
      (process.env.LLM_BASE_URL ?? "") !== "" &&
      process.env.LLM_BASE_URL !== "https://api.openai.com/v1";
    if (!key && !hasCustomBase) return staticFeedback(problem, stage, payload);
    model = process.env.LLM_MODEL ?? "gpt-4o-mini";
    engine = `Owner model ${model}`;
  }

  try {
    const { system, user } = buildPrompt(problem, stage, payload, opts?.history ?? []);
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers,
      // Hung providers must not pile up server requests behind them.
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = extractJson(raw);
    const fb = sanitizeStageFeedback(parsed);
    return {
      ...fb,
      patternSuggestions: fb.patternSuggestions.length
        ? fb.patternSuggestions
        : [...problem.patterns],
      provider: "llm" as const,
      engine
    };
  } catch (e) {
    // Visible in the server terminal so a misconfigured provider (bad key,
    // wrong model/base URL) is diagnosable instead of silently static.
    // Never includes the key — only the status/message.
    const message = e instanceof Error ? e.message : String(e);
    console.error("[feedback:llm]", message);
    // Surfaced to the candidate too: a failed AI review must not look
    // identical to "no key configured".
    return { ...staticFeedback(problem, stage, payload), llmError: message };
  }
}
