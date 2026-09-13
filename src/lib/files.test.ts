import { describe, expect, it } from "vitest";
import {
  allFolders,
  deleteFolder,
  ensureFolder,
  fileNameOf,
  folderOf,
  joinFiles,
  languageForPath,
  normalizePath,
  renameFolder
} from "./files";

describe("languageForPath", () => {
  it("detects common interview languages by extension", () => {
    expect(languageForPath("Solution.java")).toBe("java");
    expect(languageForPath("model/ticket.py")).toBe("python");
    expect(languageForPath("a/b/c.ts")).toBe("typescript");
    expect(languageForPath("Main.go")).toBe("go");
  });

  it("falls back to plaintext for unknown extensions", () => {
    expect(languageForPath("notes.txt")).toBe("plaintext");
    expect(languageForPath("Makefile")).toBe("plaintext");
  });
});

describe("folderOf / fileNameOf", () => {
  it("derives folders from paths", () => {
    expect(folderOf("model/Ticket.java")).toBe("model");
    expect(folderOf("a/b/C.java")).toBe("a/b");
    expect(folderOf("Solution.java")).toBe("");
    expect(fileNameOf("model/Ticket.java")).toBe("Ticket.java");
  });
});

describe("joinFiles", () => {
  it("handles the empty project", () => {
    expect(joinFiles([])).toMatch(/no files/i);
  });

  it("serializes every file with its path header", () => {
    const out = joinFiles([
      { path: "ParkingLot.java", content: "class ParkingLot {}" },
      { path: "model/Slot.java", content: "class Slot {}" }
    ]);
    expect(out).toContain("2 file(s)");
    expect(out).toContain("===== FILE: model/Slot.java =====");
    expect(out).toContain("class Slot {}");
  });

  it("lists explicit empty directories", () => {
    const out = joinFiles(
      [{ path: "Solution.java", content: "" }],
      ["strategy"]
    );
    expect(out).toContain("- strategy/");
    expect(out).toMatch(/empty directories: strategy\//);
  });
});

describe("directory helpers", () => {
  it("normalizePath trims and collapses slashes", () => {
    expect(normalizePath("  /model//Ticket.java ")).toBe("model/Ticket.java");
    expect(normalizePath("strategy/")).toBe("strategy");
  });

  it("ensureFolder is idempotent", () => {
    expect(ensureFolder([], "model")).toEqual(["model"]);
    expect(ensureFolder(["model"], "model")).toEqual(["model"]);
  });

  it("allFolders merges explicit dirs with path-implied ancestors", () => {
    expect(
      allFolders([{ path: "a/b/C.java", content: "" }], ["strategy"])
    ).toEqual(["a", "a/b", "strategy"]);
  });

  it("renameFolder rewrites file prefixes and nested folders", () => {
    const next = renameFolder(
      [{ path: "model/Ticket.java", content: "x" }],
      ["model", "model/inner"],
      "model",
      "domain"
    );
    expect(next.files).toEqual([{ path: "domain/Ticket.java", content: "x" }]);
    expect(next.folders).toEqual(["domain", "domain/inner"]);
  });

  it("renameFolder refuses moves into itself or occupied targets", () => {
    const files = [{ path: "a/A.java", content: "" }];
    expect(renameFolder(files, ["a"], "a", "a/b").folders).toEqual(["a"]);
    expect(
      renameFolder(files, ["a", "b"], "a", "b").files
    ).toEqual(files);
  });

  it("deleteFolder removes the subtree (files + nested folders)", () => {
    const next = deleteFolder(
      [
        { path: "model/A.java", content: "" },
        { path: "Solution.java", content: "" }
      ],
      ["model", "model/inner", "service"],
      "model"
    );
    expect(next.files).toEqual([{ path: "Solution.java", content: "" }]);
    expect(next.folders).toEqual(["service"]);
  });
});
