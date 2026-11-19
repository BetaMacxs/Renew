import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  backendKind: vi.fn(),
  supabaseConfig: vi.fn(),
  serviceClient: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/env", () => ({
  backendKind: mocks.backendKind,
  supabaseConfig: mocks.supabaseConfig,
}));
vi.mock("@/server/backend/supabase/clients", () => ({
  serviceClient: mocks.serviceClient,
}));
vi.mock("@/server/crypto", () => ({
  sha256: (value: string) => `local-hash:${value}`,
  sign: (value: string, secret: string) => `hmac:${secret}:${value}`,
}));

import { RateLimitUnavailableError, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backendKind.mockReturnValue("supabase");
    mocks.supabaseConfig.mockReturnValue({ url: "https://example.supabase.co", publishableKey: "public", secretKey: "secret" });
    mocks.serviceClient.mockReturnValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_ms: 0 }], error: null });
  });

  it("uses a hashed key with the shared Supabase counter", async () => {
    await expect(rateLimit("signin:203.0.113.8", 10, 60_000)).resolves.toEqual({ ok: true, retryAfterMs: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "hmac:secret:signin:203.0.113.8",
      p_limit: 10,
      p_window_ms: 60_000,
    });
  });

  it("fails closed when the Supabase secret key is missing", async () => {
    mocks.supabaseConfig.mockReturnValue({ url: "https://example.supabase.co", publishableKey: "public", secretKey: null });
    await expect(rateLimit("signin:203.0.113.8", 10, 60_000)).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the shared RPC returns an error", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    await expect(rateLimit("checkout:203.0.113.8", 6, 600_000)).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it("fails closed when no trustworthy client address is available", async () => {
    await expect(rateLimit("signin:unknown", 10, 60_000)).rejects.toBeInstanceOf(RateLimitUnavailableError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid limit settings", async () => {
    await expect(rateLimit("signin:test", 0, 60_000)).rejects.toThrow(RangeError);
    await expect(rateLimit("signin:test", 10, 0)).rejects.toThrow(RangeError);
  });
});
