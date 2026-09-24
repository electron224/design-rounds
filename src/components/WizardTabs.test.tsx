// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import WizardTabs from "./WizardTabs";

afterEach(() => cleanup());

const tabs = [
  { id: "clarify", index: 0, label: "Clarify", done: true },
  { id: "objects", index: 1, label: "Entities", done: false },
];

describe("WizardTabs", () => {
  it("marks the active step and completed tabs", () => {
    render(<WizardTabs tabs={tabs} active="objects" onSelect={() => {}} next={null} />);
    expect(screen.getByText(/1\. Entities/)).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/0\. Clarify/)).not.toHaveAttribute("aria-current");
    expect(screen.getByText(/✓/)).toBeInTheDocument();
  });

  it("selects tabs and advances via Next", () => {
    const onSelect = vi.fn();
    const onNext = vi.fn();
    render(
      <WizardTabs
        tabs={tabs}
        active="clarify"
        onSelect={onSelect}
        next={{ label: "Entities", onNext }}
      />
    );
    fireEvent.click(screen.getByText(/1\. Entities/));
    expect(onSelect).toHaveBeenCalledWith("objects");
    fireEvent.click(screen.getByText(/Next: Entities/));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("hides Next when there is no next stage", () => {
    render(<WizardTabs tabs={tabs} active="objects" onSelect={() => {}} next={null} />);
    expect(screen.queryByText(/Next:/)).not.toBeInTheDocument();
  });
});
