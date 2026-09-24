import type { HLDProblem } from "./hld";
import type { StageHistory } from "./prompts";
import type { StageFeedback } from "./types";

export type HldStage =
  | "requirements"
  | "capacity"
  | "api"
  | "diagram"
  | "deepdive";

export const HLD_STAGES: HldStage[] = [
  "requirements",
  "capacity",
  "api",
  "diagram",
  "deepdive"
];

const STOP = new Set(
  "what,how,does,which,should,with,from,when,there,their,about,into,will,are,for,and,the,than,then,that,this,have,has,need,needs,want,you,your,our,system,design,interview,candidate,each,per,requests,using,through,between,under,while,also,such".split(
    ","
  )
);

const contentWords = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9/]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

/** Fraction of the reference's content words present in the payload. */
function coverage(reference: string, text: string): number {
  const ref = contentWords(reference);
  if (ref.length === 0) return 1;
  const words = new Set(text.toLowerCase().split(/[^a-z0-9/]+/));
  const hit = ref.filter((w) => words.has(w)).length;
  return hit / ref.length;
}

function baseScores(): Record<string, number> {
  return {
    Completeness: 3,
    "Scale numbers": 3,
    "Bottleneck analysis": 3,
    Tradeoffs: 3,
    "Edge cases": 2,
    Clarity: 3
  };
}

function floor(): StageFeedback {
  const scores: Record<string, number> = {};
  for (const k of Object.keys(baseScores())) scores[k] = 1;
  return {
    scores,
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
    patternSuggestions: [],
    resources: [],
    itemVerdicts: [],
    verdict: "Nothing to grade yet — submit real work for this stage.",
    provider: "static"
  };
}

/** Static HLD rubric — deterministic checklist grading per solver stage. */
export function hldStaticFeedback(
  problem: HLDProblem,
  stage: HldStage,
  payload: string
): StageFeedback {
  const text = payload.toLowerCase();
  const words = text.split(/[^a-z0-9/]+/).filter((w) => w.length > 2);
  if (words.length < 4) return floor();

  const scores = baseScores();
  const strengths: string[] = [];
  const issues: StageFeedback["issues"] = [];
  const itemVerdicts: StageFeedback["itemVerdicts"] = [];
  const components = problem.components.map((c) => c.name);

  if (stage === "requirements") {
    let sum = 0;
    for (const r of problem.requirements) {
      const cov = coverage(r, text);
      sum += cov;
      if (cov >= 0.4) {
        strengths.push(`Scoped: ${r.slice(0, 80)}`);
        itemVerdicts.push({ name: r.slice(0, 60), verdict: "right", note: "covered" });
      } else {
        itemVerdicts.push({ name: r.slice(0, 60), verdict: "weak", note: "not addressed" });
        issues.push({
          severity: "warning",
          what: `Unscoped requirement: ${r.slice(0, 80)}`,
          why: "Every functional requirement needs an explicit in-scope answer before sizing.",
          fix: "State the requirement and your read of it in one line each."
        });
      }
    }
    scores.Completeness = Math.max(1, Math.round(1 + 4 * (sum / problem.requirements.length)));
  }

  if (stage === "capacity") {
    const nums = [...text.matchAll(/(\d[\d,]*)/g)].map((m) =>
      Number(m[1].replace(/,/g, ""))
    );
    const ref = problem.capacityWorked.rps;
    const ratio = nums.length
      ? Math.min(...nums.map((n) => Math.max(n, ref) / Math.max(1, Math.min(n, ref))))
      : Infinity;
    scores["Scale numbers"] = ratio <= 1.5 ? 5 : ratio <= 2 ? 4 : ratio <= 5 ? 3 : 2;
    if (ratio <= 2) strengths.push("Write estimate lands near the reference scale.");
    else
      issues.push({
        severity: "warning",
        what: `Scale estimate is off (reference: ~${ref}/s writes)`,
        why: "Back-of-envelope numbers drive every later choice — shards, cache, queues.",
        fix: `Show the arithmetic: users × actions / 86400, then reads vs writes. Reference ≈ ${ref} writes/s.`
      });
    const bottleneckTerms = ["cache", "shard", "replica", "queue", "partition", "index"];
    const hits = bottleneckTerms.filter((t) => text.includes(t));
    scores["Bottleneck analysis"] = hits.length >= 2 ? 4 : hits.length === 1 ? 3 : 2;
    if (hits.length === 0)
      issues.push({
        severity: "warning",
        what: "No bottleneck named",
        why: "Capacity without a named bottleneck (cache, shard, single queue) can't size anything.",
        fix: "Name the first thing that breaks as load ×10s, and what absorbs it."
      });
    if (/(tradeoff|instead|versus|failover|async)/.test(text)) scores.Tradeoffs = 4;
  }

  if (stage === "api") {
    const methodLines = text
      .split("\n")
      .filter((l) => /(get|post|put|patch|delete)\b/.test(l)).length;
    const ratio = methodLines / Math.max(1, problem.apis.length);
    scores.Completeness = ratio >= 1 ? 5 : ratio >= 0.66 ? 4 : ratio >= 0.33 ? 3 : 2;
    for (const a of problem.apis) {
      const hit = text.includes(a.path.toLowerCase()) || text.includes(a.method.toLowerCase());
      itemVerdicts.push({
        name: `${a.method} ${a.path}`,
        verdict: hit ? "right" : "weak",
        note: hit ? "sketched" : a.desc
      });
    }
    if (ratio < 0.66)
      issues.push({
        severity: "warning",
        what: "Core APIs missing",
        why: "Reviewers read the API surface as the contract — absent endpoints mean absent flows.",
        fix: `Sketch one line per endpoint: ${problem.apis.map((a) => `${a.method} ${a.path}`).join(", ")}.`
      });
    if (/(429|retry|idempot|pagin|cursor)/.test(text)) scores["Edge cases"] = 4;
  }

  if (stage === "diagram") {
    const edges = (text.match(/(→|->)/g) ?? []).length;
    const need = Math.max(1, problem.flow.length - 1);
    scores.Completeness = edges >= need ? 5 : edges >= need - 1 ? 4 : edges >= 2 ? 3 : 2;
    let named = 0;
    for (const c of problem.components) {
      const hit = text.includes(c.name.toLowerCase());
      if (hit) named++;
      itemVerdicts.push({
        name: c.name,
        verdict: hit ? "right" : "weak",
        note: hit ? c.role : `missing — ${c.role}`
      });
    }
    if (named >= problem.components.length - 1)
      strengths.push("All load-bearing components are on the board.");
    else
      issues.push({
        severity: "warning",
        what: "Components missing from the diagram",
        why: "An unconnected box is a guess the interviewer can't evaluate.",
        fix: `Every hop needs a box: ${components.join(" → ")}.`
      });
  }

  if (stage === "deepdive") {
    let sum = 0;
    for (const d of problem.deepdives) {
      const cov = Math.max(coverage(d.q, text), coverage(d.hint, text));
      sum += cov;
      itemVerdicts.push({
        name: d.q.slice(0, 60),
        verdict: cov >= 0.3 ? "right" : "weak",
        note: cov >= 0.3 ? "engaged" : `Hint: ${d.hint}`
      });
    }
    const avg = sum / problem.deepdives.length;
    scores.Completeness = avg >= 0.5 ? 5 : avg >= 0.3 ? 4 : avg >= 0.15 ? 3 : 2;
    if (avg < 0.3)
      issues.push({
        severity: "warning",
        what: "Twists dodged, not answered",
        why: "Deep-dives test judgment under changed requirements — hand-waving fails them.",
        fix: "Answer each twist with: decision, what breaks, what you watch."
      });
    else strengths.push("Twists met head-on with concrete decisions.");
  }

  const avg =
    Object.values(scores).reduce((a, b) => a + b, 0) /
    Object.values(scores).length;
  const verdict =
    avg >= 4
      ? `Strong ${stage} — reference-grade thinking, defend it out loud.`
      : avg >= 3
        ? `Workable ${stage} — close the warnings below, then resubmit.`
        : `Shaky ${stage} — rework the fundamentals flagged below first.`;

  return {
    scores,
    strengths,
    issues,
    optimizations: [],
    patternSuggestions: components,
    resources: [],
    itemVerdicts,
    verdict,
    provider: "static"
  };
}

