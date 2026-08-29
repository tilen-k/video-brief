import type { ModelTier, PlanId } from "@/db/schema";
import { isAdvancedModelEnabled } from "@/domain/analysis/model-tier";
import { analysisConfig } from "@/domain/analysis/config";
import {
  createRedisUsageCounterStore,
  type UsageCounterStore,
} from "@/domain/usage/counter-store";
import { UsageError } from "@/domain/usage/errors";
import {
  dailyKeyTtlSeconds,
  decodeUsageQuotaKeys,
  encodeUsageQuotaKeys,
  globalDailyKeyTtlSeconds,
  globalDailyUsageKey,
  globalHourlyUsageKey,
  hourlyKeyTtlSeconds,
  ipDailyUsageKey,
  userDailyUsageKey,
  utcDayPeriodEndsAt,
  utcDayPeriodKey,
} from "@/domain/usage/keys";
import { getPlanForUser } from "@/domain/usage/plan";
import { assertRedisReady, getRedis } from "@/lib/redis";
import { errorFields, logger } from "@/lib/logger";

export type UsageQuotaDeps = {
  getPlan?: typeof getPlanForUser;
  counters?: UsageCounterStore;
  now?: () => Date;
};

export type TierUsage = {
  used: number;
  limit: number;
};

export type ReserveGenerateSlotResult = {
  tier: ModelTier;
  fellBackFrom?: "advanced";
  plan: PlanId;
  redisKeys: string[];
  usageQuotaKey: string;
  usage: Record<ModelTier, TierUsage>;
  maxDurationSeconds: number | null;
};

export type UsageSnapshot = {
  plan: PlanId;
  periodKey: string;
  periodEndsAt: Date;
  maxDurationSeconds: number | null;
  tiers: Record<ModelTier, TierUsage>;
  /** Combined daily totals for transitional call sites. */
  used: number;
  limit: number;
};

type ReservationKey = {
  key: string;
  limit: number;
  ttlSeconds: number;
  scope: "user" | "global" | "ip";
};

/** @deprecated Use reserveGenerateSlot */
export type ConsumeResult = {
  used: number;
  limit: number;
  plan: PlanId;
  redisKey: string;
};

async function resolveCounters(
  counters?: UsageCounterStore,
): Promise<UsageCounterStore> {
  if (counters) {
    return counters;
  }
  await assertRedisReady();
  return createRedisUsageCounterStore(getRedis());
}

function userDailyLimit(plan: PlanId, tier: ModelTier): number {
  return analysisConfig.planLimits[plan].daily[tier];
}

async function readTierUsage(
  store: UsageCounterStore,
  userId: string,
  plan: PlanId,
  now: Date,
): Promise<Record<ModelTier, TierUsage>> {
  const [basicUsed, advancedUsed] = await Promise.all([
    store.get(userDailyUsageKey(userId, "basic", now)),
    store.get(userDailyUsageKey(userId, "advanced", now)),
  ]);

  return {
    basic: {
      used: basicUsed,
      limit: userDailyLimit(plan, "basic"),
    },
    advanced: {
      used: advancedUsed,
      limit: userDailyLimit(plan, "advanced"),
    },
  };
}

async function peekUserTierAvailability(
  store: UsageCounterStore,
  userId: string,
  plan: PlanId,
  now: Date,
): Promise<{ basic: boolean; advanced: boolean }> {
  const usage = await readTierUsage(store, userId, plan, now);
  return {
    basic: usage.basic.used < usage.basic.limit,
    advanced: usage.advanced.used < usage.advanced.limit,
  };
}

function selectEffectiveTier(
  requested: ModelTier,
  availability: { basic: boolean; advanced: boolean },
  advancedEnabled: boolean,
): { tier: ModelTier; fellBackFrom?: "advanced" } | null {
  if (!advancedEnabled) {
    return availability.basic ? { tier: "basic" } : null;
  }

  if (requested === "basic") {
    return availability.basic ? { tier: "basic" } : null;
  }

  if (availability.advanced) {
    return { tier: "advanced" };
  }

  if (availability.basic) {
    return { tier: "basic", fellBackFrom: "advanced" };
  }

  return null;
}

