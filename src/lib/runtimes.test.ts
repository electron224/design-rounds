import { describe, expect, it } from "vitest";
import {
  MAX_RUN_FILES,
  MAX_RUN_TOTAL_CHARS,
  MAX_STDIN_CHARS,
  pistonLanguageForPath,
  validateRunInput
} from "./runtimes";

describe("pistonLanguageForPath", () => {
  it("maps interview languages to runner names", () => {
    expect(pistonLanguageForPath("Main.java")).toBe("java");
    expect(pistonLanguageForPath("a/sol.py")).toBe("python");
    expect(pistonLanguageForPath("a.ts")).toBe("typescript");
    expect(pistonLanguageForPath("x.go")).toBe("go");
  });

  it("rejects non-runnable files", () => {
    expect(pistonLanguageForPath("notes.md")).toBeNull();
    expect(pistonLanguageForPath("Makefile")).toBeNull();
  });
});

describe("validateRunInput", () => {
  it("accepts a normal project", () => {
    expect(
      validateRunInput([{ path: "A.py", content: "print(1)" }], "")
    ).toBeNull();
  });

  it("enforces size limits", () => {
    expect(validateRunInput([], "")).toMatch(/no files/i);
    expect(
      validateRunInput(
        Array.from({ length: MAX_RUN_FILES + 1 }, (_, i) => ({
          path: `${i}.py`,
          content: ""
        })),
        ""
      )
    ).toMatch(/too many/i);
    expect(
      validateRunInput(
        [{ path: "A.py", content: "x".repeat(MAX_RUN_TOTAL_CHARS + 1) }],
        ""
      )
    ).toMatch(/too large/i);
    expect(
      validateRunInput([{ path: "A.py", content: "" }], "x".repeat(MAX_STDIN_CHARS + 1))
    ).toMatch(/stdin/i);
  });
});
