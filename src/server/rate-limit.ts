import "server-only";
import { backendKind, supabaseConfig } from "@/server/env";
import { serviceClient } from "@/server/backend/supabase/clients";

/**
 * Fixed-window rate limiter.
 *
 * When running on Supabase with `SUPABASE_SECRET_KEY`, windows are tracked in
 * Postgres (`public.check_rate_limit`) so Vercel serverless instances share the
 * same counters without an external paid store. In local mode (or if the RPC
 * is unavailable), falls back cleanly to an in-memory fixed window.
 */

type Window = { count: number; resetAt: number };
const globalKey = Symbol.for("storefront.rateLimits");
const buckets: Map<string, Window> =
  ((globalThis as Record<symbol, unknown>)[globalKey] as Map<string, Window>) ?? new Map();
(globalThis as Record<symbol, unknown>)[globalKey] = buckets;

export function rateLimitInMemory(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [name, window] of buckets) if (window.resetAt <= now) buckets.delete(name);
  }
  const window = buckets.get(key);
  if (!window || window.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  window.count += 1;
  return window.count <= limit
    ? { ok: true, retryAfterMs: 0 }
    : { ok: false, retryAfterMs: window.resetAt - now };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; retryAfterMs: number }> {
  if (backendKind() === "supabase") {
    const config = supabaseConfig();
    if (config?.secretKey) {
      try {
        const { data, error } = await serviceClient(config).rpc("check_rate_limit", {
          p_key: key,
          p_limit: limit,
          p_window_ms: windowMs,
        });
        const row = Array.isArray(data) ? data[0] : data;
        if (!error && row && typeof row.allowed === "boolean") {
          return { ok: row.allowed, retryAfterMs: Number(row.retry_after_ms ?? 0) };
        }
        if (error) {
          console.error("[rate-limit] Supabase RPC returned error, falling back to local memory limit:", error.message);
        }
      } catch (error) {
        console.error("[rate-limit] Supabase RPC execution threw exception, falling back to local memory limit:", error);
      }
    }
  }
  return rateLimitInMemory(key, limit, windowMs);
}

