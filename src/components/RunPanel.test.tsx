// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RunPanel from "./RunPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RunPanel", () => {
  it("shows supported extensions when nothing is runnable", () => {
    render(<RunPanel files={[{ path: "notes.md", content: "#" }]} />);
    expect(screen.getByText(/no runnable files/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /run/i })).toBeDisabled();
  });

  it("sends stdin + entry file and renders program output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        language: "python",
        version: "3.10.0",
        run: { stdout: "6\n", stderr: "", output: "6\n", code: 0, signal: null }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RunPanel
        files={[
          { path: "util.py", content: "X = 1" },
          { path: "main.py", content: "print(2 * 3)" }
        ]}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/1 2 3/), {
      target: { value: "5\n" }
    });
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    expect(await screen.findByText("6")).toBeInTheDocument();
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.entryPath).toBe("main.py");
    expect(sent.stdin).toBe("5\n");
    expect(sent.files).toHaveLength(2);
  });

  it("surfaces runner errors without crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ error: "Code runner is unreachable" })
      })
    );
    render(<RunPanel files={[{ path: "a.py", content: "" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    expect(await screen.findByText(/unreachable/i)).toBeInTheDocument();
  });
});
