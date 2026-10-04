/**
 * In-process rate limiting.
 *
 * Deliberately per-instance and in-memory: there is no shared store in this
 * build, so limits apply to a single server process and reset on restart. That is
 * enough to blunt casual form spam, and it is not a substitute for a shared
 * limiter or an upstream gateway in a multi-instance deployment. Documented
 * rather than hidden.
 */
interface Bucket {
  count: number;
  windowStartedAt: number;
}

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing without bound in a long-running process. */
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.windowStartedAt > options.windowMs) {
        buckets.delete(bucketKey);
      }
    }
  }

  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt > options.windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= options.limit) {
    const retryAfterMs = options.windowMs - (now - bucket.windowStartedAt);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Test seam. */
export function resetRateLimits(): void {
  buckets.clear();
}