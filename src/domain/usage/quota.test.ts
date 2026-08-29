import { describe, expect, it } from "vitest";

import { assertDurationAllowed } from "@/domain/usage/duration";
import { UsageError } from "@/domain/usage/errors";
import { createRedisUsageCounterStore } from "@/domain/usage/counter-store";
import {
  dailyKeyTtlSeconds,
  getUsageSnapshot,
  globalDailyUsageKey,
  globalHourlyUsageKey,
  refundGenerateSlot,
  reserveGenerateSlot,
  userDailyUsageKey,
  utcDayPeriodEndsAt,
  utcDayPeriodKey,
  type UsageCounterStore,
} from "@/domain/usage/quota";
import { analysisConfig } from "@/domain/analysis/config";

function memoryCounters(): UsageCounterStore & {
  data: Map<string, { value: number; ttl?: number }>;
} {
  const data = new Map<string, { value: number; ttl?: number }>();

  return {
    data,
    async consume(key, limit, ttlSeconds) {
      const cur = data.get(key)?.value ?? 0;
      const next = cur + 1;
      if (next === 1) {
        data.set(key, { value: next, ttl: ttlSeconds });
      } else {
        data.set(key, { value: next, ttl: data.get(key)?.ttl });
      }
      if (next > limit) {
        data.set(key, { value: cur, ttl: data.get(key)?.ttl });
        return -1;
      }
      return next;
    },
    async reserve(keys, limits, ttlSeconds) {
      const increments: string[] = [];
      for (let index = 0; index < keys.length; index++) {
        const key = keys[index]!;
        const limit = limits[index]!;
        const ttl = ttlSeconds[index]!;
        const used = await this.consume(key, limit, ttl);
        if (used < 0) {
          for (const prior of increments) {
            await this.refund(prior);
          }
          return { ok: false, failedIndex: index + 1 };
        }
        increments.push(key);
      }
      const userUsed = await this.get(keys[0]!);
      return { ok: true, userUsed };
    },
    async refund(key) {
      const cur = data.get(key)?.value ?? 0;
      if (cur <= 0) {
        return 0;
      }
      const next = cur - 1;
      data.set(key, { value: next, ttl: data.get(key)?.ttl });
      return next;
    },
    async get(key) {
      return data.get(key)?.value ?? 0;
    },
  };
}

const at = new Date(Date.UTC(2026, 7, 24, 15, 0, 0));
const now = () => at;
const getFreePlan = async () => "free" as const;
const getProPlan = async () => "pro" as const;

describe("daily usage keys", () => {
  it("builds UTC day keys and period end", () => {
    expect(userDailyUsageKey("user-1", "basic", at)).toBe(
      "vb:usage:u:user-1:basic:d:20260824",
    );
    expect(utcDayPeriodKey(at)).toBe("20260824");
    expect(utcDayPeriodEndsAt(at).toISOString()).toBe(
      "2026-08-25T00:00:00.000Z",
    );
    expect(dailyKeyTtlSeconds(at)).toBeGreaterThan(24 * 60 * 60);
  });
});

describe("assertDurationAllowed", () => {
  it("rejects null duration on free (fail closed)", () => {
    expect(() => assertDurationAllowed("free", null)).toThrow(UsageError);
  });

  it("allows free boundary and rejects over", () => {
    expect(() => assertDurationAllowed("free", 20 * 60)).not.toThrow();
    expect(() => assertDurationAllowed("free", 20 * 60 + 1)).toThrow(UsageError);
  });

  it("allows pro up to 5 hours and rejects over", () => {
    expect(() => assertDurationAllowed("pro", 5 * 60 * 60)).not.toThrow();
    expect(() => assertDurationAllowed("pro", 5 * 60 * 60 + 1)).toThrow(
      UsageError,
    );
    expect(() => assertDurationAllowed("pro", null)).toThrow(UsageError);
  });
});

