import type { LLDProblem } from "./types";

const JAVA_PARKING = `// Parking Lot — starter (Java)
import java.util.*;

enum VehicleType { CAR, BIKE, TRUCK }
enum SlotStatus { FREE, OCCUPIED }

class Vehicle {
  String plate; VehicleType type;
  Vehicle(String plate, VehicleType type) { this.plate = plate; this.type = type; }
}

class Slot {
  String id; VehicleType allowedType; SlotStatus status = SlotStatus.FREE; Vehicle vehicle;
}

class Floor {
  int number; List<Slot> slots = new ArrayList<>();
}

interface PricingStrategy { double price(long minutesParked, VehicleType type); }
class FlatPricing implements PricingStrategy {
  public double price(long m, VehicleType t) { return 50 + m * 0.5; }
}

class ParkingLot {
  List<Floor> floors = new ArrayList<>();
  PricingStrategy pricing;
  ParkingLot(PricingStrategy p) { this.pricing = p; }
  Slot allocate(Vehicle v) { /* TODO: find FREE slot matching type */ return null; }
  double release(String slotId, long minutes) { /* TODO */ return 0; }
}
`;

const JAVA_GENERIC = `// Starter — model your classes here (Java)
import java.util.*;

public class Solution {
  // TODO: define classes, enums, interfaces
}
`;

const PY_GENERIC = `# Starter — model your classes here (Python)
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

# TODO: define classes, enums, interfaces
`;

const TS_GENERIC = `// Starter — model your classes here (TypeScript)
// TODO: define classes, enums, interfaces
export {};
`;