const STAGE_HINTS: Record<HldStage, string> = {
  requirements:
    "Focus: did the candidate scope every functional requirement and name non-goals? Reward explicit in/out decisions; penalize skipped requirements.",
  capacity:
    "Focus: back-of-envelope arithmetic (writes/s, reads/s, storage/day), a named bottleneck, and what absorbs 10x. Penalize vibes without numbers.",
  api:
    "Focus: one line per endpoint (method + path + contract), error paths (429/404), pagination/idempotency. Penalize missing core endpoints.",
  diagram:
    "Focus: every hop has a box, request path is traceable, cache/DB roles are explicit, single points of failure named.",
  deepdive:
    "Focus: each twist gets a decision + what breaks + what to watch. Reward concrete tradeoffs; penalize hand-waving."
};

/** HLD interviewer prompt — same JSON contract as the LLD one. */
export function buildHldPrompt(
  problem: HLDProblem,
  stage: HldStage,
  payload: string,
  history: StageHistory[] = []
): { system: string; user: string } {
  const ref = JSON.stringify(
    {
      requirements: problem.requirements,
      nonGoals: problem.nonGoals,
      capacityWorked: problem.capacityWorked,
      apis: problem.apis,
      flow: problem.flow,
      components: problem.components,
      deepdives: problem.deepdives,
      decisions: problem.decisions
    },
    null,
    2
  );
  const system =
    `You are a strict High Level Design interviewer. Review ONLY the ${stage} stage. Score 1-5 on: Completeness, Scale numbers, Bottleneck analysis, Tradeoffs, Edge cases, Clarity. Be concrete: cite the missing numbers, the unnamed bottleneck, the unmade tradeoff. Always answer: "What breaks first at 10x?" with the component + why. Return JSON only with keys: scores, strengths[], issues[{severity,what,why,fix}], itemVerdicts[{name,verdict,note}], optimizations[], patternSuggestions[], verdict. ` +
    STAGE_HINTS[stage];
  return {
    system,
    user:
      `Problem: ${problem.title} — ${problem.summary}\n` +
      `Reference (hidden from candidate):\n${ref}\n` +
      (history.length > 0
        ? `\nCandidate's earlier stages this attempt (judge coherence with them):\n${history
            .map(
              (h) =>
                `- ${h.stage}: verdict "${h.verdict}" scores ${JSON.stringify(h.scores)}`
            )
            .join("\n")}\n`
        : "") +
      `\nCandidate ${stage} submission to grade now:\n${payload.slice(0, 12000)}`
  };
}
