import { describe, expect, it } from "vitest";

import { assertDurationAllowed } from "@/domain/usage/duration";
import { UsageError } from "@/domain/usage/errors";
import type { ModelTier } from "@/db/schema";
import {
  getUsageSnapshot,
  refundGenerateSlot,
  reserveGenerateSlot,
  utcDayPeriodEndsAt,
  utcDayPeriodKey,
  type UsageEventStore,
} from "@/domain/usage/quota";
import { utcHourPeriodKey } from "@/domain/usage/keys";
import { analysisConfig } from "@/domain/analysis/config";

type StoredEvent = {
  userId: string;
  runId: string;
  tier: ModelTier;
  periodDay: string;
  periodHour: string;
  ipHash: string | null;
  refunded: boolean;
};

function memoryStore(): UsageEventStore {
  const events: StoredEvent[] = [];

  return {
    async reserve(input) {
      const periodDay = utcDayPeriodKey(input.now);
      const periodHour = utcHourPeriodKey(input.now);
      const active = events.filter((event) => !event.refunded);

      const userUsed = active.filter(
        (event) =>
          event.userId === input.userId &&
          event.periodDay === periodDay &&
          event.tier === input.tier,
      ).length;
      if (userUsed >= input.limits.user) {
        return { ok: false, failedScope: "user" };
      }

      const globalHourlyUsed = active.filter(
        (event) => event.periodHour === periodHour && event.tier === input.tier,
      ).length;
      if (globalHourlyUsed >= input.limits.globalHourly) {
        return { ok: false, failedScope: "global" };
      }

      const globalDailyUsed = active.filter(
        (event) => event.periodDay === periodDay && event.tier === input.tier,
      ).length;
      if (globalDailyUsed >= input.limits.globalDaily) {
        return { ok: false, failedScope: "global" };
      }

      if (input.ipHash && input.limits.ip != null) {
        const ipUsed = active.filter(
          (event) =>
            event.ipHash === input.ipHash &&
            event.periodDay === periodDay &&
            event.tier === input.tier,
        ).length;
        if (ipUsed >= input.limits.ip) {
          return { ok: false, failedScope: "ip" };
        }
      }

      events.push({
        userId: input.userId,
        runId: input.runId,
        tier: input.tier,
        periodDay,
        periodHour,
        ipHash: input.ipHash,
        refunded: false,
      });
      return { ok: true, userUsed: userUsed + 1 };
    },
    async refund(userId, runId) {
      const event = events.find(
        (row) => row.userId === userId && row.runId === runId && !row.refunded,
      );
      if (event) {
        event.refunded = true;
      }
    },
    async countUserDaily(userId, tier, now) {
      const periodDay = utcDayPeriodKey(now);
      return events.filter(
        (event) =>
          !event.refunded &&
          event.userId === userId &&
          event.tier === tier &&
          event.periodDay === periodDay,
      ).length;
    },
  };
}

const at = new Date(Date.UTC(2026, 7, 24, 15, 0, 0));
const now = () => at;
const getFreePlan = async () => "free" as const;
const getProPlan = async () => "pro" as const;

describe("daily usage periods", () => {
  it("builds UTC day keys and period end", () => {
    expect(utcDayPeriodKey(at)).toBe("20260824");
    expect(utcHourPeriodKey(at)).toBe("2026082415");
    expect(utcDayPeriodEndsAt(at).toISOString()).toBe(
      "2026-08-25T00:00:00.000Z",
    );
  });
});

describe("assertDurationAllowed", () => {
  it("rejects null duration (fail closed)", () => {
    expect(() => assertDurationAllowed("basic", null)).toThrow(UsageError);
    expect(() => assertDurationAllowed("advanced", null)).toThrow(UsageError);
  });

  it("allows basic boundary and rejects over", () => {
    expect(() => assertDurationAllowed("basic", 20 * 60)).not.toThrow();
    expect(() => assertDurationAllowed("basic", 20 * 60 + 1)).toThrow(UsageError);
  });

  it("allows advanced up to 2 hours and rejects over", () => {
    expect(() => assertDurationAllowed("advanced", 2 * 60 * 60)).not.toThrow();
    expect(() => assertDurationAllowed("advanced", 2 * 60 * 60 + 1)).toThrow(
      UsageError,
    );
  });
});