export const PROBLEMS: LLDProblem[] = [
  {
    id: "parking-lot",
    slug: "parking-lot",
    title: "Parking Lot",
    difficulty: "Easy",
    summary: "Design a multi-floor parking lot with slot allocation, ticketing, and pricing.",
    functionalRequirements: [
      "Support multiple floors, each with slots for CAR, BIKE, TRUCK.",
      "Allocate the nearest FREE slot compatible with vehicle type; issue a ticket.",
      "Release a slot on exit and compute fee via a pricing strategy.",
      "Track slot status (FREE/OCCUPIED) and prevent double-booking.",
      "Support at least two pricing strategies (flat, hourly) without changing core lot logic.",
      "Handle full-lot case gracefully with a clear error/message."
    ],
    nonGoals: ["Payment gateway integration", "CCTV/hardware sensors", "Multi-lot federation (HLD)"],
    constraints: ["Single process, in-memory is fine", "Thread-safety notes expected but locks optional in v1"],
    timeDefaultMin: 30,
    tags: ["allocation", "ticketing", "pricing"],
    patterns: ["Strategy", "Factory"],
    solidFocus: ["OCP (new vehicle/pricing types)", "SRP (Ticket vs Lot vs Pricing)", "DIP (depend on PricingStrategy)"],
    order: 1,
    track: "starter",
    expectedQuestions: [
      { question: "Who are the users — drivers only, or valets/admins too?", why: "Extra actors add flows (reservations, admin overrides) that reshape the model." },
      { question: "Is pricing fixed at entry or computed at exit?", why: "Decides whether Ticket carries a strategy reference or just timestamps." },
      { question: "Single lot or many lots sharing users?", why: "Multi-lot is a federation/HLD concern — confirms the scope boundary." },
      { question: "Which vehicle types can park — only CAR/BIKE/TRUCK, or buses/EVs too?", why: "New vehicle types are the OCP test: slots and pricing must absorb them without edits." }
    ],
    decisions: [
      "Ticket is a first-class object (not a receipt string) — entry time, slot, vehicle travel together.",
      "PricingStrategy injected into ParkingLot: adding hourly/weekend pricing touches zero lot code (OCP + DIP).",
      "Floor owns nearest-free search; ParkingLot only orchestrates floors (SRP keeps allocate() thin).",
      "Slot.status enum (FREE/OCCUPIED) instead of null-vehicle checks — state is explicit and printable."
    ],
    followUps: [
      { prompt: "Add hourly + weekend pricing without touching ParkingLot.", hint: "New classes implementing PricingStrategy; pick strategy at ticket creation." },
      { prompt: "Two entries allocate the same slot concurrently. Fix it.", hint: "Synchronize per-floor allocate, or CAS on Slot.status; name the lock granularity." },
      { prompt: "Add EV slots with charging fees.", hint: "New VehicleType + slot type; pricing composes (base + charging) — Decorator or second strategy." }
    ],
    referenceObjects: [
      { name: "Vehicle", responsibility: "plate + type value object" },
      { name: "Slot", responsibility: "id, allowedType, status, current vehicle" },
      { name: "Floor", responsibility: "collection of slots, nearest-free search" },
      { name: "Ticket", responsibility: "entry time, slot ref, vehicle ref" },
      { name: "ParkingLot", responsibility: "orchestrates allocate/release" },
      { name: "PricingStrategy", responsibility: "interface; FlatPricing, HourlyPricing impls" },
      { name: "SlotFactory", responsibility: "creates typed slots (optional)" }
    ],
    referenceFlow: [
      "Client -> ParkingLot.allocate(vehicle): find floor with FREE compatible slot",
      "Mark slot OCCUPIED, create Ticket(entryTime, slot, vehicle), return ticket",
      "Client -> ParkingLot.release(ticket): compute fee via PricingStrategy",
      "Mark slot FREE, return receipt; handle invalid/full-lot errors"
    ],
    codeStarter: { java: JAVA_PARKING, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "oops-basics", stage: "objects", reason: "Nouns → classes: Vehicle, Slot, Floor, Ticket." },
      { resourceId: "solid-ocp", stage: "objects", reason: "New vehicle/pricing types must not edit core lot." },
      { resourceId: "pat-strategy", stage: "code", reason: "Pricing varies — Strategy keeps ParkingLot closed for modification." },
      { resourceId: "solid-dip", stage: "code", reason: "Depend on PricingStrategy abstraction, not concrete pricing." }
    ]
  },
  {
    id: "tictactoe",
    slug: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    difficulty: "Easy",
    summary: "N-player extensible Tic-Tac-Toe with win detection and undo.",
    functionalRequirements: [
      "Support N×N board (default 3×3) and 2 players with symbols X/O.",
      "Validate moves (in-bounds, cell empty, correct turn order).",
      "Detect win (row/col/diagonal) and draw efficiently after each move.",
      "Support undo of last move.",
      "Allow bot player (easy: random move) without changing game loop.",
      "Declare result and stop accepting moves after game over."
    ],
    nonGoals: ["Online multiplayer", "AI minimax (stretch only)"],
    constraints: ["Win check should avoid full-board rescan discussion"],
    timeDefaultMin: 25,
    tags: ["game", "state"],
    patterns: ["State", "Strategy (win + bot)", "Factory (player creation)"],
    solidFocus: ["OCP (new win rules/bots)", "SRP (Board vs Game vs Rules)"],
    order: 2,
    track: "starter",
    expectedQuestions: [
      { question: "Fixed 3×3 or variable N×N board?", why: "N×N kills hardcoded win checks and forces the Strategy design." },
      { question: "Human vs human only, or must a bot play?", why: "A bot player changes the Player abstraction from day one." },
      { question: "Is undo part of the requirements?", why: "Undo demands move history — easy to add now, painful to retrofit." }
    ],
    decisions: [
      "Win check runs only around the last move (its row/col/diags) — O(1) per move, no full-board rescan.",
      "WinStrategy interface (Row/Col/Diag impls): N×N and new rules plug in without touching Game.",
      "Bot is a Player subclass producing Moves — game loop never branches on human-vs-bot.",
      "Game owns a status enum (IN_PROGRESS/WON/DRAWN) and refuses moves after terminal state."
    ],
    followUps: [
      { prompt: "Support 4×4 and Connect-Four-style K-in-a-row.", hint: "Win strategies take K; scanning extends along a direction from the last move." },
      { prompt: "Add an unbeatable bot without rewriting Game.", hint: "New Bot subclass with minimax producing Moves; loop is untouched (OCP)." },
      { prompt: "Undo k moves, not just one.", hint: "Move history stack; pop k and restore turn from the stack top." }
    ],
    referenceObjects: [
      { name: "Cell/Board", responsibility: "grid state, place/remove mark" },
      { name: "Player (Human/Bot)", responsibility: "produces a Move" },
      { name: "Move", responsibility: "row, col, player value object" },
      { name: "WinStrategy", responsibility: "interface; RowWin, ColWin, DiagWin" },
      { name: "Game", responsibility: "turn loop, state (IN_PROGRESS/WON/DRAWN)" }
    ],
    referenceFlow: ["Game.play(move): validate → Board.place → WinStrategies.check → update state", "Undo pops last move and restores turn"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "pat-state", stage: "objects", reason: "Game lifecycle is a State machine." },
      { resourceId: "pat-strategy", stage: "code", reason: "Win rules and bot levels vary independently." },
      { resourceId: "solid-srp", stage: "objects", reason: "Board stores state; Game orchestrates; Rules decide." }
    ]
  },
  {
    id: "elevator",
    slug: "elevator-system",
    title: "Elevator System",
    difficulty: "Medium",
    summary: "Multi-elevator dispatch with direction-aware scheduling.",
    functionalRequirements: [
      "N elevators across M floors; each elevator has state (IDLE/MOVING_UP/MOVING_DOWN/DOOR_OPEN).",
      "External requests (floor + direction) and internal requests (destination floor).",
      "Dispatch each external request to the best elevator (nearest, direction-compatible).",
      "Move elevators stepwise, open/close doors, serve queued stops in order.",
      "Support pluggable dispatch strategy (nearest vs SCAN).",
      "Handle full/invalid requests and door-obstruction retry note."
    ],
    nonGoals: ["Real-time hardware control", "Multi-building routing (HLD)"],
    constraints: ["Single process simulation", "Deterministic tick-based movement is fine"],
    timeDefaultMin: 45,
    tags: ["scheduling", "state"],
    patterns: ["State", "Strategy (dispatch)", "Observer (floor display updates)"],
    solidFocus: ["OCP (dispatch algorithms)", "SRP (Elevator vs Dispatcher vs Request)"],
    order: 6,
    track: "core",
    expectedQuestions: [
      { question: "How many elevators and floors, and is it fixed?", why: "N elevators need dispatch; one elevator is just a state machine." },
      { question: "Who calls: hall buttons, in-car panel, or both?", why: "External vs internal requests are different types with different routing." },
      { question: "What should the system optimize — wait time or energy?", why: "The objective function picks the dispatch strategy." }
    ],
    decisions: [
      "DispatchStrategy interface (Nearest, SCAN): swapping scheduling policy touches no elevator code.",
      "Elevator holds a sorted stop queue + direction — movement is a tick loop, not branching if-ladders.",
      "Display panels are Observers of elevator position; adding a lobby screen needs no elevator edits.",
      "External vs internal requests are distinct types: hall call (floor+direction) vs car call (destination)."
    ],
    followUps: [
      { prompt: "Morning rush: everyone boards at lobby going up. Optimize.", hint: "Zone/park strategy or direction-batched SCAN; measure average wait in the tick sim." },
      { prompt: "An elevator breaks mid-service with passengers.", hint: "Fault state + redistribute its stops via the dispatcher; observers show OUT_OF_SERVICE." },
      { prompt: "Add VIP priority pickup.", hint: "Priority queue of stops or a dispatch weight — keep it inside the strategy, not the Elevator." }
    ],
    referenceObjects: [
      { name: "Request", responsibility: "external/internal request value object" },
      { name: "Elevator", responsibility: "current floor, direction, stops queue, state" },
      { name: "DispatchStrategy", responsibility: "pick elevator for request" },
      { name: "ElevatorSystem", responsibility: "owns elevators, routes requests" },
      { name: "Display (Observer)", responsibility: "notified of floor/direction changes" }
    ],
    referenceFlow: ["Panel -> System.request(floor, dir) -> DispatchStrategy.pick -> elevator.enqueueStop", "Tick: elevator moves one floor, serves stops, notifies displays"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "pat-state", stage: "objects", reason: "Elevator behavior depends on IDLE/MOVING/DOOR states." },
      { resourceId: "pat-strategy", stage: "code", reason: "Dispatch policy must be swappable." },
      { resourceId: "pat-observer", stage: "flow", reason: "Displays observe elevator position." }
    ]
  },
  {
    id: "splitwise",
    slug: "splitwise",
    title: "Splitwise (Expense Sharing)",
    difficulty: "Medium",
    summary: "Groups, expenses, splits, balances with debt simplification.",
    functionalRequirements: [
      "Create users and groups; add members.",
      "Add expense with payer, amount, split type (EQUAL/EXACT/PERCENT) and validate splits sum correctly.",
      "Maintain per-user balances (who owes whom).",
      "Show balances for a user and for a group.",
      "Simplify debts (minimize transactions) — at least describe approach.",
      "Reject invalid splits with clear errors."
    ],
    nonGoals: ["UPI settlement", "Notifications pipeline (HLD)"],
    constraints: ["Money as integer cents to avoid float errors"],
    timeDefaultMin: 45,
    tags: ["ledger", "split"],
    patterns: ["Strategy (split)", "Observer (balance updates, optional)", "Factory (split creation)"],
    solidFocus: ["SRP (Expense vs Ledger vs SplitValidator)", "OCP (new split types)"],
    order: 7,
    track: "core",
    expectedQuestions: [
      { question: "Which split types must work — equal only, or exact/percent/shares?", why: "Each split type is a validation rule; the set defines the Strategy hierarchy." },
      { question: "Do we settle debts inside the app or just show balances?", why: "Settlement needs min-cash-flow; balances-only is just a ledger view." },
      { question: "Can expenses be edited or deleted after creation?", why: "Mutability forces reverse-and-reapply or immutable + compensating entries." }
    ],
    decisions: [
      "Money stored as integer cents — floats never touch the ledger.",
      "Split is a Strategy hierarchy (Equal/Exact/Percent), each with validate(): new split types can't break old ones.",
      "Ledger keeps pairwise balances; Expense only records, never computes debts (SRP).",
      "DebtSimplifier runs greedy min-cash-flow as a separate pass — settling is a view, not ledger mutation."
    ],
    followUps: [
      { prompt: "Add split-by-shares (2:1:1) and itemized splits.", hint: "Two more Split subclasses with their own validation; ledger untouched." },
      { prompt: "Settle all debts with minimum transactions.", hint: "Greedy: match biggest creditor with biggest debtor until zero; state the O(n²) ceiling." },
      { prompt: "An expense is edited after others depend on it.", hint: "Reverse-then-reapply on the ledger, or immutable expenses + compensating entries." }
    ],
    referenceObjects: [
      { name: "User/Group", responsibility: "identity + membership" },
      { name: "Expense", responsibility: "payer, amount, splits" },
      { name: "Split (Equal/Exact/Percent)", responsibility: "per-user share + validation" },
      { name: "Ledger/BalanceSheet", responsibility: "pairwise balances" },
      { name: "DebtSimplifier", responsibility: "min-cash-flow (greedy)" }
    ],
    referenceFlow: ["addExpense: validate splits -> record expense -> Ledger.apply (payer +x, others -share)", "showBalances reads ledger; simplify runs greedy settle"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "solid-srp", stage: "objects", reason: "Expense, Split, Ledger each own one reason to change." },
      { resourceId: "pat-strategy", stage: "code", reason: "Split algorithms vary by type." },
      { resourceId: "oops-composition", stage: "objects", reason: "Expense has-a Split list; prefer composition." }
    ]
  },
  {
    id: "bookmyshow",
    slug: "bookmyshow",
    title: "BookMyShow",
    difficulty: "Medium",
    summary: "Movie ticket booking with seat-hold, concurrency-safe booking, and pricing.",
    functionalRequirements: [
      "Catalog of movies, theatres, shows (movie + screen + time).",
      "Seat map per screen with types (REGULAR/PREMIUM) and status (FREE/HELD/BOOKED).",
      "Hold seats temporarily (e.g. 10 min) then confirm booking with user details.",
      "Prevent double-booking of the same seat under concurrency (discuss locking).",
      "Price calculation by seat type via strategy.",
      "Booking history per user; cancel releases seats."
    ],
    nonGoals: ["Payment gateway", "Seat-map UI drag-drop"],
    constraints: ["Must discuss concurrency even though v1 is single-process"],
    timeDefaultMin: 45,
    tags: ["booking", "concurrency"],
    patterns: ["State (seat lifecycle)", "Strategy (pricing)", "Factory (seat/booking creation)"],
    solidFocus: ["SRP (Show vs SeatMap vs BookingService)", "DIP (pricing abstraction)"],
    order: 8,
    track: "core",
    expectedQuestions: [
      { question: "Hold-then-pay or instant booking?", why: "Holds need TTL + expiry transitions; instant booking skips the hardest state." },
      { question: "What happens when two users grab the same seat?", why: "Concurrency is the core of this problem — locking granularity is the design." },
      { question: "Is payment in scope or do we stop at booking confirmation?", why: "Payment pulls in failure/reconciliation flows that dwarf the booking model." }
    ],
    decisions: [
      "Seat lifecycle is a State machine (FREE→HELD→BOOKED, HELD→FREE on expiry) — no boolean soup.",
      "Hold-then-confirm with TTL separates intent from commitment; expiry is a first-class transition.",
      "BookingService serializes on a per-show lock — contention stays scoped, not global.",
      "PricingStrategy per seat type; BookingService depends on the abstraction (DIP)."
    ],
    followUps: [
      { prompt: "10k users hammer the same blockbuster show.", hint: "Per-show lock + hold TTL + idempotency keys; say what still breaks first." },
      { prompt: "Add dynamic surge pricing for the last 20% seats.", hint: "New PricingStrategy reading occupancy; booking flow untouched." },
      { prompt: "A payment succeeds but confirm crashes midway.", hint: "Booking states PENDING→CONFIRMED with a reconciler, or saga-style compensating cancel." }
    ],
    referenceObjects: [
      { name: "Movie/Theatre/Screen/Show", responsibility: "catalog hierarchy" },
      { name: "Seat", responsibility: "id, type, status + hold expiry" },
      { name: "Booking", responsibility: "user, show, seats, status" },
      { name: "BookingService", responsibility: "hold/confirm/cancel with lock per show" },
      { name: "PricingStrategy", responsibility: "seat-type pricing" }
    ],
    referenceFlow: ["search shows -> holdSeats (FREE→HELD with TTL) -> confirm (HELD→BOOKED) or expire (HELD→FREE)", "Concurrent holds serialize on per-show lock"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "pat-state", stage: "objects", reason: "Seat FREE→HELD→BOOKED lifecycle." },
      { resourceId: "pat-factory", stage: "code", reason: "Create seats/bookings consistently." },
      { resourceId: "solid-dip", stage: "code", reason: "BookingService depends on pricing abstraction." }
    ]
  },
  {
    id: "chess",
    slug: "chess",
    title: "Chess",
    difficulty: "Hard",
    summary: "Full chess with move validation per piece, check/checkmate detection.",
    functionalRequirements: [
      "8×8 board with all pieces in standard positions.",
      "Per-piece move validation (pawn promotion, castling, en passant — at least discuss).",
      "Turn enforcement and capture handling.",
      "Check and checkmate/stalemate detection.",
      "Move history + undo (at least history).",
      "Two human players; bot hook optional."
    ],
    nonGoals: ["Chess engine AI", "Timed clocks UI"],
    constraints: ["Correctness over completeness: nail core + name extensions"],
    timeDefaultMin: 60,
    tags: ["game", "rules-engine"],
    patterns: ["Strategy (piece moves)", "State (game status)", "Factory/Prototype (piece creation)"],
    solidFocus: ["OCP (new pieces/variants)", "LSP (all pieces substitutable as Piece)"],
    order: 10,
    track: "stretch",
    expectedQuestions: [
      { question: "Full rules (castling, en passant, promotion) or basic moves first?", why: "Special moves are Move subtypes — scope decides how far the type hierarchy goes." },
      { question: "Must the engine detect check/checkmate, or just validate moves?", why: "Check detection needs the simulate-and-test-king rule engine, a separate component." },
      { question: "Human vs human only, or a bot hook?", why: "A bot must speak Moves through Game.move() — confirms the interface boundary." }
    ],
    decisions: [
      "Piece is an abstract contract (validMoves): every piece substitutable everywhere a Piece is expected (LSP).",
      "Self-check rule lives in the RuleEngine, not pieces — simulate the move, reject if own king attacked.",
      "Special moves (castling, en passant, promotion) are Move subtypes/flags, not board hacks.",
      "Game status (CHECK/CHECKMATE/STALEMATE) derives from legal-move existence, not special-case counters."
    ],
    followUps: [
      { prompt: "Add Chess960 (randomized back rank).", hint: "Board setup becomes a strategy; castling rules parameterize on king/rook start squares." },
      { prompt: "Detect threefold repetition and 50-move draws.", hint: "Position-hash history in Game; draw claims read history, pieces untouched." },
      { prompt: "A bot must pick moves through the same interface as humans.", hint: "Bot returns Move objects via the same Game.move() path — no engine fork." }
    ],
    referenceObjects: [
      { name: "Board", responsibility: "8×8 cells, piece placement" },
      { name: "Piece (abstract) + subclasses", responsibility: "validMoves(board, from)" },
      { name: "Move", responsibility: "from, to, captured, promotion" },
      { name: "Game", responsibility: "turns, status, check detection" },
      { name: "MoveValidator/RuleEngine", responsibility: "legality incl. self-check" }
    ],
    referenceFlow: ["Game.move: validate turn -> piece.validMoves -> simulate -> reject if own king in check -> apply -> update status"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "solid-lsp", stage: "objects", reason: "Every Piece must honor the Piece contract." },
      { resourceId: "pat-strategy", stage: "code", reason: "Each piece encapsulates its move algorithm." },
      { resourceId: "solid-ocp", stage: "code", reason: "Add variants without editing Game." }
    ]
  },
  {
    id: "atm",
    slug: "atm",
    title: "ATM",
    difficulty: "Medium",
    summary: "ATM with card/PIN auth, balance, withdraw with cash inventory and fees.",
    functionalRequirements: [
      "Authenticate via card + PIN (3-strike lock).",
      "Check balance, withdraw, deposit.",
      "Withdraw dispenses with available denominations (greedy) and fails cleanly on shortage.",
      "Daily limit enforcement.",
      "Transaction log per account.",
      "State-driven session (IDLE → AUTH → MENU → TRANSACTION → EJECT)."
    ],
    nonGoals: ["Bank core ledger", "Hardware dispenser drivers"],
    constraints: ["Cash inventory modeled explicitly"],
    timeDefaultMin: 40,
    tags: ["state-machine", "transaction"],
    patterns: ["State", "Chain of Responsibility (denomination dispense)", "Strategy (fee)"],
    solidFocus: ["SRP (Auth vs Cash vs Session)", "ISP (narrow service interfaces)"],
    order: 5,
    track: "core",
    expectedQuestions: [
      { question: "Card + PIN only, or biometrics / cardless too?", why: "More auth methods turn Auth into a Strategy behind the session states." },
      { question: "Which operations: balance, withdraw, deposit, all three?", why: "Deposit reverses cash flow and changes the CashInventory contract." },
      { question: "Are cash denominations limited, and what on shortage?", why: "Limited notes make the dispense chain the heart of the problem." }
    ],
    decisions: [
      "Session is a State machine (IDLE→AUTH→MENU→TRANSACTION→EJECT) — 3-strike lock is a transition, not a flag.",
      "DispenseChain (1000→500→100 handlers): new denominations slot in without touching withdraw logic.",
      "CashInventory is explicit counts, so 'insufficient denominations' fails cleanly before touching balance.",
      "Auth, cash, and logging are segregated interfaces (ISP) — session talks to narrow contracts."
    ],
    followUps: [
      { prompt: "Dispense exact change with limited notes, minimizing note count.", hint: "Greedy with backtracking when greedy fails; inventory-aware, not amount-only." },
      { prompt: "Add biometric auth alongside PIN.", hint: "Auth becomes a Strategy behind the session; states unchanged." },
      { prompt: "Cash runs out mid-withdraw after balance debit.", hint: "Debit only after a successful dispense plan, or compensating credit + alert." }
    ],
    referenceObjects: [
      { name: "Card/Account", responsibility: "identity, PIN hash, balance, daily used" },
      { name: "CashInventory", responsibility: "denomination counts, dispense plan" },
      { name: "ATMSession (State)", responsibility: "session lifecycle" },
      { name: "DispenseChain", responsibility: "1000→500→100 handlers" },
      { name: "TransactionLog", responsibility: "append-only history" }
    ],
    referenceFlow: ["insert card -> PIN attempts -> menu -> withdraw: limit check -> dispense plan -> update balance+inventory+log"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "pat-state", stage: "objects", reason: "Session is a textbook State machine." },
      { resourceId: "pat-chain", stage: "code", reason: "Denomination handling chains naturally." },
      { resourceId: "solid-isp", stage: "code", reason: "Keep Auth/Cash/Log interfaces segregated." }
    ]
  },
  {
    id: "stackoverflow",
    slug: "stack-overflow",
    title: "Stack Overflow",
    difficulty: "Medium",
    summary: "Q&A with voting, reputation, tags, and search hook.",
    functionalRequirements: [
      "Post questions (title, body, tags) and answers; one accepted answer per question.",
      "Upvote/downvote questions and answers (one vote per user, changeable).",
      "Reputation: +10 answer upvote, +5 question upvote, −2 downvote given/received (simplified).",
      "Comment threads on Q and A.",
      "Close question (needs N votes) — at least model the state.",
      "List questions by tag / top-voted (simple sort is fine)."
    ],
    nonGoals: ["Full-text search ranking (HLD)", "Moderation queue pipeline"],
    constraints: ["Reputation rules fixed and testable"],
    timeDefaultMin: 40,
    tags: ["voting", "reputation"],
    patterns: ["Observer (reputation/badges on vote)", "Strategy (ranking/sort)", "State (question lifecycle)"],
    solidFocus: ["SRP (Vote vs Reputation vs Post)", "OCP (new badge/ranking rules)"],
    order: 9,
    track: "stretch",
    expectedQuestions: [
      { question: "Do votes affect reputation, and by what rules?", why: "Reputation turns voting from a counter into an event-driven subsystem." },
      { question: "Can votes be changed or retracted?", why: "Changeable votes must be idempotent upserts, or reputation double-counts." },
      { question: "Who can accept an answer, and how many per question?", why: "Ownership + cardinality of acceptance is a write-time invariant." }
    ],
    decisions: [
      "Vote is an idempotent upsert (one per user, changeable) — reputation never double-counts.",
      "ReputationService observes vote events; new badge rules subscribe without touching voting.",
      "Accepted answer is a single flag owned by the Question, enforced at write time.",
      "Ranking is a Strategy over sort keys — hot/top/new vary without touching Post."
    ],
    followUps: [
      { prompt: "Stop vote brigading / serial upvoting.", hint: "Rate limits + voter-diversity checks in the vote path; reputation service reverses fraud." },
      { prompt: "Add bounties on questions.", hint: "Bounty as a reputation escrow on Question; award flows through the existing reputation observer." },
      { prompt: "Close questions need 5 votes; reopen needs 5 too.", hint: "Question lifecycle gains VOTE_TO_CLOSE/CLOSED states; close votes reuse the Vote object." }
    ],
    referenceObjects: [
      { name: "User", responsibility: "id, reputation" },
      { name: "Question/Answer", responsibility: "content, votes, comments, accepted flag" },
      { name: "Vote", responsibility: "voter, target, value; idempotent" },
      { name: "ReputationService (Observer)", responsibility: "adjusts reputation on vote events" },
      { name: "Tag", responsibility: "label + question index" }
    ],
    referenceFlow: ["vote event -> Vote store upsert -> ReputationService.onVote -> update scores -> badge check"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "pat-observer", stage: "flow", reason: "Votes notify reputation/badges." },
      { resourceId: "solid-srp", stage: "objects", reason: "Voting, reputation, and content are separate axes." },
      { resourceId: "uml-class", stage: "objects", reason: "Model User↔Post↔Vote relations cleanly." }
    ]
  },
  {
    id: "lru-cache",
    slug: "lru-cache",
    title: "LRU Cache",
    difficulty: "Easy",
    summary: "O(1) LRU cache with eviction, then extend with TTL decorator.",
    functionalRequirements: [
      "Fixed-capacity key-value store with get/put in O(1).",
      "Evict least-recently-used on overflow.",
      "Update recency on both get and put of existing key.",
      "Handle capacity 0 / duplicate puts / missing keys explicitly.",
      "Extension: TTL expiry via decorator/wrapper without editing core cache.",
      "Thread-safety discussion note."
    ],
    nonGoals: ["Distributed cache (HLD)", "Persistence"],
    constraints: ["Must name HashMap + DoublyLinkedList design"],
    timeDefaultMin: 25,
    tags: ["data-structure", "eviction"],
    patterns: ["Decorator (TTL)", "Factory (node creation, optional)"],
    solidFocus: ["OCP (TTL via decorator)", "SRP (storage vs eviction vs expiry)"],
    order: 3,
    track: "starter",
    expectedQuestions: [
      { question: "Must get/put really be O(1)?", why: "The complexity bar picks HashMap+list over simpler ordered-map designs." },
      { question: "Fixed capacity — what exactly happens on overflow?", why: "Eviction policy (LRU vs LFU) is the second abstraction after storage." },
      { question: "Do entries expire (TTL) now or later?", why: "TTL later means the core must stay closed for extension — Decorator shape." }
    ],
    decisions: [
      "HashMap + doubly-linked list: map for O(1) lookup, list for O(1) recency moves — name both, or it isn't O(1).",
      "Recency updates on get AND put-existing; new puts evict from the tail only when over capacity.",
      "TTL arrives as a Decorator wrapping the cache interface — the O(1) core is never edited (textbook OCP).",
      "Edge cases stated up front: capacity 0, duplicate puts, missing keys, expired-but-present entries."
    ],
    followUps: [
      { prompt: "Add TTL expiry per key.", hint: "Decorator storing expiry timestamps; lazy-expire on access, sweep on put." },
      { prompt: "Make it thread-safe with minimal contention.", hint: "Single lock is the honest v1; striped locks or concurrent map + synchronized list ordering next." },
      { prompt: "Support LFU eviction alongside LRU.", hint: "EvictionPolicy interface; frequency map + min-heap behind the same get/put contract." }
    ],
    referenceObjects: [
      { name: "Node", responsibility: "key, value, prev/next" },
      { name: "LRUCache", responsibility: "map + list, get/put, evict" },
      { name: "EvictionPolicy (optional)", responsibility: "victim selection abstraction" },
      { name: "TTLCacheDecorator", responsibility: "expiry wrapper honoring cache interface" }
    ],
    referenceFlow: ["get: map hit -> move node to front -> return; miss -> -1/None", "put: exists -> update+front; new -> insert front, evict tail if over capacity"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "pat-decorator", stage: "code", reason: "TTL must wrap, not edit, the LRU core." },
      { resourceId: "solid-ocp", stage: "code", reason: "Extension without modification — the OCP poster child." },
      { resourceId: "oops-basics", stage: "objects", reason: "Encapsulate list+map invariants." }
    ]
  },
  {
    id: "vending-machine",
    slug: "vending-machine",
    title: "Vending Machine",
    difficulty: "Easy",
    summary: "Vending machine with inventory, coins, selection, and change.",
    functionalRequirements: [
      "Inventory of items (code, price, quantity); sold-out handling.",
      "Accept coins/notes; track inserted balance; eject/cancel refunds.",
      "Select item: validate funds + stock, dispense, return change (greedy).",
      "Machine states: IDLE → ACCEPTING → DISPENSING → IDLE (+ OUT_OF_STOCK branch).",
      "Promo/discount hook via decorator or strategy (at least one).",
      "Transaction log of sales."
    ],
    nonGoals: ["Card payments", "Restocking logistics"],
    constraints: ["Change-making with limited coin inventory"],
    timeDefaultMin: 25,
    tags: ["state-machine", "inventory"],
    patterns: ["State", "Decorator/Strategy (pricing/promo)"],
    solidFocus: ["SRP (Money vs Inventory vs Dispenser)", "OCP (new promos)"],
    order: 4,
    track: "starter",
    expectedQuestions: [
      { question: "Cash only, or cards too?", why: "Cards turn payment into a Strategy; cash-only keeps insert/change/refund central." },
      { question: "What if exact change can't be made?", why: "The no-change path is the defining edge case — fail before taking money." },
      { question: "Are promos/discounts in scope?", why: "Promos decide whether pricing is a Decorator/Strategy from the start." }
    ],
    decisions: [
      "Machine session is a State machine (IDLE→ACCEPTING→DISPENSING→IDLE); cancel is a refund transition, not an exception.",
      "CashBox separates inserted balance from change computation — change uses inventory-aware greedy.",
      "Promos wrap pricing (Decorator/Strategy): a discount never edits dispense logic.",
      "SaleLog is append-only; inventory decrements only on successful dispense."
    ],
    followUps: [
      { prompt: "Exact change cannot be made with available coins.", hint: "Fail before dispensing with 'exact change only' state; never take money you can't complete." },
      { prompt: "Add card payments next to cash.", hint: "Payment becomes a Strategy; cash path (insert/change/refund) stays isolated." },
      { prompt: "Restock while the machine is serving.", hint: "Inventory versioning or a brief MAINTENANCE state; sales read a snapshot." }
    ],
    referenceObjects: [
      { name: "Item/Slot", responsibility: "code, price, qty" },
      { name: "CashBox", responsibility: "inserted balance, change computation" },
      { name: "VendingMachine (State)", responsibility: "session lifecycle" },
      { name: "PromoDecorator/PricingStrategy", responsibility: "discount extension" },
      { name: "SaleLog", responsibility: "append-only sales" }
    ],
    referenceFlow: ["insert money (IDLE→ACCEPTING) -> select -> validate -> dispense (+change) -> log -> IDLE; cancel refunds"],
    codeStarter: { java: JAVA_GENERIC, python: PY_GENERIC, typescript: TS_GENERIC },
    resources: [
      { resourceId: "pat-state", stage: "objects", reason: "Coin/selection flow is stateful." },
      { resourceId: "pat-decorator", stage: "code", reason: "Promos wrap pricing without edits." },
      { resourceId: "solid-srp", stage: "objects", reason: "Money, inventory, and dispensing change independently." }
    ]
  }
];

