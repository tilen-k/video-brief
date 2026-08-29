import { afterEach, describe, expect, it, vi } from "vitest";

import { hashClientIp } from "@/domain/usage/ip-hash";

describe("hashClientIp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses a dev fallback salt when unset in development", () => {
    vi.stubEnv("USAGE_IP_HASH_SALT", "");
    vi.stubEnv("NODE_ENV", "development");

    const a = hashClientIp("203.0.113.1");
    const b = hashClientIp("203.0.113.1");
    const c = hashClientIp("203.0.113.2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(16);
  });

  it("requires USAGE_IP_HASH_SALT outside development", () => {
    vi.stubEnv("USAGE_IP_HASH_SALT", "");
    vi.stubEnv("NODE_ENV", "production");

    expect(() => hashClientIp("203.0.113.1")).toThrow(
      "USAGE_IP_HASH_SALT is not set",
    );
  });
});