function buildReservationKeys(
  userId: string,
  plan: PlanId,
  tier: ModelTier,
  ipHash: string | null,
  now: Date,
): ReservationKey[] {
  const keys: ReservationKey[] = [
    {
      key: userDailyUsageKey(userId, tier, now),
      limit: userDailyLimit(plan, tier),
      ttlSeconds: dailyKeyTtlSeconds(now),
      scope: "user",
    },
    {
      key: globalHourlyUsageKey(tier, now),
      limit: analysisConfig.usageLimits.global[tier].hourly,
      ttlSeconds: hourlyKeyTtlSeconds(),
      scope: "global",
    },
    {
      key: globalDailyUsageKey(tier, now),
      limit: analysisConfig.usageLimits.global[tier].daily,
      ttlSeconds: globalDailyKeyTtlSeconds(),
      scope: "global",
    },
  ];

  if (ipHash) {
    keys.push({
      key: ipDailyUsageKey(ipHash, tier, now),
      limit: analysisConfig.usageLimits.ip[tier].daily,
      ttlSeconds: globalDailyKeyTtlSeconds(),
      scope: "ip",
    });
  }

  return keys;
}

function scopeForFailedIndex(index: number, ipHash: string | null): "user" | "global" | "ip" {
  if (index === 1) {
    return "user";
  }
  if (index <= 3) {
    return "global";
  }
  if (ipHash && index === 4) {
    return "ip";
  }
  return "global";
}

function quotaExceededMessage(tier: ModelTier, limit: number): string {
  return `You've used all ${limit} ${tier} generates for today.`;
}

function rateLimitMessage(scope: "global" | "ip", tier: ModelTier): string {
  if (scope === "ip") {
    return `Too many ${tier} requests from this network today. Try again tomorrow.`;
  }
  return `High demand on the ${tier} model right now. Try again later or choose Basic.`;
}

export async function reserveGenerateSlot(
  userId: string,
  options: UsageQuotaDeps & {
    requestedTier?: ModelTier | null;
    ipHash?: string | null;
  } = {},
): Promise<ReserveGenerateSlotResult> {
  const getPlan = options.getPlan ?? getPlanForUser;
  const now = options.now?.() ?? new Date();
  const advancedEnabled = isAdvancedModelEnabled();
  const requested = advancedEnabled
    ? (options.requestedTier ?? "advanced")
    : "basic";

  let plan: PlanId;
  try {
    plan = await getPlan(userId);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.plan_read_err");
    throw new UsageError("usage_unavailable", "Couldn't check your usage limit.", {
      cause: error,
    });
  }

  let store: UsageCounterStore;
  try {
    store = await resolveCounters(options.counters);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.store_err");
    throw new UsageError(
      "usage_unavailable",
      "Couldn't check your usage limit. Try again in a moment.",
      { cause: error },
    );
  }

  const availability = await peekUserTierAvailability(store, userId, plan, now);
  let selection = selectEffectiveTier(requested, availability, advancedEnabled);

  if (!selection) {
    throw new UsageError(
      "quota_exceeded",
      "You've used today's generates. Resets at midnight UTC.",
      { scope: "user", tier: requested },
    );
  }

  let reserveResult = await attemptReserve(
    store,
    userId,
    plan,
    selection,
    options.ipHash ?? null,
    now,
  );

  if (
    !reserveResult.ok &&
    reserveResult.failedScope === "user" &&
    selection.tier === "advanced" &&
    requested === "advanced"
  ) {
    const basicAvailability = await peekUserTierAvailability(store, userId, plan, now);
    if (basicAvailability.basic) {
      selection = { tier: "basic", fellBackFrom: "advanced" };
      reserveResult = await attemptReserve(
        store,
        userId,
        plan,
        selection,
        options.ipHash ?? null,
        now,
      );
    }
  }

  if (!reserveResult.ok) {
    const { failedScope, tier } = reserveResult;

    if (failedScope === "user") {
      throw new UsageError(
        "quota_exceeded",
        quotaExceededMessage(tier, userDailyLimit(plan, tier)),
        { scope: failedScope, tier },
      );
    }

    throw new UsageError(
      "rate_limit_exceeded",
      rateLimitMessage(failedScope === "ip" ? "ip" : "global", tier),
      { scope: failedScope, tier },
    );
  }

  const usage = await readTierUsage(store, userId, plan, now);
  usage[selection.tier] = {
    used: reserveResult.userUsed,
    limit: userDailyLimit(plan, selection.tier),
  };

  const redisKeys = reserveResult.redisKeys;

  return {
    tier: selection.tier,
    ...(selection.fellBackFrom ? { fellBackFrom: selection.fellBackFrom } : {}),
    plan,
    redisKeys,
    usageQuotaKey: encodeUsageQuotaKeys(redisKeys),
    usage,
    maxDurationSeconds: analysisConfig.planLimits[plan].maxDurationSeconds,
  };
}

async function attemptReserve(
  store: UsageCounterStore,
  userId: string,
  plan: PlanId,
  selection: { tier: ModelTier; fellBackFrom?: "advanced" },
  ipHash: string | null,
  now: Date,
): Promise<
  | { ok: true; userUsed: number; redisKeys: string[] }
  | {
      ok: false;
      failedScope: "user" | "global" | "ip";
      tier: ModelTier;
    }
