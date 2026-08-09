// Simple in-memory fixed-window rate limiter. This is a small usability
// study with 5-10 testers on a single server process, not a scaled
// deployment — no need for Redis/Upstash here. If this ever needs to run
// across multiple instances, swap the Map for a shared store then.

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit = MAX_REQUESTS_PER_WINDOW,
  windowMs = WINDOW_MS,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
