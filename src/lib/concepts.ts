export interface PatternConcept {
  id: "strategy" | "observer" | "state" | "decorator";
  title: string;
  /** The one-line idea, in candidate words. */
  idea: string;
  /** The design move it teaches (what to do in an interview). */
  designMove: string;
  /** Problems where this pattern is the graded answer — validated by test. */
  problemSlugs: string[];
}

export const CONCEPTS: PatternConcept[] = [
  {
    id: "strategy",
    title: "Strategy",
    idea: "Swap the algorithm without touching the caller — pricing, dispatch, win-rules.",
    designMove:
      "Extract what varies into an interface, inject it. New behavior = new class, zero edits to the core.",
    problemSlugs: ["parking-lot", "elevator-system", "bookmyshow", "lru-cache", "splitwise", "vending-machine"],
  },
  {
    id: "observer",
    title: "Observer",
    idea: "One event, many reactions — vote once, reputation + badges update themselves.",
    designMove:
      "Publish events from the hot path; subscribers attach without edits. Keeps Voting separate from Reputation.",
    problemSlugs: ["stack-overflow", "elevator-system", "splitwise"],
  },
  {
    id: "state",
    title: "State",
    idea: "Behavior follows status — a seat acts differently FREE, HELD, and BOOKED.",
    designMove:
      "Replace status-flag if-ladders with state objects. Expiry and cancel become transitions, not exceptions.",
    problemSlugs: ["bookmyshow", "atm", "vending-machine", "tic-tac-toe", "elevator-system"],
  },
  {
    id: "decorator",
    title: "Decorator",
    idea: "Wrap, don't edit — promos and TTL stack onto the core without opening it.",
    designMove:
      "Honor the same interface while adding behavior around it. The OCP poster child: extension without modification.",
    problemSlugs: ["lru-cache", "vending-machine"],
  },
];

export const conceptById = (id: string) =>
  CONCEPTS.find((c) => c.id === id);