> {
  const reservation = buildReservationKeys(
    userId,
    plan,
    selection.tier,
    ipHash,
    now,
  );

  let reserveResult: { ok: true; userUsed: number } | { ok: false; failedIndex: number };
  try {
    reserveResult = await store.reserve(
      reservation.map((entry) => entry.key),
      reservation.map((entry) => entry.limit),
      reservation.map((entry) => entry.ttlSeconds),
    );
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.reserve_err");
    throw new UsageError(
      "usage_unavailable",
      "Couldn't check your usage limit. Try again in a moment.",
      { cause: error },
    );
  }

  if (!reserveResult.ok) {
    const failed = reservation[reserveResult.failedIndex - 1];
    const failedScope =
      failed?.scope ??
      scopeForFailedIndex(reserveResult.failedIndex, ipHash);
    return { ok: false, failedScope, tier: selection.tier };
  }

  return {
    ok: true,
    userUsed: reserveResult.userUsed,
    redisKeys: reservation.map((entry) => entry.key),
  };
}

export async function refundGenerateSlot(
  userId: string,
  options: UsageQuotaDeps & {
    redisKeys?: string[];
    usageQuotaKey?: string;
    /** @deprecated use usageQuotaKey */
    redisKey?: string;
  } = {},
): Promise<void> {
  const encoded = options.usageQuotaKey ?? options.redisKey;
  const keys =
    options.redisKeys ??
    (encoded ? decodeUsageQuotaKeys(encoded) : []);

  if (keys.length === 0) {
    logger.warn({ userId }, "usage.refund_missing_keys");
    return;
  }

  try {
    const store = await resolveCounters(options.counters);
    for (const key of keys) {
      await store.refund(key);
    }
  } catch (error) {
    logger.error(
      { userId, redisKeys: keys, ...errorFields(error) },
      "usage.refund_err",
    );
    throw new UsageError(
      "usage_unavailable",
      "Couldn't update your usage after a failed analysis.",
      { cause: error },
    );
  }
}

export async function getUsageSnapshot(
  userId: string,
  deps: UsageQuotaDeps = {},
): Promise<UsageSnapshot> {
  const getPlan = deps.getPlan ?? getPlanForUser;
  const now = deps.now?.() ?? new Date();

  let plan: PlanId;
  try {
    plan = await getPlan(userId);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.plan_read_err");
    throw new UsageError("usage_unavailable", "Couldn't load usage right now.", {
      cause: error,
    });
  }

  let tiers: Record<ModelTier, TierUsage>;
  try {
    const store = await resolveCounters(deps.counters);
    tiers = await readTierUsage(store, userId, plan, now);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.snapshot_err");
    throw new UsageError("usage_unavailable", "Couldn't load usage right now.", {
      cause: error,
    });
  }

  return {
    plan,
    periodKey: utcDayPeriodKey(now),
    periodEndsAt: utcDayPeriodEndsAt(now),
    maxDurationSeconds: analysisConfig.planLimits[plan].maxDurationSeconds,
    tiers,
    used: tiers.basic.used + tiers.advanced.used,
    limit: tiers.basic.limit + tiers.advanced.limit,
  };
}

/** @deprecated Use reserveGenerateSlot */
export async function consumeMonthlyGenerateSlot(
  userId: string,
  deps: UsageQuotaDeps = {},
): Promise<ConsumeResult> {
  const slot = await reserveGenerateSlot(userId, {
    ...deps,
    requestedTier: "advanced",
  });

  return {
    used: slot.usage[slot.tier].used,
    limit: slot.usage[slot.tier].limit,
    plan: slot.plan,
    redisKey: slot.usageQuotaKey,
  };
}

/** @deprecated Use refundGenerateSlot */
export async function refundMonthlyGenerateSlot(
  userId: string,
  options: UsageQuotaDeps & { redisKey?: string; usageQuotaKey?: string } = {},
): Promise<void> {
  await refundGenerateSlot(userId, {
    ...options,
    usageQuotaKey: options.usageQuotaKey ?? options.redisKey,
  });
}

export { createRedisUsageCounterStore, type UsageCounterStore } from "./counter-store";
export {
  dailyKeyTtlSeconds,
  decodeUsageQuotaKeys,
  encodeUsageQuotaKeys,
  globalDailyUsageKey,
  globalHourlyUsageKey,
  ipDailyUsageKey,
  userDailyUsageKey,
  utcDayPeriodEndsAt,
  utcDayPeriodKey,
} from "./keys";
