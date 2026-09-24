import { checkCoherence, type CoherenceReport } from "./coherence";
import { sanitizeStageFeedback } from "./safeFeedback";
import { summarizeScene } from "./scene";
import type { FeedbackIssue, StageFeedback } from "./types";

export interface SubmissionRow {
  stage: string;
  feedback: string;
  score: number;
  createdAt: string;
}

export interface AttemptReport {
  attemptId: string;
  problemSlug: string;
  /** Latest score (1–5) per submitted stage. */
  stages: { stage: string; score: number }[];
  /** Overall score out of 10, or null when nothing submitted yet. */
  score10: number | null;
  /** Weakest rubric dimensions averaged across stages. */
  weakestDimensions: { name: string; avg: number }[];
  /** Top deduplicated issues, most severe first. */
  focusAreas: FeedbackIssue[];
  coherence: CoherenceReport | null;
}

/** All stages — unsubmitted ones count as zero in the final score. */
const TOTAL_STAGES = 4;

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  warning: 1,
  info: 2
};

function parseFeedback(raw: string): StageFeedback | null {
  try {
    const fb = JSON.parse(raw) as StageFeedback;
    if (!fb || typeof fb !== "object" || !fb.scores) return null;
    // Stored rows predate sanitization — coerce before anything renders them.
    return sanitizeStageFeedback(fb);
  } catch {
    return null;
  }
}

/**
 * Builds the end-of-problem report: score out of 10 plus where to improve.
 * Pure function — the report page and tests share it. totalStages is 4 for
 * LLD, 5 for HLD; unsubmitted stages always cost.
 */
export function buildReport(
  attemptId: string,
  problemSlug: string,
  submissions: SubmissionRow[],
  drafts: Record<string, unknown> | null,
  totalStages = TOTAL_STAGES
): AttemptReport {
  const latest = new Map<string, { feedback: StageFeedback; score: number }>();
  for (const s of submissions) {
    const fb = parseFeedback(s.feedback);
    if (fb) latest.set(s.stage, { feedback: fb, score: s.score });
  }
  const stages = [...latest.entries()].map(([stage, v]) => ({
    stage,
    score: v.score
  }));
  // Final = earned / possible across ALL stages: skipping a stage costs.
  const score10 =
    stages.length > 0
      ? Math.round(
          (stages.reduce((a, s) => a + s.score, 0) / (totalStages * 5)) * 10 * 10
        ) / 10
      : null;

  const dimSums = new Map<string, { sum: number; n: number }>();
  const issues: FeedbackIssue[] = [];
  for (const { feedback } of latest.values()) {
    for (const [k, v] of Object.entries(feedback.scores ?? {})) {
      const d = dimSums.get(k) ?? { sum: 0, n: 0 };
      d.sum += v;
      d.n += 1;
      dimSums.set(k, d);
    }
    issues.push(...(feedback.issues ?? []));
  }
  const weakestDimensions = [...dimSums.entries()]
    .map(([name, d]) => ({ name, avg: Math.round((d.sum / d.n) * 10) / 10 }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  const seen = new Set<string>();
  const focusAreas = issues
    .sort(
      (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
    )
    .filter((i) => (seen.has(i.what) ? false : (seen.add(i.what), true)))
    .slice(0, 5);

  let coherence: CoherenceReport | null = null;
  try {
    const classes = Array.isArray(drafts?.classes) ? drafts.classes : [];
    const files = Array.isArray(drafts?.files) ? drafts.files : [];
    if (classes.length > 0 || files.length > 0) {
      const flowText =
        drafts?.flowMode === "draw" && Array.isArray(drafts?.scene)
          ? summarizeScene(drafts.scene as object[])
          : typeof drafts?.flow === "string"
            ? drafts.flow
            : "";
      coherence = checkCoherence(
        classes as never,
        flowText,
        files as never
      );
    }
  } catch {
    coherence = null;
  }

  return { attemptId, problemSlug, stages, score10, weakestDimensions, focusAreas, coherence };
}
