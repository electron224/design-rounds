// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

import TimerConfig from "./TimerConfig";

describe("TimerConfig (free-form timer)", () => {
  it("starts with the problem default and navigates with a custom value", () => {
    render(<TimerConfig slug="parking-lot" defaultMin={30} />);
    const input = screen.getByLabelText(/minutes/i) as HTMLInputElement;
    expect(input.value).toBe("30");

    fireEvent.change(input, { target: { value: "22" } });
    fireEvent.click(screen.getByText(/^start practice$/i));
    expect(push).toHaveBeenCalledWith("/practice/parking-lot?t=22");
  });

  it("clamps out-of-range values and supports presets", () => {
    render(<TimerConfig slug="atm" defaultMin={40} />);
    const input = screen.getByLabelText(/minutes/i);
    fireEvent.click(screen.getByText("15m"));
    expect((input as HTMLInputElement).value).toBe("15");

    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.click(screen.getByText(/^start practice$/i));
    expect(push).toHaveBeenCalledWith("/practice/atm?t=240");
  });
});