export const problemBySlug = (slug: string) =>
  PROBLEMS.find((p) => p.slug === slug);

/** Problems in learning order (1..N). */
export function trackOrder(): LLDProblem[] {
  return [...PROBLEMS].sort((a, b) => a.order - b.order);
}

export function trackGroups(): { track: LLDProblem["track"]; problems: LLDProblem[] }[] {
  const ordered = trackOrder();
  return (["starter", "core", "stretch"] as const).map((track) => ({
    track,
    problems: ordered.filter((p) => p.track === track)
  }));
}

/** Prev/next steps in the track for "do this one next" navigation. */
export function trackNeighbors(slug: string): {
  prev: LLDProblem | null;
  next: LLDProblem | null;
  index: number;
  total: number;
} {
  const ordered = trackOrder();
  const index = ordered.findIndex((p) => p.slug === slug);
  return {
    prev: index > 0 ? ordered[index - 1] : null,
    next: index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : null,
    index,
    total: ordered.length
  };
}

/**
 * Generates the model-solution skeleton from the reference objects —
 * what a strong code-stage answer is shaped like. Shown after submit.
 */
export function buildSkeleton(problem: LLDProblem): string {
  const lines = [
    `// Model solution shape — ${problem.title} (reference, revealed after submit)`
  ];
  for (const o of problem.referenceObjects) {
    const name = o.name.split(/[^A-Za-z]/)[0] || o.name;
    lines.push(`class ${name} { /* ${o.responsibility} */ }`);
  }
  lines.push("", "// Key decisions this solution demonstrates:");
  for (const d of problem.decisions) lines.push(`// - ${d}`);
  return lines.join("\n");
}
