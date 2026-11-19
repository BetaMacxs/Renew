import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/secret", () => ({ appSecret: async () => "test-signing-secret-with-at-least-32-characters" }));

import { checkFormToken, issueFormToken } from "./form-token";

describe("checkout form tokens", () => {
  it("issues unique signed tokens for checkout pages rendered at the same time", async () => {
    const first = await issueFormToken(1_800_000_000_000);
    const second = await issueFormToken(1_800_000_000_000);
    expect(first).not.toBe(second);
    await expect(checkFormToken(first, 1_800_000_003_000)).resolves.toBe(true);
    await expect(checkFormToken(second, 1_800_000_003_000)).resolves.toBe(true);
  });

  it("rejects tokens before the minimum fill time and after expiry", async () => {
    const token = await issueFormToken(1_800_000_000_000);
    await expect(checkFormToken(token, 1_800_000_002_000)).resolves.toBe(false);
    await expect(checkFormToken(token, 1_800_000_000_000 + 24 * 60 * 60 * 1000 + 1)).resolves.toBe(false);
  });

  it("rejects modified and malformed tokens", async () => {
    const token = await issueFormToken(1_800_000_000_000);
    await expect(checkFormToken(`${token}x`, 1_800_000_003_000)).resolves.toBe(false);
    await expect(checkFormToken("1800000000000.signature", 1_800_000_003_000)).resolves.toBe(false);
    await expect(checkFormToken(null, 1_800_000_003_000)).resolves.toBe(false);
  });
});
