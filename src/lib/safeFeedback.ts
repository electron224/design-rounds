import type { StageFeedback } from "./types";

/**
 * Single choke point for anything shaped like feedback entering React —
 * fresh model replies, restored SQLite rows, anywhere. Model output and
 * stored history are both untrusted: a creative reply (objects where strings
 * belong, scores as words, missing keys) degrades gracefully instead of
 * crashing the panel with "Objects are not valid as a React child".
 */
function asText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v !== null && typeof v === "object") {
    const parts = Object.values(v).filter(
      (p): p is string => typeof p === "string" && p.length > 0
    );
    if (parts.length > 0) return parts.join(" — ");
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return v === null || v === undefined ? "" : String(v);
}

const asTextList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).map(asText).filter((s) => s.length > 0);

const SEVERITIES = new Set(["info", "warning", "critical"]);
const VERDICTS = new Set(["right", "extra", "weak"]);

export function sanitizeStageFeedback(input: unknown): StageFeedback {
  const p = (input ?? {}) as Record<string, unknown>;
  const scores: Record<string, number> = {};
  if (p.scores !== null && typeof p.scores === "object") {
    for (const [k, v] of Object.entries(p.scores as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n)) scores[k] = Math.min(5, Math.max(1, Math.round(n)));
    }
  }
  const issues = (Array.isArray(p.issues) ? p.issues : []).map((it) => {
    const o = (it ?? {}) as Record<string, unknown>;
    const severity =
      typeof o.severity === "string" && SEVERITIES.has(o.severity)
        ? (o.severity as "info" | "warning" | "critical")
        : "info";
    return {
      severity,
      what: asText(o.what) || "Untitled issue",
      why: asText(o.why),
      fix: asText(o.fix)
    };
  });
  const resources = (Array.isArray(p.resources) ? p.resources : []).map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      title: asText(o.title) || "Resource",
      url: typeof o.url === "string" ? o.url : "#",
      reason: asText(o.reason)
    };
  });
  const itemVerdicts = (Array.isArray(p.itemVerdicts) ? p.itemVerdicts : []).map(
    (it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      const verdict =
        typeof o.verdict === "string" && VERDICTS.has(o.verdict)
          ? (o.verdict as "right" | "extra" | "weak")
          : "extra";
      return {
        name: asText(o.name) || "Untitled",
        verdict,
        note: asText(o.note)
      };
    }
  );
  return {
    scores,
    strengths: asTextList(p.strengths),
    issues,
    itemVerdicts: itemVerdicts.slice(0, 20),
    optimizations: asTextList(p.optimizations),
    patternSuggestions: asTextList(p.patternSuggestions),
    resources,
    verdict: asText(p.verdict) || "See issues above.",
    provider: p.provider === "llm" ? "llm" : "static",
    ...(typeof p.engine === "string" ? { engine: p.engine } : {}),
    ...(typeof p.llmError === "string" ? { llmError: p.llmError } : {})
  };
}
