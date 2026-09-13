interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * In-memory token bucket per key (usually client IP). Zero deps, correct for
 * a single instance; behind multiple instances move this to Redis/Upstash —
 * the call sites stay identical.
 */
export function checkLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (hit.count < limit) {
    hit.count += 1;
    return { ok: true, retryAfterSec: 0 };
  }
  return {
    ok: false,
    retryAfterSec: Math.max(1, Math.ceil((hit.resetAt - now) / 1000))
  };
}

/** Test-only: clears all buckets. */
export function __resetRateLimits(): void {
  buckets.clear();
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  return ip || "local";
}

export function rateLimited(retryAfterSec: number): Response {
  return Response.json(
    { error: "Too many requests — slow down and retry." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}
