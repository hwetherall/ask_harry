import { kv } from "@vercel/kv";

export interface RateLimitConfig {
  limit: number;
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
}

const DEFAULT_CONFIG: RateLimitConfig = { limit: 10, windowSec: 60 };

export async function rateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / 1000 / config.windowSec);
  const key = `rl:${ip}:${bucket}`;
  const count = await kv.incr(key);
  if (count === 1) {
    await kv.expire(key, config.windowSec);
  }
  return {
    ok: count <= config.limit,
    remaining: Math.max(0, config.limit - count),
  };
}
