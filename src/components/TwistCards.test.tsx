// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import TwistCards from "./TwistCards";

afterEach(() => cleanup());

const twists = [
  { prompt: "Add hourly pricing.", hint: "New Strategy class." },
  { prompt: "Handle concurrency.", hint: "Per-floor lock." },
];

describe("TwistCards", () => {
  it("shows prompts with hints tucked inside", () => {
    render(<TwistCards twists={twists} />);
    expect(screen.getByText(/Twist 1: Add hourly pricing/)).toBeInTheDocument();
    expect(screen.getByText(/Twist 2: Handle concurrency/)).toBeInTheDocument();
    // Hints render inside collapsed details — present, not shouting.
    expect(screen.getByText(/New Strategy class/)).toBeInTheDocument();
  });
});
