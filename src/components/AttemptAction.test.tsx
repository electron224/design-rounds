// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AttemptAction from "./AttemptAction";
import { touchAttempt } from "@/lib/attemptIndex";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(cleanup);

describe("AttemptAction", () => {
  it("offers Start when nothing was attempted", () => {
    render(<AttemptAction slug="atm" timerMin={40} serverAttempt={null} />);
    expect(screen.getByText("Start")).toHaveAttribute(
      "href",
      "/practice/atm?t=40"
    );
  });

  it("offers Resume for an in-progress server attempt", () => {
    render(
      <AttemptAction
        slug="atm"
        timerMin={40}
        serverAttempt={{ id: "abc", status: "in_progress" }}
      />
    );
    expect(screen.getByText("Resume")).toHaveAttribute(
      "href",
      "/practice/atm?attempt=abc&t=40"
    );
  });

  it("offers Review for a finished attempt plus retake", () => {
    render(
      <AttemptAction
        slug="atm"
        timerMin={40}
        serverAttempt={{ id: "abc", status: "finished" }}
      />
    );
    expect(screen.getByText("Review score")).toHaveAttribute(
      "href",
      "/report/abc"
    );
  });

  it("resumes guest attempts from the browser index", () => {
    touchAttempt("guest-1", "atm");
    render(<AttemptAction slug="atm" timerMin={40} serverAttempt={null} />);
    expect(screen.getByText("Resume")).toHaveAttribute(
      "href",
      "/practice/atm?attempt=guest-1&t=40"
    );
  });

  it("renders nothing fresh when hideWhenFresh", () => {
    const { container } = render(
      <AttemptAction slug="atm" timerMin={40} serverAttempt={null} hideWhenFresh />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
