# HLD Animated Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an animated HLD section where learners learn through SVG flow animation + interactive solver instead of static docs.

**Architecture:** One static data file `src/lib/hld.ts` mirrors `problems.ts`; server pages under `src/app/hld/` render shells; three client islands (`HldFlow`, `HldPlayground`, `HldSolver`) provide animation + interactivity with zero new deps (CSS keyframes + useState).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, TypeScript, vitest. No new dependencies.

**Spec:** Chat-approved design 2026-09-19: Learn + 1 solver, CSS/SVG flow anim, Classic 3 (URL Shortener, Twitter Timeline, Rate Limiter).

## Global Constraints

- Server-first: pages/routes are server components; `"use client"` only for interactive islands.
- All SQL lives behind `getDb()` in `src/lib/db.ts` — no DB changes in this plan (HLD drafts use localStorage).
- Dark mode is class-based (`.dark`); every new surface needs `dark:` variants.
- Stage ids stable; HLD stages: `requirements|capacity|api|diagram|deepdive`.
- Lint is strict (`setState`-in-effect errors): use `useSyncExternalStore` for hydration, effects for callbacks only.
- No real API keys; no `data/` or `.env*` commits.
- Respect `prefers-reduced-motion` (existing global CSS already collapses animations).

---

### Task 1: HLD data model + capacity math

**Files:**
- Create: `src/lib/hld.ts`
- Test: `src/lib/hld.test.ts`

**Interfaces:**
- Consumes: none (static data, mirrors `src/lib/problems.ts` shape).
- Produces: `HLDProblem` type, `HLD_PROBLEMS: HLDProblem[]`, `hldBySlug(slug): HLDProblem | undefined`, `estimateCapacity(input: CapacityInput): CapacityOutput`.

