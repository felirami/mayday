// Best-effort in-memory fixed-window rate limiter. Protects the shared API keys
// on a public deployment from runaway usage. (Per-instance on serverless — for
// hard guarantees use Vercel KV / Upstash; this is enough to stop casual abuse.)
const hits = new Map<string, { count: number; reset: number }>();

export interface RateResult {
  ok: boolean;
  retryAfter: number;
  remaining: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    // opportunistic cleanup so the map can't grow unbounded
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
    }
    return { ok: true, retryAfter: 0, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((entry.reset - now) / 1000), remaining: 0 };
  }

  entry.count++;
  return { ok: true, retryAfter: 0, remaining: limit - entry.count };
}

export function clientKey(req: Request, bucket: string): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  return `${bucket}:${ip}`;
}
