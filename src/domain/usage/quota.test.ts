import { describe, expect, it } from "vitest";

import { assertDurationAllowed } from "@/domain/usage/duration";
import { UsageError } from "@/domain/usage/errors";
import {
  consumeMonthlyPasteSlot,
  createRedisUsageCounterStore,
  getUsageSnapshot,
  monthlyKeyTtlSeconds,
  monthlyUsageKey,
  refundMonthlyPasteSlot,
  utcMonthPeriodKey,
  utcPeriodEndsAt,
  type UsageCounterStore,
} from "@/domain/usage/quota";
import { modelIdForPlan, analysisConfig } from "@/domain/analysis/config";

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

describe("monthly usage keys", () => {
  it("builds UTC month keys and period end", () => {
    const at = new Date(Date.UTC(2026, 7, 24, 15, 0, 0));
    expect(monthlyUsageKey("user-1", at)).toBe("vb:usage:videos:user-1:202608");
    expect(utcMonthPeriodKey(at)).toBe("202608");
    expect(utcPeriodEndsAt(at).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(monthlyKeyTtlSeconds(at)).toBeGreaterThan(3 * 24 * 60 * 60);
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

  it("allows any duration on pro including null", () => {
    expect(() => assertDurationAllowed("pro", null)).not.toThrow();
    expect(() => assertDurationAllowed("pro", 10_000)).not.toThrow();
  });
});

describe("consumeMonthlyPasteSlot", () => {
  it("increments under the free limit and denies at limit", async () => {
    const counters = memoryCounters();
    const getPlan = async () => "free" as const;
    const now = () => new Date(Date.UTC(2026, 7, 1));

    for (let i = 1; i <= 10; i++) {
      const result = await consumeMonthlyPasteSlot("user-1", {
        counters,
        getPlan,
        now,
      });
      expect(result.used).toBe(i);
      expect(result.limit).toBe(10);
    }

    await expect(
      consumeMonthlyPasteSlot("user-1", { counters, getPlan, now }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });

    expect(await counters.get(monthlyUsageKey("user-1", now()))).toBe(10);
  });

  it("refunds down to zero and not below", async () => {
    const counters = memoryCounters();
    const getPlan = async () => "free" as const;
    const now = () => new Date(Date.UTC(2026, 7, 1));

    await consumeMonthlyPasteSlot("user-1", { counters, getPlan, now });
    await refundMonthlyPasteSlot("user-1", { counters, now });
    await refundMonthlyPasteSlot("user-1", { counters, now });
    expect(await counters.get(monthlyUsageKey("user-1", now()))).toBe(0);
  });

  it("refunds the consume redisKey even after month rolls", async () => {
    const counters = memoryCounters();
    const getPlan = async () => "free" as const;
    const endOfMonth = new Date(Date.UTC(2026, 7, 31, 23, 0, 0));
    const nextMonth = new Date(Date.UTC(2026, 8, 1, 1, 0, 0));

    const slot = await consumeMonthlyPasteSlot("user-1", {
      counters,
      getPlan,
      now: () => endOfMonth,
    });
    expect(slot.redisKey).toContain("202608");

    await refundMonthlyPasteSlot("user-1", {
      counters,
      redisKey: slot.redisKey,
      now: () => nextMonth,
    });
    expect(await counters.get(slot.redisKey)).toBe(0);
  });

  it("sets ttl on first consume via redis store contract", async () => {
    const calls: Array<{ key: string; limit: number; ttl: number }> = [];
    const counters: UsageCounterStore = {
      async consume(key, limit, ttlSeconds) {
        calls.push({ key, limit, ttl: ttlSeconds });
        return 1;
      },
      async refund() {
        return 0;
      },
      async get() {
        return 0;
      },
    };
    await consumeMonthlyPasteSlot("u", {
      counters,
      getPlan: async () => "free",
      now: () => new Date(Date.UTC(2026, 0, 15)),
    });
    expect(calls[0]?.ttl).toBe(monthlyKeyTtlSeconds(new Date(Date.UTC(2026, 0, 15))));
  });
});

describe("getUsageSnapshot", () => {
  it("returns plan limits and redis used count", async () => {
    const counters = memoryCounters();
    const now = () => new Date(Date.UTC(2026, 7, 24));
    await counters.consume(monthlyUsageKey("user-1", now()), 10, 1000);
    await counters.consume(monthlyUsageKey("user-1", now()), 10, 1000);

    const snapshot = await getUsageSnapshot("user-1", {
      counters,
      getPlan: async () => "free",
      now,
    });

    expect(snapshot).toMatchObject({
      plan: "free",
      used: 2,
      limit: 10,
      periodKey: "202608",
      maxDurationSeconds: 20 * 60,
    });
  });
});

describe("modelIdForPlan", () => {
  it("maps free to basic and pro to advanced", () => {
    expect(modelIdForPlan("free")).toBe(analysisConfig.models.basicId);
    expect(modelIdForPlan("pro")).toBe(analysisConfig.models.advancedId);
  });
});

describe("createRedisUsageCounterStore", () => {
  it("runs consume/refund lua against a fake redis eval", async () => {
    const storeData = new Map<string, string>();
    const redis = {
      async eval(script: string, _numKeys: number, key: string, ...args: string[]) {
        if (script.includes("INCR")) {
          const limit = Number(args[0]);
          const ttl = Number(args[1]);
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
    expect(await store.consume("k", 2, 60)).toBe(1);
    expect(storeData.get("k:ttl")).toBe("60");
    expect(await store.consume("k", 2, 60)).toBe(2);
    expect(await store.consume("k", 2, 60)).toBe(-1);
    expect(await store.get("k")).toBe(2);
    expect(await store.refund("k")).toBe(1);
    expect(await store.refund("k")).toBe(0);
    expect(await store.refund("k")).toBe(0);
  });
});
