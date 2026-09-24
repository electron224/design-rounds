export interface FlowStep {
  id: string;
  label: string;
  detail: string;
}

export interface CapacityInput {
  rps: number;
  readRatio: number;
  cacheHit: number;
  shards: number;
}

export interface CapacityOutput {
  dbRps: number;
  storagePerDayGB: number;
}

export interface HLDProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  summary: string;
  requirements: string[];
  nonGoals: string[];
  capacityWorked: { rps: number; avgBytes: number; note: string };
  apis: { method: string; path: string; desc: string }[];
  flow: FlowStep[];
  components: { name: string; role: string }[];
  deepdives: { q: string; hint: string }[];
  decisions: string[];
}

export const HLD_PROBLEMS: HLDProblem[] = [
  {
    id: "url-shortener",
    slug: "url-shortener",
    title: "URL Shortener",
    difficulty: "Easy",
    summary:
      "Design a TinyURL-style service: shorten long URLs, redirect with low latency, survive viral spikes.",
    requirements: [
      "POST /shorten takes a long URL, returns a short code (7 chars).",
      "GET /:code redirects (302) to the long URL in <50ms p99.",
      "Support 100M URLs/month, 10:1 read:write ratio.",
      "Custom aliases + TTL expiry for links.",
      "Analytics: per-link click counts (eventual consistency OK).",
    ],
    nonGoals: ["Full web-crawl indexing", "Malware scanning pipeline"],
    capacityWorked: {
      rps: 500,
      avgBytes: 1024,
      note: "500 writes/s → ~43M/day. 5000 reads/s, 80% cache hit → ~1000 DB reads/s.",
    },
    apis: [
      { method: "POST", path: "/v1/shorten", desc: "Body {url, alias?, ttlDays?} → {code}. 201, 409 on alias clash." },
      { method: "GET", path: "/:code", desc: "302 redirect + Location header; 404 on unknown/expired." },
      { method: "GET", path: "/v1/stats/:code", desc: "Click counts, eventually consistent." },
    ],
    flow: [
      { id: "client", label: "Client", detail: "Browser hits short link — a GET /:code redirect." },
      { id: "cdn", label: "CDN", detail: "Hot redirects served at edge; miss passes through." },
      { id: "lb", label: "Load Balancer", detail: "L7 routing + TLS termination across app nodes." },
      { id: "app", label: "App Servers", detail: "Stateless: validate code, read cache, emit click event." },
      { id: "cache", label: "Cache (Redis)", detail: "code→URL, 80%+ hit rate; TTL mirrors link expiry." },
      { id: "db", label: "DB (sharded KV)", detail: "Durable code→URL rows, sharded by hash(code). Async counter for clicks." },
    ],
    components: [
      { name: "CDN", role: "Serve top-1% viral links at edge" },
      { name: "Load Balancer", role: "Spread GET bursts across stateless app nodes" },
      { name: "App Servers", role: "Redirect logic, stays stateless for easy scale-out" },
      { name: "Cache (Redis)", role: "Hot code→URL map, absorbs 10:1 reads" },
      { name: "DB (sharded KV)", role: "Source of truth, hash-sharded by code" },
      { name: "Kafka + Counter", role: "Async click events → analytics (never block redirect)" },
    ],
    deepdives: [
      { q: "A celebrity link gets 100k rps. What breaks first?", hint: "Cache stampede on one key — request coalescing + CDN shielding." },
      { q: "Two users claim the same custom alias. How do you decide?", hint: "Unique constraint on alias column; first-write-wins, 409 for loser." },
      { q: "Base62 counter vs random code?", hint: "Counter needs coordination (ZooKeeper range allocator); random needs collision retry." },
    ],
    decisions: [
      "Reads never touch the DB on hit — cache-aside with TTL keeps p99 <50ms.",
      "Click analytics go async (Kafka) so redirects stay fast.",
      "Shard by hash(code) — uniform spread, no hot shard except viral keys (CDN absorbs).",
    ],
  },
  {
    id: "twitter-timeline",
    slug: "twitter-timeline",
    title: "Twitter Timeline",
    difficulty: "Medium",
    summary:
      "Design a fan-out timeline: posts, follows, and a home feed that stays fast for celebrities.",
    requirements: [
      "Post a tweet (280 chars) visible to followers.",
      "Home timeline: latest 50, paginated, <200ms p99.",
      "Follow/unfollow with immediate consistency for the actor.",
      "Support celebrity accounts (100M followers).",
      "Search and trending are out of scope for v1.",
    ],
    nonGoals: ["Full-text search ranking", "Video pipeline"],
    capacityWorked: {
      rps: 8000,
      avgBytes: 512,
      note: "8k timeline reads/s dominate; writes ~500/s. Fan-out is the cost center.",
    },
    apis: [
      { method: "POST", path: "/v1/tweets", desc: "Body {text} → {tweetId}. Fans out async." },
      { method: "GET", path: "/v1/timeline?cursor=", desc: "Latest 50 for caller, cursor-paginated." },
      { method: "POST", path: "/v1/follow/:user", desc: "Follow; backfills recent tweets async." },
    ],
    flow: [
      { id: "client", label: "Client", detail: "User posts or pulls timeline." },
      { id: "lb", label: "Load Balancer", detail: "Routes to timeline/write services." },
      { id: "write", label: "Write Service", detail: "Persists tweet, enqueues fan-out jobs." },
      { id: "fanout", label: "Fan-out Workers", detail: "Push to follower caches (normal users); celebrities pull." },
      { id: "cache", label: "Timeline Cache", detail: "Per-user materialized feeds (Redis sorted sets)." },
      { id: "db", label: "Tweet Store", detail: "Durable tweets + follow graph (sharded)." },
    ],
    components: [
      { name: "Write Service", role: "Accept tweet, persist, enqueue fan-out" },
      { name: "Fan-out Workers", role: "Push to follower feeds via queue" },
      { name: "Timeline Cache", role: "Precomputed per-user feeds for fast reads" },
      { name: "Tweet Store", role: "Source of truth for tweets" },
      { name: "Follow Graph", role: "Follower lists, sharded by user" },
      { name: "CDN / Edge", role: "Media + static assets, not the feed itself" },
    ],
    deepdives: [
      { q: "Lady Gaga tweets to 100M followers. Push or pull?", hint: "Hybrid: push for normal users, pull (merge on read) for celebrities." },
      { q: "A follower's timeline is stale after unfollow. Acceptable?", hint: "Async invalidation; actor's own view reads-through to DB." },
      { q: "How do you page without missing tweets?", hint: "Cursor on (timestamp, id), not OFFSET — stable under inserts." },
    ],
    decisions: [
      "Hybrid fan-out: push for most, pull for celebrities — bounded write amplification.",
      "Timeline reads come from cache; DB is fallback, not the hot path.",
      "Cursor pagination keeps feeds stable while new tweets land.",
    ],
  },
  {
    id: "rate-limiter",
    slug: "rate-limiter",
    title: "Rate Limiter",
    difficulty: "Medium",
    summary:
      "Design a distributed rate limiter: token bucket per API key, enforced at the gateway.",
    requirements: [
      "Limit per API key: e.g. 1000 req/min, configurable per tier.",
      "Enforce at the edge with <5ms overhead.",
      "Reject with 429 + Retry-After; headers X-RateLimit-* on every response.",
      "Survive gateway restarts without doubling quotas.",
      "Support burst (bucket) and smooth (sliding window) modes.",
    ],
    nonGoals: ["Billing metering pipeline", "WAF rules engine"],
    capacityWorked: {
      rps: 20000,
      avgBytes: 128,
      note: "20k checks/s — must be in-memory (Redis+Lua), never a SQL row per request.",
    },
    apis: [
      { method: "ANY", path: "gateway check", desc: "Internal: allow(key, cost=1) → {allow, remaining, reset}." },
      { method: "PUT", path: "/v1/limits/:key", desc: "Admin sets tier/quota for a key." },
      { method: "GET", path: "/v1/limits/:key", desc: "Read current quota + usage." },
    ],
    flow: [
      { id: "client", label: "Client", detail: "API call with key header." },
      { id: "gateway", label: "API Gateway", detail: "Extracts key, asks limiter: allow?" },
      { id: "limiter", label: "Limiter (Redis+Lua)", detail: "Atomic token-bucket/sliding-window check, single round-trip." },
      { id: "upstream", label: "Upstream Service", detail: "Serves request if allowed." },
      { id: "deny", label: "429 Path", detail: "Rejected with Retry-After; headers always set." },
    ],
    components: [
      { name: "API Gateway", role: "Enforcement point, caches tier config" },
      { name: "Limiter (Redis)", role: "Atomic counters via Lua — one RTT per check" },
      { name: "Config Store", role: "Per-key quotas/tiers, pushed to gateways" },
      { name: "Upstream", role: "Business logic, sees only allowed traffic" },
      { name: "Metrics", role: "429 rates + burn-down for alerting" },
    ],
    deepdives: [
      { q: "10 gateways each allow 1000/min — is the real limit 10k?", hint: "No global sync per request; Redis-Lua is the single counter (sticky or central)." },
      { q: "Redis goes down. Fail open or closed?", hint: "Fail-open with local cap for availability, alert loudly; payments fail closed." },
      { q: "Sliding window vs token bucket — when?", hint: "Bucket allows bursts (APIs); sliding window smooths (abuse prevention)." },
    ],
    decisions: [
      "One Lua script per check: read + decrement atomically, no race between gateways.",
      "Config cached at gateway; counters centralized in Redis — split the planes.",
      "429 always carries Retry-After + RateLimit headers so clients back off correctly.",
    ],
  },
];

