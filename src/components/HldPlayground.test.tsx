// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import HldPlayground from "./HldPlayground";

afterEach(() => cleanup());

describe("HldPlayground sliders", () => {
  it("moving the RPS slider updates DB load live", () => {
    render(<HldPlayground defaultRps={1000} />);
    const dbLoad = () => screen.getByTestId("db-load").textContent;
    const before = dbLoad();
    const rps = screen.getByLabelText(/traffic/i);
    fireEvent.change(rps, { target: { value: "5000" } });
    expect(dbLoad()).not.toBe(before);
    expect(dbLoad()).toMatch(/rps/);
  });

  it("moving cache-hit updates DB load in the opposite direction", () => {
    render(<HldPlayground defaultRps={5000} />);
    const dbLoad = () => screen.getByTestId("db-load").textContent;
    const hit = screen.getByLabelText(/cache hit/i);
    fireEvent.change(hit, { target: { value: "0" } });
    const high = dbLoad();
    fireEvent.change(hit, { target: { value: "0.95" } });
    expect(dbLoad()).not.toBe(high);
  });
});
