// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import StrategySim from "./StrategySim";
import ObserverSim from "./ObserverSim";
import StateSim from "./StateSim";
import DecoratorSim from "./DecoratorSim";

afterEach(() => cleanup());

describe("pattern sims", () => {
  it("Strategy: swapping pricing moves the total, caller untouched", () => {
    render(<StrategySim />);
    const total = () => screen.getByTestId("strat-total").textContent;
    const flat = total();
    fireEvent.click(screen.getByText("Weekend"));
    expect(total()).not.toBe(flat);
    fireEvent.change(screen.getByLabelText(/minutes parked/i), {
      target: { value: "60" },
    });
    expect(screen.getByTestId("strat-mins").textContent).toMatch(/60/);
  });

  it("Observer: votes cascade into reputation + log", () => {
    render(<ObserverSim />);
    const rep = () => screen.getByTestId("obs-rep").textContent;
    const before = rep();
    fireEvent.click(screen.getByText(/answer ↑/i));
    expect(rep()).not.toBe(before);
    expect(screen.getByTestId("obs-log").textContent).toMatch(/ReputationService/);
  });

  it("State: seat walks FREE→HELD→BOOKED with a visible trail", () => {
    render(<StateSim />);
    fireEvent.click(screen.getByText(/hold/i));
    fireEvent.click(screen.getByText(/confirm payment/i));
    expect(screen.getByTestId("state-trail").textContent).toMatch(
      /FREE → HELD → BOOKED/
    );
  });

  it("Decorator: promo layers stack onto the fare", () => {
    render(<DecoratorSim />);
    const total = () => screen.getByTestId("deco-total").textContent;
    const withStudent = total();
    fireEvent.click(screen.getByText(/coupon/i));
    expect(total()).not.toBe(withStudent);
    expect(screen.getByTestId("deco-stack").textContent).toMatch(/Coupon/);
  });
});