export const hldBySlug = (slug: string) =>
  HLD_PROBLEMS.find((p) => p.slug === slug);

/** Back-of-envelope: DB load after cache, storage from writes. */
export function estimateCapacity(i: CapacityInput): CapacityOutput {
  const reads = i.rps * i.readRatio;
  const writes = i.rps - reads;
  const dbRps = reads * (1 - i.cacheHit) + writes;
  const storagePerDayGB = (writes * 86400 * 1024) / 1e9;
  return { dbRps, storagePerDayGB };
}

/** Upper bound of the playground RPS slider. */
export const MAX_PLAYGROUND_RPS = 100000;

/** Clamp a default into the slider range so thumbs never pin at the max. */
export function clampRps(rps: number, max = MAX_PLAYGROUND_RPS): number {
  return Math.min(Math.max(100, Math.round(rps)), max);
}

export type ShardStatus = "healthy" | "warm" | "hot";

/** Per-shard load signal for the bottleneck warning. */
export function shardStatus(perShardRps: number): ShardStatus {
  if (perShardRps >= 6000) return "hot";
  if (perShardRps >= 2000) return "warm";
  return "healthy";
}

/** Index of the cache hop (for hit/miss branching), -1 when none. */
export function cacheStepIndex(steps: FlowStep[]): number {
  return steps.findIndex(
    (s) =>
      s.id.toLowerCase().includes("cache") ||
      s.label.toLowerCase().includes("cache") ||
      s.id.toLowerCase().includes("limiter")
  );
}
