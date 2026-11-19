import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { backendKind, backendProblem, hasSupabaseEnv, supabaseConfig } from "./env";

const MANAGED_KEYS = [
  "STORE_BACKEND",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

describe("environment & backend selection", () => {
  beforeEach(() => {
    for (const key of MANAGED_KEYS) {
      vi.stubEnv(key, "");
    }
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to local when STORE_BACKEND is unset and no Supabase env vars exist", () => {
    expect(hasSupabaseEnv()).toBe(false);
    expect(backendKind()).toBe("local");
    expect(supabaseConfig()).toBeNull();
    expect(backendProblem()).toBeNull();
  });

  it("auto-detects supabase when STORE_BACKEND is unset and any SUPABASE_* var is set", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(hasSupabaseEnv()).toBe(true);
    expect(backendKind()).toBe("supabase");
    expect(supabaseConfig()).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test",
      secretKey: null,
    });
  });

  it("ignores whitespace-only env vars when detecting Supabase", () => {
    vi.stubEnv("SUPABASE_URL", "   ");
    expect(hasSupabaseEnv()).toBe(false);
    expect(backendKind()).toBe("local");
  });

  it("honours explicit STORE_BACKEND overrides in either direction", () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("STORE_BACKEND", "local");
    expect(backendKind()).toBe("local");
    expect(backendProblem()).toBeNull();

    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    vi.stubEnv("STORE_BACKEND", "supabase");
    expect(backendKind()).toBe("supabase");
    expect(backendProblem()).toMatch(/partially configured/i);
  });

  it("flags invalid STORE_BACKEND values and partial Supabase credentials", () => {
    vi.stubEnv("STORE_BACKEND", "postgres");
    expect(backendProblem()).toMatch(/Invalid STORE_BACKEND/);

    vi.stubEnv("STORE_BACKEND", "");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    expect(backendKind()).toBe("supabase");
    expect(backendProblem()).toMatch(/partially configured/i);
  });

  it("enforces production database and secret-key requirements", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(backendProblem()).toMatch(/No database is configured/);

    vi.stubEnv("STORE_BACKEND", "local");
    expect(backendProblem()).toBeNull();

    vi.stubEnv("STORE_BACKEND", "");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    expect(backendProblem()).toMatch(/SUPABASE_SECRET_KEY/);

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
    expect(backendProblem()).toBeNull();
  });
});
