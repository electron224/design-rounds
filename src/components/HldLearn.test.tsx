// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import HldLearn, { concurrency, nextSim, speedBucket, type SimState } from "./HldLearn";
import { hldBySlug } from "@/lib/hld";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const problem = hldBySlug("url-shortener")!;
const steps = problem.flow;
const branch = steps.findIndex((s) => s.id === "cache");

const base: SimState = {
  vals: { rps: 5000, cacheHit: 0.8, shards: 4 },
  packets: [],
  log: [],
  flash: null,
  seq: 1,
};

describe("nextSim pure transition", () => {
  it("spawns a packet on an empty tick", () => {
    const n = nextSim(base, 0.5, steps, branch);
    expect(n.packets).toHaveLength(1);
    expect(n.packets[0].step).toBe(0);
  });

  it("advances hops without logging", () => {
    const n = nextSim({ ...base, packets: [{ id: 1, step: 0, kind: "fly" }], seq: 2 }, 0.5, steps, branch);
    expect(n.packets.map((p) => p.step)).toEqual([1]);
    expect(n.log).toHaveLength(0);
  });

  it("short-circuits on cache hit with a HIT log", () => {
    const s: SimState = {
      ...base,
      packets: [{ id: 1, step: branch - 1, kind: "fly" }],
      seq: 2,
    };
    const n = nextSim(s, 0.01, steps, branch);
    expect(n.flash).toEqual({ idx: branch, kind: "hit" });
    expect(n.log.join()).toMatch(/HIT/);
    // dropped packet replaced by a fresh spawn only
    expect(n.packets.every((p) => p.step === 0)).toBe(true);
  });

  it("continues through on a miss, then logs MISS at completion", () => {
    const s: SimState = {
      ...base,
      packets: [{ id: 1, step: branch - 1, kind: "fly" }],
      seq: 2,
    };
    let n = nextSim(s, 0.99, steps, branch);
    expect(n.flash).toEqual({ idx: branch, kind: "miss" });
    // run to completion (miss never short-circuits)
    for (let i = 0; i < steps.length + 1; i++) n = nextSim(n, 0.99, steps, branch);
    expect(n.log.join()).toMatch(/MISS/);
  });

  it("caps concurrent packets and speeds up with RPS", () => {
    expect(concurrency(1000)).toBe(1);
    expect(concurrency(50000)).toBe(3);
    expect(speedBucket(50000)).toBeLessThan(speedBucket(1000));
  });
});

describe("HldLearn linked section", () => {
  it("streams MISS entries while playing (no cache)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    vi.useFakeTimers();
    render(<HldLearn problem={problem} />);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByTestId("flow-log").textContent).toMatch(/MISS/);
  });

  it("streams HIT entries with a hot cache", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01);
    vi.useFakeTimers();
    render(<HldLearn problem={problem} />);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByTestId("flow-log").textContent).toMatch(/HIT/);
  });

  it("sliders move packets and numbers together", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    vi.useFakeTimers();
    render(<HldLearn problem={problem} />);
    const db = screen.getByTestId("db-load").textContent;
    fireEvent.change(screen.getByLabelText(/cache hit rate/i), {
      target: { value: "0" },
    });
    expect(screen.getByTestId("db-load").textContent).not.toBe(db);
    act(() => {
      vi.advanceTimersByTime(8000);
    });
    expect(screen.getByTestId("flow-log").textContent).toMatch(/MISS/);
  });

  it("pause freezes the simulation but Step still advances one frame", () => {
    vi.useFakeTimers();
    render(<HldLearn problem={problem} />);
    fireEvent.click(screen.getByTestId("flow-play")); // pause
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByTestId("flow-log").textContent).toMatch(/paused/);
    fireEvent.click(screen.getByTestId("flow-step"));
    expect(screen.getByTestId("flow-log").textContent).toMatch(/in flight/);
  });
});
