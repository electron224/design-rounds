import { resourceById } from "./resources";
import type { LLDProblem, Stage, StageFeedback } from "./types";

/** Static rubric fallback — used when no LLM key is configured. Deterministic and useful. */
export function staticFeedback(
  problem: LLDProblem,
  stage: Stage,
  payload: string
): StageFeedback {
  const text = payload.toLowerCase();
  const strengths: string[] = [];
  const issues: StageFeedback["issues"] = [];
  const itemVerdicts: StageFeedback["itemVerdicts"] = [];
  const optimizations: string[] = [];
  const patternSuggestions: string[] = [...problem.patterns];
  const scores: Record<string, number> = {
    Completeness: 3,
    Extensibility: 3,
    "SOLID adherence": 3,
    "Pattern use": 3,
    "Edge cases": 2,
    Clarity: 3
  };
  // Stages with their own verdict voice (default: the generic ladder below).
  let verdictOverride: string | null = null;

  const resources = problem.resources.slice(0, 4).map((r) => {
    const full = resourceById(r.resourceId);
    return {
      title: full?.title ?? r.resourceId,
      url: full?.url ?? "#",
      reason: r.reason
    };
  });

  // Honesty floor: near-empty submissions score 1s, not averages.
  // ("[]" or a lone class name previously averaged to ~5/10.)
  // Clarify answers are sentences, so its bar is lower than artifact stages.
  const words = text.split(/[^a-z]+/).filter((w) => w.length > 2);
  if (words.length < (stage === "clarify" ? 2 : 4)) {
    const flat: Record<string, number> = {};
    for (const k of Object.keys(scores)) flat[k] = 1;
    return {
      scores: flat,
      strengths: [],
      issues: [
        {
          severity: "critical",
          what: "Nothing substantial submitted",
          why: "An empty (or near-empty) submission can't be reviewed.",
          fix: "Complete the stage with real content, then resubmit."
        }
      ],
      optimizations: [],
      patternSuggestions: [...problem.patterns],
      resources,
      itemVerdicts: [],
      verdict: "Nothing to grade yet — submit real work for this stage.",
      provider: "static"
    };
  }

  if (stage === "clarify") {
    const STOP = new Set(
      "what,how,does,which,should,with,from,when,there,their,about,into,will,are,for,and,the,than,then,that,this,have,has,need,needs,want,you,your,our,system,design,interview,candidate".split(
        ","
      )
    );
    const contentWords = (s: string) =>
      s
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 3 && !STOP.has(w));
    const asked = new Set(contentWords(payload));
    // Weighted match: an exact word hit counts 2, a substring hit 1.
    // A single sharp word ("park", "pricing") can cover a question.
    const scoreKeys = (keys: string[]) =>
      keys.reduce(
        (acc, k) =>
          acc + (asked.has(k) ? 2 : [...asked].some((a) => a.includes(k) || k.includes(a)) ? 1 : 0),
        0
      );
    const uncovered = problem.expectedQuestions.filter(
      (q) => scoreKeys(contentWords(q.question)) < 2
    );
    const coveredCount = problem.expectedQuestions.length - uncovered.length;

    // Credit valid questions outside our list: lines hitting the problem's
    // domain vocabulary (requirements, title, tags, class names) or generic
    // clarification intents (users, scope, scale, …).
    const domain = new Set(
      contentWords(
        [
          problem.title,
          problem.functionalRequirements.join(" "),
          problem.tags.join(" "),
          problem.patterns.join(" "),
          problem.referenceObjects.map((o) => o.name).join(" ")
        ].join(" ")
      )
    );
    const INTENTS = new Set(
      "user,users,actor,actors,scope,outofscope,scale,traffic,concurrent,concurrency,peak,limit,limits,capacity,assumption,assumptions,constraint,constraints,clarif,ambiguous,ambiguity,many,much,often,peak".split(
        ","
      )
    );
    const vocabHit = (w: string, vocab: Set<string>) =>
      vocab.has(w) || [...vocab].some((v) => v.includes(w) || w.includes(v));
    const lines = payload
      .split("\n")
      .map((l) => l.trim().replace(/\s+/g, " "))
      .filter((l) => contentWords(l).length > 0);
    const recognized = lines.filter((l) =>
      contentWords(l).some((w) => vocabHit(w, domain) || vocabHit(w, INTENTS))
    );
    scores.Completeness = Math.max(
      1,
      Math.min(
        5,
        Math.max(
          Math.round((coveredCount / problem.expectedQuestions.length) * 5),
          Math.min(5, recognized.length + 1)
        )
      )
    );
    if (coveredCount > 0)
      strengths.push(
        `Asked ${coveredCount}/${problem.expectedQuestions.length} key questions.`
      );
    for (const line of recognized.slice(0, 2)) {
      const short =
        line.length > 100 ? line.slice(0, 100).trimEnd() + "…" : line;
      strengths.push(`Sharp scope probe: "${short}"`);
    }
    verdictOverride =
      uncovered.length === 0
        ? "Strong — carry these answers into Stage 1."
        : coveredCount > 0 || recognized.length > 0
          ? "Good instincts — ask the missing ones above too, then design."
          : "Ask what changes the design: users, scope, scale, ambiguities.";
    for (const q of uncovered.slice(0, 3)) {
      issues.push({
        severity: "warning",
        what: `Didn't ask: "${q.question}"`,
        why: q.why,
        fix: "Ask this before designing — the answer changes classes, flows, or scope."
      });
    }
    optimizations.push(
      uncovered.length === 0
        ? "Strong — carry these answers into Stage 1 (e.g. note scope decisions on your classes)."
        : "Can it be optimized? Yes — two sharp scope questions beat ten vague ones; ask what changes the design."
    );
  }

  if (stage === "objects") {
    const names = problem.referenceObjects.map((o) => o.name.toLowerCase());
    const found = names.filter((n) => text.includes(n.split(/[^a-z]/)[0]));
    const missing = problem.referenceObjects.filter(
      (_, i) => !found.includes(names[i])
    );
    scores.Completeness = Math.max(
      1,
      Math.min(5, Math.round((found.length / names.length) * 5))
    );
    if (found.length > 0)
      strengths.push(`Covered ${found.length}/${names.length} expected concepts.`);
    for (const m of missing.slice(0, 4)) {
      issues.push({
        severity: "warning",
        what: `Missing concept: ${m.name}`,
        why: m.responsibility,
        fix: `Add a ${m.name} class owning: ${m.responsibility}.`
      });
    }
    // Per-submitted-class verdicts: right (matches reference), extra (justify
    // or merge), weak (named but hollow — no attributes AND no methods).
    try {
      const submitted = JSON.parse(payload) as {
        name?: string;
        attributes?: string;
        methods?: string;
      }[];
      if (Array.isArray(submitted)) {
        const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
        for (const c of submitted.slice(0, 12)) {
          const rawName = typeof c?.name === "string" ? c.name.trim() : "";
          if (!rawName) continue;
          const key = norm(rawName);
          if (!key) continue;
          const match = problem.referenceObjects.find((o) =>
            norm(o.name).includes(key) || key.includes(norm(o.name).split(/[^a-z]/)[0] || key)
          );
          if (match) {
            itemVerdicts.push({
              name: rawName,
              verdict: "right",
              note: `Matches expected ${match.name} — ${match.responsibility}.`
            });
          } else {
            const hollow =
              !(typeof c.attributes === "string" && c.attributes.trim()) &&
              !(typeof c.methods === "string" && c.methods.trim());
            itemVerdicts.push({
              name: rawName,
              verdict: hollow ? "weak" : "extra",
              note: hollow
                ? "Named but hollow — give it attributes/methods or drop it."
                : "Not in the reference — justify it in your flow or merge it into a core entity."
            });
          }
        }
      }
    } catch {
      /* non-JSON payload: concept-level feedback above still applies */
    }
    if (!/strateg|polic|pricing|dispatch|split/i.test(payload))
      issues.push({
        severity: "critical",
        what: "Varying behavior is likely hardcoded",
        why: `This problem expects ${problem.patterns.join(", ")} — hardcoding violates OCP.`,
        fix: `Extract an interface (e.g. ${problem.patterns[0]}) and inject implementations.`
      });
    if (!/interface|abstract|extends|implements/i.test(payload))
      issues.push({
        severity: "info",
        what: "No abstraction visible",
        why: "DIP: high-level modules should depend on abstractions.",
        fix: "Introduce at least one interface for the varying part and depend on it."
      });
    optimizations.push(
      `Can it be optimized? ${missing.length === 0 ? "Mostly — now harden OCP: add a new type (e.g. new vehicle/split/pricing) without editing core classes." : "Yes — add the missing concepts above first, then split any fat class (SRP) and extract the Strategy."}`
    );
  }

  if (stage === "flow") {
    const steps = problem.referenceFlow;
    const covered = steps.filter((s) =>
      text.includes(s.split(" ")[1]?.toLowerCase() ?? "→")
    );
    scores.Completeness = Math.max(2, Math.min(5, 2 + covered.length));
    if (!/error|fail|full|invalid|expire|retry|lock/i.test(payload))
      issues.push({
        severity: "critical",
        what: "No error / alternate flows",
        why: "Interviewers fail designs with only the happy path.",
        fix: `Model: ${steps.slice(-1)[0]} plus full/invalid/expire branches.`
      });
    else strengths.push("Error branches considered.");
    if (!/sequence|->|-->|tick|state/i.test(payload))
      issues.push({
        severity: "warning",
        what: "Flow ordering unclear",
        why: "A sequence diagram (Mermaid) makes ordering reviewable.",
        fix: "Rewrite as sequenceDiagram with actors and numbered steps."
      });
    optimizations.push(
      "Can it be optimized? Yes if concurrency/state is vague — add per-resource locks (e.g. per-show/per-floor) and explicit state transitions."
    );
  }

  if (stage === "code") {
    // Starter template submitted unchanged: not a design, score it as one.
    const squashed = payload.replace(/\s+/g, "");
    const isStarter = Object.values(problem.codeStarter)
      .filter((s) => s && s.length > 50)
      .some((s) => {
        const n = s.replace(/\s+/g, "");
        return squashed.includes(n) && squashed.length < n.length * 1.5;
      });
    if (isStarter) {
      scores.Completeness = 1;
      issues.push({
        severity: "critical",
        what: "Code is still the starter template",
        why: "No design decisions of your own are visible.",
        fix: "Replace the TODOs with your classes from Stage 1, then resubmit."
      });
    }
    if (!/class |interface /i.test(payload))
      issues.push({
        severity: "critical",
        what: "No classes found",
        why: "LLD code stage must show class structure.",
        fix: "Define classes from your Stage-1 model with attributes + methods."
      });
    else strengths.push("Class structure present.");
    if (!new RegExp(problem.patterns[0], "i").test(payload))
      issues.push({
        severity: "warning",
        what: `${problem.patterns[0]} pattern not visible in code`,
        why: "Expected pattern from reference solution is missing.",
        fix: `Add the ${problem.patterns[0]} interface + 2 implementations and inject it.`
      });
    if (/switch\s*\(.*type|if\s*\(.*instanceof/i.test(payload))
      issues.push({
        severity: "warning",
        what: "Type-switching on kind",
        why: "Violates OCP — every new type edits this branch.",
        fix: "Replace with polymorphism (subclass or Strategy per type)."
      });
    optimizations.push(
      "Can it be optimized? Check OCP: adding one new requirement (new type/strategy) should need zero edits to core classes — only new files."
    );
    scores["Edge cases"] = /null|empty|full|invalid|throw|exception|error/i.test(payload) ? 4 : 2;
  }

  const avg =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    Object.values(scores).length;

  return {
    scores,
    strengths: strengths.length ? strengths : ["Clear attempt — keep iterating."],
    issues: issues.slice(0, 6),
    itemVerdicts: itemVerdicts.slice(0, 12),
    optimizations,
    patternSuggestions,
    resources,
    verdict:
      verdictOverride ??
      (avg >= 4
        ? "Strong — extend with one harder requirement (concurrency/new type) next."
        : avg >= 3
          ? "Decent shape — fix the critical issue(s) above, then re-submit."
          : "Needs restructuring — revisit objects/flows before polishing code."),
    provider: "static"
  };
}
