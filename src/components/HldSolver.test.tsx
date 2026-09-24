// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HldSolver from "./HldSolver";
import { hldBySlug } from "@/lib/hld";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const problem = hldBySlug("url-shortener")!;

describe("HldSolver review", () => {
  it("submits requirements and renders the graded feedback", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === "string" && url.endsWith("/api/keys")) {
        return Promise.resolve({ ok: false, json: async () => null });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          feedback: {
            scores: { Completeness: 5 },
            strengths: ["s"],
            issues: [],
            itemVerdicts: [],
            optimizations: [],
            patternSuggestions: [],
            resources: [],
            verdict: "Strong requirements",
            provider: "static"
          },
          attemptId: "att-1"
        })
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<HldSolver problem={problem} />);
    // Check every requirement, then submit.
    for (const r of problem.requirements) {
      fireEvent.click(screen.getByText(r, { exact: false }));
    }
    fireEvent.click(screen.getByText(/submit requirements for review/i));
    expect(await screen.findByText("Strong requirements")).toBeInTheDocument();
    const posted = (fetchMock.mock.calls as unknown[][]).find(
      (c) => (c[1] as RequestInit | undefined)?.method === "POST"
    );
    expect(JSON.parse(String((posted![1] as RequestInit).body))).toMatchObject({
      slug: "url-shortener",
      stage: "requirements"
    });
    expect(await screen.findByText(/attempt report/i)).toBeInTheDocument();
  });
});