```ts
export interface FlowStep { id: string; label: string; detail: string; }
export interface CapacityInput { rps: number; readRatio: number; cacheHit: number; shards: number; }
export interface CapacityOutput { dbRps: number; storagePerDayGB: number; }
export interface HLDProblem {
  id: string; slug: string; title: string; difficulty: "Easy"|"Medium"|"Hard";
  summary: string; requirements: string[]; nonGoals: string[];
  capacityWorked: { rps: number; avgBytes: number; note: string };
  apis: { method: string; path: string; desc: string }[];
  flow: FlowStep[]; components: { name: string; role: string }[];
  deepdives: { q: string; hint: string }[]; decisions: string[];
}
```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/hld.test.ts
import { describe, expect, it } from "vitest";
import { HLD_PROBLEMS, estimateCapacity, hldBySlug } from "./hld";
describe("hld", () => {
  it("ships classic 3", () => {
    expect(HLD_PROBLEMS.map(p => p.slug).sort()).toEqual(["rate-limiter","twitter-timeline","url-shortener"]);
  });
  it("resolves by slug", () => {
    expect(hldBySlug("url-shortener")?.title).toBe("URL Shortener");
  });
  it("capacity math scales with cache hit + shards", () => {
    const out = estimateCapacity({ rps: 1000, readRatio: 0.9, cacheHit: 0.8, shards: 4 });
    expect(out.dbRps).toBeCloseTo(1000*0.9*0.2 + 1000*0.1);
    expect(out.storagePerDayGB).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/hld.test.ts`
Expected: FAIL with "Failed to resolve import ./hld"

- [ ] **Step 3: Write minimal implementation**

Full `src/lib/hld.ts` with 3 problems (URL Shortener, Twitter Timeline, Rate Limiter), each: 4-5 requirements, capacityWorked, 3 apis, 5 flow steps, 5-6 components, 3 deepdives, 3-4 decisions. Plus:
```ts
export function estimateCapacity(i: CapacityInput): CapacityOutput {
  const reads = i.rps * i.readRatio; const writes = i.rps - reads;
  const dbRps = reads * (1 - i.cacheHit) + writes;
  const storagePerDayGB = (writes * 86400 * 1024) / 1e9;
  return { dbRps, storagePerDayGB };
}
export const hldBySlug = (slug: string) => HLD_PROBLEMS.find(p => p.slug === slug);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/hld.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/hld.ts src/lib/hld.test.ts
git commit -m "feat(hld): add HLD data model + capacity math"
```

### Task 2: HLD routes + nav wiring

**Files:**
- Create: `src/app/hld/page.tsx`
- Create: `src/app/hld/[slug]/page.tsx`
- Modify: `src/app/layout.tsx` (add HLD link)
- Modify: `src/app/page.tsx` (add HLD entry card)

**Interfaces:**
- Consumes: `HLD_PROBLEMS`, `hldBySlug` from Task 1.
- Produces: routes `/hld`, `/hld/[slug]`.

- [ ] **Step 1: Write pages (no new test — server render covered by build)**

`src/app/hld/page.tsx`: server component listing 3 problems with difficulty badge + summary + link, dark variants.
`src/app/hld/[slug]/page.tsx`: `notFound()` guard, requirements/capacity/API sections, renders islands from Tasks 3-4 via `<HldFlow steps/>`, `<HldPlayground/>`, `<HldSolver problem/>` with tab state (`?tab=learn|solve`, default learn).

- [ ] **Step 2: Wire nav**

layout.tsx: add `<Link href="/hld">HLD</Link>` next to Learn. page.tsx: add HLD promo card linking `/hld`.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: PASS, `/hld` + `/hld/url-shortener` in output.

- [ ] **Step 4: Commit**

```bash
git add src/app/hld src/app/layout.tsx src/app/page.tsx
git commit -m "feat(hld): add HLD routes + nav"
```

### Task 3: Animated flow + playground islands

**Files:**
- Create: `src/components/HldFlow.tsx`
- Create: `src/components/HldPlayground.tsx`
- Test: extend `src/lib/hld.test.ts` (already covers `estimateCapacity` — playground reuses it, no DOM test needed)

**Interfaces:**
- Consumes: `FlowStep[]`, `estimateCapacity` from Task 1.
- Produces: `<HldFlow steps={} />`, `<HldPlayground defaultRps={} />`.

- [ ] **Step 1: Build HldFlow**

`"use client"`, `useState` for `playing: boolean`, `stepIdx: number`. Horizontal SVG: boxes per step + animated dot (`<circle>` with CSS `offset-path` or SMIL `<animateMotion>` — SMIL = zero CSS, respects reduced-motion via media query hiding animation). Play/pause + Prev/Next + step detail text. `dark:` stroke/fill variants.

- [ ] **Step 2: Build HldPlayground**

`"use client"`, sliders for rps (100-50000), cacheHit (0-0.95), shards (1-32); live `estimateCapacity` readout (dbRps, per-shard RPS, storage/day). Pure `useState`, no effect-setState.

- [ ] **Step 3: Verify**

Run: `npm run lint && npm test -- src/lib/hld.test.ts`
Expected: PASS, zero lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HldFlow.tsx src/components/HldPlayground.tsx
git commit -m "feat(hld): animated flow + capacity playground"
```

### Task 4: Interactive solver island + final verification

**Files:**
- Create: `src/components/HldSolver.tsx`

**Interfaces:**
- Consumes: `HLDProblem` from Task 1.
- Produces: `<HldSolver problem={} />` with stages requirements→capacity→api→diagram→deepdive, localStorage drafts (`hld-draft-<slug>`), per-stage checkmarks.

- [ ] **Step 1: Build HldSolver**

`"use client"`: stage tabs, requirements checkboxes, capacity numeric inputs checked against `capacityWorked` (±20% tolerance), API textarea (min-length check), diagram click-to-connect (select two components → edge list), deepdive self-mark. Progress bar. localStorage load lazily via `useState(() => ...)` (no setState-in-effect). All surfaces `dark:`.

- [ ] **Step 2: Wire into `[slug]/page.tsx` solve tab**

- [ ] **Step 3: Full verification**

Run: `npm test && npm run lint && npm run build`
Expected: all green (161+3 tests).

- [ ] **Step 4: Commit**

```bash
git add src/components/HldSolver.tsx "src/app/hld/[slug]/page.tsx"
git commit -m "feat(hld): interactive solver"
```
