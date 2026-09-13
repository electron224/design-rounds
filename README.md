# Design Rounds

LeetCode/NeetCode-style practice for **system design interviews**: starting
with Low Level Design (HLD tracks to come) — problems with functional
requirements → staged attempts → stage-wise feedback on
SOLID, design patterns, and optimizability → curated learning links. Configurable
timer per attempt.

## Quick start

```bash
npm install
npm run dev      # http://localhost:3000
```

Feedback works out of the box with a deterministic static rubric (offline,
checklist-style, still useful). Richer LLM reviews come from either the
platform owner's key or the candidate's own key:

- **Your own key (works on any hosted deploy):** open any practice page →
  **AI: static rubric → Use my key** → pick provider (OpenAI, Gemini,
  OpenRouter, Groq, DeepSeek) + model → paste key → Save. The key lives only
  in your browser (localStorage), rides along with each grading request over
  HTTPS, and is never stored server-side. Clear it on shared machines.
- **Owner key:** server-wide `LLM_API_KEY` (+ optional `LLM_MODEL` /
  `LLM_BASE_URL`) for any OpenAI-compatible provider, or free local Ollama
  (`LLM_BASE_URL=http://localhost:11434/v1`, no key needed). See `.env.example`.

Any LLM failure silently falls back to the static rubric; the feedback panel
always shows which engine graded you (`via Google Gemini gemini-3.5-flash-lite · your key`).

## LLM in production (BYOK by default)

There is no free hosted model worth calling keyless (the public free tiers
all went auth-walled). The supported setups, cheapest first:

1. **Candidate keys (default on hosted deploys):** zero owner cost or setup —
   each learner brings any key above. Server enforces a strict provider
   allowlist (unknown hosts are never fetched — no SSRF) and charset-capped
   model ids; keys are never logged or persisted. Abuse is bounded by the
   60KB payload cap.
2. **Local Ollama (free):** `ollama pull llama3.1` → `ollama serve` →
   `LLM_BASE_URL` + `LLM_MODEL` in `.env.local`. Good for personal use.
3. **Owner-held cheap API key:** one key serves all candidates
   (gpt-4o-mini and equivalents cost fractions of a cent per grading).
4. **Self-hosted inference** (vLLM/Ollama on a GPU box) behind
   `LLM_BASE_URL` for team/org deployments.

No code changes between options — env vars for owner setups, in-app settings
for candidate keys.

## How it works

- **Problems** (`src/lib/problems.ts`): 10 seeded LLD problems — Parking Lot,
  Tic-Tac-Toe, Elevator, Splitwise, BookMyShow, Chess, ATM, Stack Overflow,
  LRU Cache, Vending Machine. Each has functional requirements, non-goals,
  reference objects/flow (hidden from candidates), patterns, SOLID focus, code
  starters (Java/Python/TS), and mapped learning resources. Problems are
  ordered 1–10 across starter → core → stretch tracks (`order`/`track`, with
  prev/next navigation), each carrying model-solution `decisions` (revealed
  post-submit) and interviewer `followUps` (twists with hints).
- **Practice flow**: `/problems/[slug]` (requirements + free-form timer config,
  1–240 min) → `/practice/[slug]?t=` → wizard with `Timer` (pause/resume,
  auto-submit on expiry), Stage 0 `Clarify` (questions first + agreed-scope
  capture, graded against per-problem `expectedQuestions`), Stage 1
  `ObjectModeler` (core-entity visual cards; seeds the flow board),
  `Whiteboard`/`FlowEditor`, `ProjectEditor` + `RunPanel`, per-item
  right/wrong verdicts, a live cross-stage coherence check
  (`src/lib/coherence.ts` — same entities in model, flow, and code), and
  interviewer twists with hints.
- **Feedback** (`POST /api/feedback`): `src/lib/llm.ts` calls the LLM with
  stage-specific prompts (`src/lib/prompts.ts`); falls back to
  `src/lib/feedback.ts` static rubric. Attempts/submissions persist to SQLite
  (`data/lld.db` via `better-sqlite3`, see `src/lib/db.ts`).
- **Resume + scoring:** every keystroke autosaves as attempt `drafts`
  (debounced PATCH); `/practice/[slug]?attempt=` resumes, "Start fresh" resets.
  `/progress` lists attempts (server list for accounts, localStorage index for
  guests) with Continue / Score / Fresh actions. `/report/[attemptId]` scores
  out of 10 (`src/lib/report.ts`: sum of latest per-stage scores / 20 × 10 — all 4 stages count, skipping one costs) with weakest
  dimensions, top focus areas, and a coherence snapshot.
- **Learn** (`/learn`, `src/lib/resources.ts`): OOP / SOLID / pattern links,
  surfaced per-problem and inside every feedback panel.

## Decisions (defaults, easy to change)

- Code execution (`POST /api/run`, `RunPanel`): runs on the host by default
  in dev (python3/node/javac in a fresh temp dir, 10s timeout per stage,
  output caps). In production local execution is **refused** unless
  `ALLOW_LOCAL_RUN=1` — point `PISTON_API_URL` (+ optional `PISTON_API_KEY`)
  at a sandboxed runner instead. Expensive routes are IP rate-limited
  (`/api/feedback` 30/10min, `/api/run` 20/10min, auth 10/10min;
  single-instance memory buckets, see `src/lib/ratelimit.ts`).
- Auth (optional, guest-first): local email + password accounts in SQLite
  (scrypt-hashed, stdlib crypto — no OAuth, no env setup, no extra deps).
  `/login` offers create-account / log-in plus guest entry; the header shows
  an account chip or Log in. Logged-in attempts are stamped with the account
  id (`attempts.userId`).
- Whiteboard sketches are serialized to text (`src/lib/scene.ts`) so any
  reviewer — static rubric or LLM — can grade them without image input.
- System-aware light/dark theme with a candidate Light/System/Dark toggle in
  the header. Explicit choices and the last-known OS value persist in cookies
  (`lld_theme`, `lld_theme_system`) so SSR pre-paints correctly with zero
  `<script>` tags; `ThemeProvider` owns the class post-mount and Monaco /
  Excalidraw / Mermaid follow via `src/lib/useSystemTheme.ts`.
  Whiteboard strokes are color-normalized per theme so light-drawn shapes stay
  visible in dark mode and vice versa.
- SQLite file DB by default (local dev + single-node deploys) — set
  `DATABASE_URL` for Postgres instead (serverless-safe). All queries go
  through one async interface in `src/lib/db.ts`, so the swap is contained.

## Tests

```bash
npm test              # 161 tests: unit (lib), integration (API + SQLite), component
npm run test:coverage # + coverage of src/lib
```

API tests use an isolated temp DB via `LLD_DB_PATH` — your `data/lld.db`
is never touched.

## Scripts

- `npm run dev` / `npm run build` / `npm start` / `npm run lint` / `npm test`
