import { describe, expect, it } from "vitest";
import { checkCoherence } from "./coherence";

const classes = [
  { name: "ParkingLot", attributes: "", methods: "", relationship: "has-a" },
  { name: "Ticket", attributes: "", methods: "", relationship: "has-a" },
  { name: "Slot", attributes: "", methods: "", relationship: "has-a" }
];

describe("checkCoherence", () => {
  it("passes a design where every entity survives all stages", () => {
    const r = checkCoherence(
      classes,
      "ParkingLot -> Ticket : creates\nTicket -> Slot : holds",
      [
        { path: "ParkingLot.java", content: "class ParkingLot { Ticket t; Slot s; }" },
        { path: "Ticket.java", content: "class Ticket {}" },
        { path: "Slot.java", content: "class Slot {}" }
      ]
    );
    expect(r.entities).toEqual(["ParkingLot", "Ticket", "Slot"]);
    expect(r.missingInFlow).toEqual([]);
    expect(r.missingInCode).toEqual([]);
    expect(r.unmodeledInCode).toEqual([]);
  });

  it("flags entities dropped between stages, both directions", () => {
    const r = checkCoherence(
      classes,
      "ParkingLot -> Ticket : creates",
      [{ path: "Lot.java", content: "class ParkingLot {} class Receipt {}" }]
    );
    expect(r.missingInFlow).toEqual(["Slot"]);
    expect(r.missingInCode).toEqual(["Ticket", "Slot"]);
    expect(r.unmodeledInCode).toEqual(["receipt"]);
  });

  it("stays quiet with nothing modeled yet", () => {
    const r = checkCoherence([], "", []);
    expect(r.entities).toEqual([]);
    expect(r.missingInFlow).toEqual([]);
    expect(r.missingInCode).toEqual([]);
  });
});
