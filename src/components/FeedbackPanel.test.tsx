// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);
import FeedbackPanel from "./FeedbackPanel";
import type { StageFeedback } from "@/lib/types";

describe("FeedbackPanel", () => {
  it("shows an empty state before any submission", () => {
    render(<FeedbackPanel feedback={null} />);
    expect(screen.getByText(/submit a stage/i)).toBeInTheDocument();
  });

  it("renders scores, verdict, issues and resources", () => {
    const fb: StageFeedback = {
      scores: { Completeness: 4 },
      strengths: ["Nice SRP split"],
      issues: [
        { severity: "warning", what: "Missing Ticket", why: "needed", fix: "add it" }
      ],
      itemVerdicts: [],
      optimizations: ["Extract pricing strategy"],
      patternSuggestions: ["Strategy"],
      resources: [{ title: "Strategy 101", url: "https://example.com", reason: "why" }],
      verdict: "Almost there",
      provider: "static"
    };
    render(<FeedbackPanel feedback={fb} />);
    expect(screen.getByText("Almost there")).toBeInTheDocument();
    expect(screen.getByText(/Completeness/)).toBeInTheDocument();
    expect(screen.getByText("Missing Ticket")).toBeInTheDocument();
    expect(screen.getByText("Strategy 101")).toHaveAttribute("href", "https://example.com");
  });

  it("renders per-item right/wrong verdicts", () => {
    render(
      <FeedbackPanel
        feedback={{
          scores: {},
          strengths: [],
          issues: [],
          itemVerdicts: [
            { name: "Ticket", verdict: "right", note: "Matches expected Ticket." },
            { name: "Spaceship", verdict: "extra", note: "Justify or merge." }
          ],
          optimizations: [],
          patternSuggestions: [],
          resources: [],
          verdict: "v",
          provider: "static"
        }}
      />
    );
    expect(screen.getByText("Your items — right or wrong?")).toBeInTheDocument();
    expect(screen.getByText("✓ right")).toBeInTheDocument();
    expect(screen.getByText("? extra")).toBeInTheDocument();
    expect(screen.getByText("Ticket")).toBeInTheDocument();
  });

  it("shows the engine and surfaces failed AI reviews", () => {
    render(
      <FeedbackPanel
        feedback={{
          scores: {},
          strengths: [],
          issues: [],
          itemVerdicts: [],
          optimizations: [],
          patternSuggestions: [],
          resources: [],
          verdict: "v",
          provider: "llm",
          engine: "Google Gemini gemini-2.0-flash · your key"
        }}
      />
    );
    expect(screen.getByText(/via Google Gemini/)).toBeInTheDocument();

    cleanup();
    render(
      <FeedbackPanel
        feedback={{
          scores: {},
          strengths: [],
          issues: [],
          itemVerdicts: [],
          optimizations: [],
          patternSuggestions: [],
          resources: [],
          verdict: "v",
          provider: "static",
          llmError: "LLM 400"
        }}
      />
    );
    expect(screen.getByText(/AI review failed \(LLM 400\)/)).toBeInTheDocument();
  });

  it("nudges toward a key on plain static feedback, not on AI reviews", () => {
    const base = {
      scores: {},
      strengths: [] as string[],
      issues: [] as never[],
      itemVerdicts: [] as never[],
      optimizations: [] as string[],
      patternSuggestions: [] as string[],
      resources: [] as never[],
      verdict: "v"
    };
    render(<FeedbackPanel feedback={{ ...base, provider: "static" }} />);
    expect(screen.getByText(/static rubric.*no AI reasoning/i)).toBeInTheDocument();

    cleanup();
    render(
      <FeedbackPanel
        feedback={{ ...base, provider: "llm", engine: "Groq x · your key" }}
      />
    );
    expect(screen.queryByText(/no AI reasoning/i)).not.toBeInTheDocument();

    cleanup();
    render(
      <FeedbackPanel
        feedback={{ ...base, provider: "static", llmError: "LLM 400" }}
      />
    );
    // Failed-review banner owns this case — no double nudge.
    expect(screen.queryByText(/no AI reasoning/i)).not.toBeInTheDocument();
  });
});
