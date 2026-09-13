// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(cleanup);
import ObjectModeler from "./ObjectModeler";

describe("ObjectModeler (entity cards)", () => {
  it("adds an entity card and reports it via onChange", () => {
    const onChange = vi.fn();
    render(<ObjectModeler value={[]} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/entity name/i), {
      target: { value: "Ticket" }
    });
    fireEvent.change(screen.getByPlaceholderText(/properties/i), {
      target: { value: "entryTime" }
    });
    fireEvent.click(screen.getByText(/add entity card/i));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: "Ticket", attributes: "entryTime" })
    ]);
  });

  it("renders UML-style cards with compartments and a remove action", () => {
    const onChange = vi.fn();
    render(
      <ObjectModeler
        value={[{ name: "Slot", attributes: "id, status", methods: "hold()", relationship: "" }]}
        onChange={onChange}
      />
    );
    expect(screen.getByText("Slot")).toBeInTheDocument();
    expect(screen.getByText("+ id")).toBeInTheDocument();
    expect(screen.getByText("+ hold()")).toBeInTheDocument();
    // No relationship UI — relationships are drawn in the flow stage.
    expect(screen.queryByText("has-a")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Remove Slot"));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