describe("reserveGenerateSlot", () => {
  it("consumes advanced user quota by default for free users", async () => {
    const counters = memoryCounters();

    const slot = await reserveGenerateSlot("user-1", {
      counters,
      getPlan: getFreePlan,
      now,
    });

    expect(slot.tier).toBe("advanced");
    expect(slot.usage.advanced.used).toBe(1);
    expect(await counters.get(userDailyUsageKey("user-1", "advanced", at))).toBe(
      1,
    );
    expect(await counters.get(userDailyUsageKey("user-1", "basic", at))).toBe(0);
  });

  it("honors explicit basic requests", async () => {
    const counters = memoryCounters();

    const slot = await reserveGenerateSlot("user-1", {
      counters,
      getPlan: getFreePlan,
      now,
      requestedTier: "basic",
    });

    expect(slot.tier).toBe("basic");
    expect(await counters.get(userDailyUsageKey("user-1", "basic", at))).toBe(1);
  });

  it("uses basic only when advanced model is disabled", async () => {
    const counters = memoryCounters();

    const previous = process.env.ADVANCED_MODEL_ENABLED;
    process.env.ADVANCED_MODEL_ENABLED = "0";

    try {
      const slot = await reserveGenerateSlot("user-1", {
        counters,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
      });

      expect(slot.tier).toBe("basic");
      expect(await counters.get(userDailyUsageKey("user-1", "basic", at))).toBe(1);
    } finally {
      if (previous === undefined) {
        delete process.env.ADVANCED_MODEL_ENABLED;
      } else {
        process.env.ADVANCED_MODEL_ENABLED = previous;
      }
    }
  });

  it("falls back to basic when advanced user quota is exhausted", async () => {
    const counters = memoryCounters();
    const limit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < limit; i++) {
      await reserveGenerateSlot("user-1", {
        counters,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
      });
    }

    const slot = await reserveGenerateSlot("user-1", {
      counters,
      getPlan: getFreePlan,
      now,
      requestedTier: "advanced",
    });

    expect(slot.tier).toBe("basic");
    expect(slot.fellBackFrom).toBe("advanced");
    expect(await counters.get(userDailyUsageKey("user-1", "basic", at))).toBe(1);
  });

  it("does not consume global advanced when falling back to basic", async () => {
    const counters = memoryCounters();
    const limit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < limit; i++) {
      await reserveGenerateSlot("user-1", {
        counters,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
      });
    }

    await reserveGenerateSlot("user-1", {
      counters,
      getPlan: getFreePlan,
      now,
      requestedTier: "advanced",
    });

    expect(await counters.get(globalHourlyUsageKey("advanced", at))).toBe(limit);
    expect(await counters.get(globalHourlyUsageKey("basic", at))).toBe(1);
  });

  it("rejects when both user tiers are exhausted", async () => {
    const counters = memoryCounters();
    const basicLimit = analysisConfig.planLimits.free.daily.basic;
    const advancedLimit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < advancedLimit; i++) {
      await reserveGenerateSlot("user-1", {
        counters,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
      });
    }
    for (let i = 0; i < basicLimit; i++) {
      await reserveGenerateSlot("user-1", {
        counters,
        getPlan: getFreePlan,
        now,
        requestedTier: "basic",
      });
    }

    await expect(
      reserveGenerateSlot("user-1", {
        counters,
        getPlan: getFreePlan,
        now,
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("enforces global advanced hourly limits without tier fallback", async () => {
    const counters = memoryCounters();
    const hourlyLimit = analysisConfig.usageLimits.global.advanced.hourly;

    for (let i = 0; i < hourlyLimit; i++) {
      await reserveGenerateSlot(`user-${i}`, {
        counters,
        getPlan: getProPlan,
        now,
        requestedTier: "advanced",
      });
    }

    await expect(
      reserveGenerateSlot("user-overflow", {
        counters,
        getPlan: getProPlan,
        now,
        requestedTier: "advanced",
      }),
    ).rejects.toMatchObject({ code: "rate_limit_exceeded", scope: "global" });
  });

  it("enforces global advanced daily limits without tier fallback", async () => {
    const counters = memoryCounters();
    const globalLimit = analysisConfig.usageLimits.global.advanced.daily;
    const key = globalDailyUsageKey("advanced", at);
    for (let i = 0; i < globalLimit; i++) {
      await counters.consume(key, globalLimit, 1000);
    }

    await expect(
      reserveGenerateSlot("user-overflow", {
        counters,
        getPlan: getProPlan,
        now,
        requestedTier: "advanced",
      }),
    ).rejects.toMatchObject({ code: "rate_limit_exceeded", scope: "global" });
  });

  it("enforces IP advanced daily limits", async () => {
    const counters = memoryCounters();
    const ipLimit = analysisConfig.usageLimits.ip.advanced.daily;

    for (let i = 0; i < ipLimit; i++) {
      await reserveGenerateSlot(`user-${i}`, {
        counters,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        ipHash: "iphash1",
      });
    }

    await expect(
      reserveGenerateSlot("user-overflow", {
        counters,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        ipHash: "iphash1",
      }),
    ).rejects.toMatchObject({ code: "rate_limit_exceeded", scope: "ip" });
  });

  it("refunds all reserved keys from usageQuotaKey", async () => {
    const counters = memoryCounters();

    const slot = await reserveGenerateSlot("user-1", {
      counters,
      getPlan: getFreePlan,
      now,
      ipHash: "iphash1",
    });

    await refundGenerateSlot("user-1", {
      counters,
      usageQuotaKey: slot.usageQuotaKey,
    });

    for (const key of slot.redisKeys) {
      expect(await counters.get(key)).toBe(0);
    }
  });
});

describe("getUsageSnapshot", () => {
  it("returns per-tier daily usage and combined totals", async () => {
    const counters = memoryCounters();
    await counters.consume(userDailyUsageKey("user-1", "basic", at), 10, 1000);
    await counters.consume(userDailyUsageKey("user-1", "advanced", at), 5, 1000);
    await counters.consume(userDailyUsageKey("user-1", "advanced", at), 5, 1000);

    const snapshot = await getUsageSnapshot("user-1", {
      counters,
      getPlan: getFreePlan,
      now,
    });

    expect(snapshot).toMatchObject({
      plan: "free",
      periodKey: "20260824",
      maxDurationSeconds: 20 * 60,
      tiers: {
        basic: { used: 1, limit: 10 },
        advanced: { used: 2, limit: 5 },
      },
      used: 3,
      limit: 15,
    });
  });
});

describe("createRedisUsageCounterStore", () => {
  it("runs reserve lua against a fake redis eval", async () => {
    const storeData = new Map<string, string>();
    const redis = {
      async eval(
        script: string,
        numKeys: number,
        ...args: string[]
      ) {
        const keys = args.slice(0, numKeys);
        const pairs = args.slice(numKeys);

        if (script.includes("for i = 1, num_keys")) {
          for (let index = 0; index < keys.length; index++) {
            const key = keys[index]!;
            const limit = Number(pairs[index * 2]);
            const ttl = Number(pairs[index * 2 + 1]);
            const current = Number(storeData.get(key) ?? "0") + 1;
            storeData.set(key, String(current));
            if (current === 1) {
              storeData.set(`${key}:ttl`, String(ttl));
            }
            if (current > limit) {
              storeData.set(key, String(current - 1));
              for (let j = 0; j < index; j++) {
                const prior = keys[j]!;
                const priorValue = Number(storeData.get(prior) ?? "1") - 1;
                storeData.set(prior, String(Math.max(0, priorValue)));
              }
              return -(index + 1);
            }
          }
          return Number(storeData.get(keys[0]!));
        }

        if (script.includes("INCR")) {
          const key = keys[0]!;
          const limit = Number(pairs[0]);
          const ttl = Number(pairs[1]);
          const current = Number(storeData.get(key) ?? "0") + 1;
          storeData.set(key, String(current));
          if (current === 1) {
            storeData.set(`${key}:ttl`, String(ttl));
          }
          if (current > limit) {
            storeData.set(key, String(current - 1));
            return -1;
          }
          return current;
        }

        const key = keys[0]!;
        const raw = storeData.get(key);
        if (raw == null) {
          return 0;
        }
        const n = Number(raw);
        if (n <= 0) {
          return 0;
        }
        storeData.set(key, String(n - 1));
        return n - 1;
      },
      async get(key: string) {
        return storeData.get(key) ?? null;
      },
    };

    const store = createRedisUsageCounterStore(redis as never);
    const result = await store.reserve(
      ["user", "global"],
      [2, 5],
      [60, 120],
    );
    expect(result).toEqual({ ok: true, userUsed: 1 });
    expect(await store.reserve(["user", "global"], [2, 5], [60, 120])).toEqual({
      ok: true,
      userUsed: 2,
    });
    expect(await store.reserve(["user", "global"], [2, 5], [60, 120])).toEqual({
      ok: false,
      failedIndex: 1,
    });
    expect(storeData.get("user")).toBe("2");
    expect(await store.refund("user")).toBe(1);
  });
});
