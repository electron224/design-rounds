<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Design Rounds — agent instructions

Interview-prep platform (LLD now, HLD later). Next.js 16 App Router + SQLite
(`better-sqlite3`, Postgres via `DATABASE_URL`) + Tailwind v4.

## Commands

- `npm run dev` / `npm run build` / `npm start` / `npm run lint`
- `npm test` — vitest, colocated `*.test.ts` (unit + integration + component)

## Conventions

- Server-first: pages/routes are server components; `"use client"` only for
  interactive islands (wizard, editors, whiteboard).
- All SQL lives behind `getDb()` in `src/lib/db.ts` (`?` placeholders, one
  async `Db` interface). Never branch on backend outside `db.ts`.
- Stage ids are stable (`clarify|objects|flow|code`); display labels may change.
- Dark mode is class-based (`.dark`); every new surface needs `dark:` variants.
- Feedback entering React must pass `sanitizeStageFeedback()` — model output
  and stored rows are both untrusted.
- Lint is strict (`setState`-in-effect and render-time ref access are errors):
  use `useSyncExternalStore` for browser-state hydration, effects for callbacks.

## Security — never commit or push

- `data/` (SQLite: password hashes, emails, attempts) and `.env*` (except
  `.env.example`, which must stay secret-free) are git-ignored. Verify with
  `git status` before any commit.
- No real API keys in code, tests, or docs — test fixtures only (`sk-test`,
  `gsk-test`, `AIza-test`). Candidate keys live in browser localStorage;
  the server only forwards them to allowlisted providers (`src/lib/providers.ts`).
- `/api/run` executes code: keep it env-gated (`ALLOW_LOCAL_RUN`) and capped;
  never widen its request schema without rate limits.
