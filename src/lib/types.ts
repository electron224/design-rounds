export type Difficulty = "Easy" | "Medium" | "Hard";

export interface LLDResource {
  id: string;
  title: string;
  url: string;
  type: "oops" | "solid" | "pattern" | "article" | "video";
  topic: string;
}

export interface ProblemResourceRef {
  resourceId: string;
  stage: "objects" | "flow" | "code" | "all";
  reason: string;
}

export type Track = "starter" | "core" | "stretch";

export interface FollowUp {
  prompt: string;
  hint: string;
}

export interface ClarifyingQuestion {
  question: string;
  why: string;
}

export interface LLDProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: Difficulty;
  order: number;
  track: Track;
  summary: string;
  functionalRequirements: string[];
  nonGoals: string[];
  constraints: string[];
  timeDefaultMin: number;
  tags: string[];
  patterns: string[];
  solidFocus: string[];
  referenceObjects: { name: string; responsibility: string }[];
  referenceFlow: string[];
  /** Questions a strong candidate asks the interviewer before designing. */
  expectedQuestions: ClarifyingQuestion[];
  /** Model-solution talking points: the decisions a strong answer names. */
  decisions: string[];
  /** Interviewer twists asked after the base design ("requirements changed"). */
  followUps: FollowUp[];
  codeStarter: Record<string, string>;
  resources: ProblemResourceRef[];
}

export type Stage = "clarify" | "objects" | "flow" | "code";

export interface ClassModel {
  name: string;
  attributes: string;
  methods: string;
  /** Legacy: relationships are now drawn in the flow stage, not listed here. */
  relationship: string;
}

export interface FeedbackIssue {
  severity: "info" | "warning" | "critical";
  what: string;
  why: string;
  fix: string;
}

export interface ItemVerdict {
  name: string;
  verdict: "right" | "extra" | "weak";
  note: string;
}

export interface StageFeedback {
  scores: Record<string, number>;
  strengths: string[];
  issues: FeedbackIssue[];
  /** Per-submitted-item right/wrong judgments. */
  itemVerdicts: ItemVerdict[];
  optimizations: string[];
  patternSuggestions: string[];
  resources: { title: string; url: string; reason: string }[];
  verdict: string;
  provider: "llm" | "static";
  /** Human-readable engine, e.g. "Gemini 2.0 Flash · your key". */
  engine?: string;
  /** Set when an AI review was attempted but failed (static shown instead). */
  llmError?: string;
}
