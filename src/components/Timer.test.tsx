// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import Timer from "./Timer";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const noop = () => {};

describe("Timer resume + auto-pause", () => {
  it("starts from the full duration by default", () => {
    render(<Timer minutes={30} onExpire={noop} />);
    expect(screen.getByText("30:00")).toBeInTheDocument();
  });

  it("resumes from saved seconds and clamps to bounds", () => {
    const { unmount } = render(
      <Timer minutes={30} initialLeft={61} onExpire={noop} />
    );
    expect(screen.getByText("01:01")).toBeInTheDocument();
    unmount();

    render(<Timer minutes={30} initialLeft={99999} onExpire={noop} />);
    expect(screen.getByText("30:00")).toBeInTheDocument();
  });

  it("opening at zero shows time-up without re-submitting", () => {
    const onExpire = vi.fn();
    render(<Timer minutes={30} initialLeft={0} onExpire={onExpire} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByText(/time up/i)).toBeInTheDocument();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it("auto-pauses when the tab hides", async () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true
    });
    render(<Timer minutes={30} onExpire={noop} />);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(await screen.findByText("Resume")).toBeInTheDocument();
    expect(screen.getByText(/auto-paused/i)).toBeInTheDocument();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true
    });
  });

  it("expires exactly once after ticking to zero", () => {
    vi.useFakeTimers();
    const onExpire = vi.fn();
    render(<Timer minutes={1} initialLeft={2} onExpire={onExpire} />);
    expect(screen.getByText("00:02")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByText(/time up/i)).toBeInTheDocument();
    expect(onExpire).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
