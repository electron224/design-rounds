// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ProjectEditor from "./ProjectEditor";
import type { ProjectFile } from "@/lib/files";

afterEach(cleanup);

const SOL = [{ path: "Solution.java", content: "class Solution {}" }];

function renderEditor(
  files: ProjectFile[] = SOL,
  folders: string[] = [],
  onChange = vi.fn()
) {
  render(<ProjectEditor files={files} folders={folders} onChange={onChange} />);
  return onChange;
}

describe("ProjectEditor directories", () => {
  it("renders root files and the editor for the active file", () => {
    renderEditor();
    expect(screen.getByText("Solution.java")).toBeInTheDocument();
    expect(screen.getByText(/1 file\(s\) · 0 directorie\(s\)/)).toBeInTheDocument();
  });

  it("creates an explicit (empty) folder", () => {
    const onChange = renderEditor();
    fireEvent.click(screen.getByText("+ Folder"));
    const input = screen.getByPlaceholderText(/new folder/i);
    fireEvent.change(input, { target: { value: "strategy" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(SOL, ["strategy"]);
  });

  it("auto-creates the folder when a file path contains one", () => {
    const onChange = renderEditor();
    fireEvent.click(screen.getByText("+ File"));
    const input = screen.getByPlaceholderText(/name\.java or folder/i);
    fireEvent.change(input, { target: { value: "model/Ticket.java" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(
      [...SOL, { path: "model/Ticket.java", content: "" }],
      ["model"]
    );
  });

  it("creates a file inside the folder via its + button", () => {
    const onChange = renderEditor(SOL, ["model"]);
    fireEvent.click(screen.getByTitle("New file in model/"));
    const input = screen.getByPlaceholderText(
      "model/Name.java"
    ) as HTMLInputElement;
    expect(input.value).toBe("model/");
    fireEvent.change(input, { target: { value: "model/Ticket.java" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(
      [...SOL, { path: "model/Ticket.java", content: "" }],
      ["model"]
    );
  });

  it("prefixes bare names with the selected folder, root otherwise", () => {
    const onChange = renderEditor(SOL, ["model"]);
    // Select the folder, then add a bare file name → lands inside.
    fireEvent.click(screen.getByRole("button", { name: "model/(0)" }));
    fireEvent.click(screen.getByText("+ File"));
    const input = screen.getByPlaceholderText("model/Name.java");
    fireEvent.change(input, { target: { value: "A.java" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(
      [...SOL, { path: "model/A.java", content: "" }],
      ["model"]
    );
  });

  it("deletes a folder together with its files", () => {
    const onChange = renderEditor(
      [...SOL, { path: "model/A.java", content: "" }],
      ["model"]
    );
    fireEvent.click(screen.getByTitle("Delete folder model and its contents"));
    expect(onChange).toHaveBeenCalledWith(SOL, []);
  });

  it("shows an (empty) marker for folders without files", () => {
    renderEditor(SOL, ["strategy"]);
    expect(screen.getByText("strategy/")).toBeInTheDocument();
    expect(screen.getByText("(empty)")).toBeInTheDocument();
  });

  it("collapsing a folder hides its files; expanding shows them again", () => {
    renderEditor([...SOL, { path: "model/A.java", content: "" }], ["model"]);
    expect(screen.getByText(/A\.java/)).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Collapse folder model"));
    expect(screen.queryByText(/A\.java/)).not.toBeInTheDocument();
    // Header (with file count) stays visible while collapsed.
    expect(screen.getByText("model/")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Expand folder model"));
    expect(screen.getByText(/A\.java/)).toBeInTheDocument();
  });

  it("adding a file into a collapsed folder expands it", () => {
    const onChange = renderEditor(
      [...SOL, { path: "model/A.java", content: "" }],
      ["model"]
    );
    fireEvent.click(screen.getByTitle("Collapse folder model"));
    expect(screen.queryByText("A.java")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("New file in model/"));
    const input = screen.getByPlaceholderText("model/Name.java");
    fireEvent.change(input, { target: { value: "model/B.java" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(
      [
        ...SOL,
        { path: "model/A.java", content: "" },
        { path: "model/B.java", content: "" }
      ],
      ["model"]
    );
  });
});