describe("reserveGenerateSlot", () => {
  it("consumes advanced user quota by default for free users", async () => {
    const store = memoryStore();

    const slot = await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
    });

    expect(slot.tier).toBe("advanced");
    expect(slot.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(slot.usage.advanced.used).toBe(1);
    expect(await store.countUserDaily("user-1", "advanced", at)).toBe(1);
    expect(await store.countUserDaily("user-1", "basic", at)).toBe(0);
  });

  it("honors explicit basic requests", async () => {
    const store = memoryStore();

    const slot = await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
      requestedTier: "basic",
    });

    expect(slot.tier).toBe("basic");
    expect(await store.countUserDaily("user-1", "basic", at)).toBe(1);
  });

  it("uses basic only when advanced model is disabled", async () => {
    const store = memoryStore();

    const previous = process.env.ADVANCED_MODEL_ENABLED;
    process.env.ADVANCED_MODEL_ENABLED = "0";

    try {
      const slot = await reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        durationSeconds: 60,
      });

      expect(slot.tier).toBe("basic");
      expect(await store.countUserDaily("user-1", "basic", at)).toBe(1);
    } finally {
      if (previous === undefined) {
        delete process.env.ADVANCED_MODEL_ENABLED;
      } else {
        process.env.ADVANCED_MODEL_ENABLED = previous;
      }
    }
  });

  it("falls back to basic when advanced user quota is exhausted", async () => {
    const store = memoryStore();
    const limit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < limit; i++) {
      await reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        durationSeconds: 60,
      });
    }

    const slot = await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
      requestedTier: "advanced",
      durationSeconds: 60,
    });

    expect(slot.tier).toBe("basic");
    expect(slot.fellBackFrom).toBe("advanced");
    expect(await store.countUserDaily("user-1", "basic", at)).toBe(1);
  });

  it("does not fall back to basic when the video exceeds the basic duration", async () => {
    const store = memoryStore();
    const limit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < limit; i++) {
      await reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        durationSeconds: 60,
      });
    }

    await expect(
      reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        durationSeconds: 90 * 60,
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded", tier: "advanced" });
    expect(await store.countUserDaily("user-1", "basic", at)).toBe(0);
  });

  it("does not fall back to basic when duration is unknown", async () => {
    const store = memoryStore();
    const limit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < limit; i++) {
      await reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        durationSeconds: 60,
      });
    }

    await expect(
      reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        durationSeconds: null,
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("does not consume global advanced when falling back to basic", async () => {
    const store = memoryStore();
    const limit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < limit; i++) {
      await reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
        durationSeconds: 60,
      });
    }

    await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
      requestedTier: "advanced",
      durationSeconds: 60,
    });

    expect(await store.countUserDaily("user-1", "advanced", at)).toBe(limit);
    expect(await store.countUserDaily("user-1", "basic", at)).toBe(1);
  });

  it("rejects when both user tiers are exhausted", async () => {
    const store = memoryStore();
    const basicLimit = analysisConfig.planLimits.free.daily.basic;
    const advancedLimit = analysisConfig.planLimits.free.daily.advanced;

    for (let i = 0; i < advancedLimit; i++) {
      await reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "advanced",
      });
    }
    for (let i = 0; i < basicLimit; i++) {
      await reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "basic",
      });
    }

    await expect(
      reserveGenerateSlot("user-1", {
        store,
        getPlan: getFreePlan,
        now,
      }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("enforces global advanced hourly limits without tier fallback", async () => {
    const store = memoryStore();
    const hourlyLimit = analysisConfig.usageLimits.global.advanced.hourly;

    for (let i = 0; i < hourlyLimit; i++) {
      await reserveGenerateSlot(`user-${i}`, {
        store,
        getPlan: getProPlan,
        now,
        requestedTier: "advanced",
      });
    }

    await expect(
      reserveGenerateSlot("user-overflow", {
        store,
        getPlan: getProPlan,
        now,
        requestedTier: "advanced",
      }),
    ).rejects.toMatchObject({ code: "rate_limit_exceeded", scope: "global" });
  });

  it("enforces global advanced daily limits without tier fallback", async () => {
    const store = memoryStore();
    const globalLimit = analysisConfig.usageLimits.global.advanced.daily;

    for (let i = 0; i < globalLimit; i++) {
      const hour = new Date(Date.UTC(2026, 7, 24, i % 24, 0, 0));
      await reserveGenerateSlot(`user-${i}`, {
        store,
        getPlan: getProPlan,
        now: () => hour,
        requestedTier: "advanced",
      });
    }

    await expect(
      reserveGenerateSlot("user-overflow", {
        store,
        getPlan: getProPlan,
        now,
        requestedTier: "advanced",
      }),
    ).rejects.toMatchObject({ code: "rate_limit_exceeded", scope: "global" });
  });

  it("enforces IP daily limits", async () => {
    const store = memoryStore();
    const ipLimit = analysisConfig.usageLimits.ip.basic.daily;

    for (let i = 0; i < ipLimit; i++) {
      const hour = new Date(Date.UTC(2026, 7, 24, i % 24, 0, 0));
      await reserveGenerateSlot(`user-${i}`, {
        store,
        getPlan: getFreePlan,
        now: () => hour,
        requestedTier: "basic",
        ipHash: "iphash1",
      });
    }

    await expect(
      reserveGenerateSlot("user-overflow", {
        store,
        getPlan: getFreePlan,
        now,
        requestedTier: "basic",
        ipHash: "iphash1",
      }),
    ).rejects.toMatchObject({ code: "rate_limit_exceeded", scope: "ip" });
  });

  it("refunds a reserved run", async () => {
    const store = memoryStore();

    const slot = await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
      ipHash: "iphash1",
    });

    await refundGenerateSlot("user-1", {
      store,
      runId: slot.runId,
    });

    expect(await store.countUserDaily("user-1", slot.tier, at)).toBe(0);
  });
});

describe("getUsageSnapshot", () => {
  it("returns per-tier daily usage and combined totals", async () => {
    const store = memoryStore();
    await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
      requestedTier: "basic",
    });
    await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
      requestedTier: "advanced",
    });
    await reserveGenerateSlot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
      requestedTier: "advanced",
    });

    const snapshot = await getUsageSnapshot("user-1", {
      store,
      getPlan: getFreePlan,
      now,
    });

    expect(snapshot).toMatchObject({
      plan: "free",
      periodKey: "20260824",
      tiers: {
        basic: { used: 1, limit: 10 },
        advanced: { used: 2, limit: 5 },
      },
      used: 3,
      limit: 15,
    });
  });
});
