import type { LLDProblem, Stage } from "./types";

export interface StageHistory {
  stage: string;
  verdict: string;
  scores: Record<string, number>;
}

export function buildPrompt(
  problem: LLDProblem,
  stage: Stage,
  payload: string,
  history: StageHistory[] = []
): { system: string; user: string } {
  const ref = JSON.stringify(
    {
      referenceObjects: problem.referenceObjects,
      referenceFlow: problem.referenceFlow,
      patterns: problem.patterns,
      solidFocus: problem.solidFocus,
      expectedQuestions: problem.expectedQuestions,
      requirements: problem.functionalRequirements,
      nonGoals: problem.nonGoals,
      constraints: problem.constraints
    },
    null,
    2
  );

  const base = `You are a strict Low Level Design interviewer. Review ONLY the ${stage} stage. Score 1-5 on: Completeness, Extensibility, SOLID adherence, Correct pattern use, Edge cases, Clarity. Be concrete: name the missing classes/methods/flows, cite the violated SOLID principle, suggest the exact pattern fix. Judge EVERY submitted item individually in itemVerdicts[] as right (belongs, say why), extra (not needed — say what to merge it into), or weak (hollow — say what it must own). Always answer: "Can it be optimized?" with yes/no + how. Return JSON only with keys: scores, strengths[], issues[{severity,what,why,fix}], itemVerdicts[{name,verdict,note}], optimizations[], patternSuggestions[], verdict.`;

  const stageHints: Record<Stage, string> = {
    clarify:
      "Focus: did the candidate ask about users, scope boundaries, scale/concurrency, and ambiguous requirements before designing? Reward questions that would change the design; penalize jumping straight to classes.",
    objects:
      "Focus: nouns→classes, fat-class SRP splits, inheritance vs composition, missing abstractions (Ticket/Strategy/Factory), relationships.",
    flow:
      "Focus: sequence correctness vs requirements, alt/error flows (full/invalid/expire), concurrency notes, state transitions.",
    code:
      "Focus: SOLID violations in code, pattern misuse, OCP/DIP opportunities, naming, what breaks if requirements change (new type/strategy)."
  };

  return {
    system: base + " " + stageHints[stage],
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
