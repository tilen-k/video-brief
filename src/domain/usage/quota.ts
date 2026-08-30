import type { ModelTier, PlanId } from "@/db/schema";
import { isAdvancedModelEnabled } from "@/domain/analysis/model-tier";
import { analysisConfig } from "@/domain/analysis/config";
import {
  createPostgresUsageEventStore,
  type UsageEventStore,
} from "@/domain/usage/event-store";
import { durationFitsBasicFallback } from "@/domain/usage/duration";
import { UsageError } from "@/domain/usage/errors";
import {
  utcDayPeriodEndsAt,
  utcDayPeriodKey,
} from "@/domain/usage/keys";
import { getPlanForUser } from "@/domain/usage/plan";
import { errorFields, logger } from "@/lib/logger";

export type UsageQuotaDeps = {
  getPlan?: typeof getPlanForUser;
  store?: UsageEventStore;
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
  runId: string;
  usage: Record<ModelTier, TierUsage>;
  maxDurationSeconds: number | null;
};

export type UsageSnapshot = {
  plan: PlanId;
  periodKey: string;
  periodEndsAt: Date;
  tiers: Record<ModelTier, TierUsage>;
  /** Combined daily totals for transitional call sites. */
  used: number;
  limit: number;
};

function resolveStore(store?: UsageEventStore): UsageEventStore {
  return store ?? createPostgresUsageEventStore();
}

function userDailyLimit(plan: PlanId, tier: ModelTier): number {
  return analysisConfig.planLimits[plan].daily[tier];
}

async function readTierUsage(
  store: UsageEventStore,
  userId: string,
  plan: PlanId,
  now: Date,
): Promise<Record<ModelTier, TierUsage>> {
  const [basicUsed, advancedUsed] = await Promise.all([
    store.countUserDaily(userId, "basic", now),
    store.countUserDaily(userId, "advanced", now),
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
  store: UsageEventStore,
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

type TierSelection =
  | { ok: true; tier: ModelTier; fellBackFrom?: "advanced" }
  | { ok: false; reason: "none" | "needs_advanced" };

function selectEffectiveTier(
  requested: ModelTier,
  availability: { basic: boolean; advanced: boolean },
  advancedEnabled: boolean,
  durationSeconds: number | null,
): TierSelection {
  if (!advancedEnabled) {
    if (!availability.basic) {
      return { ok: false, reason: "none" };
    }
    if (!durationFitsBasicFallback(durationSeconds)) {
      return { ok: false, reason: "needs_advanced" };
    }
    return { ok: true, tier: "basic" };
  }

  if (requested === "basic") {
    return availability.basic
      ? { ok: true, tier: "basic" }
      : { ok: false, reason: "none" };
  }

  if (availability.advanced) {
    return { ok: true, tier: "advanced" };
  }

  if (availability.basic && durationFitsBasicFallback(durationSeconds)) {
    return { ok: true, tier: "basic", fellBackFrom: "advanced" };
  }

  if (availability.basic) {
    return { ok: false, reason: "needs_advanced" };
  }

  return { ok: false, reason: "none" };
}

function quotaExhaustedMessage(reason: "none" | "needs_advanced"): string {
  if (reason === "needs_advanced") {
    return "You've used today's Advanced generates. This video is longer than Basic allows (20 minutes).";
  }
  return "You've used today's generates. Resets at midnight UTC.";
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
    durationSeconds?: number | null;
    runId?: string;
  } = {},
): Promise<ReserveGenerateSlotResult> {
  const getPlan = options.getPlan ?? getPlanForUser;
  const now = options.now?.() ?? new Date();
  const durationSeconds = options.durationSeconds ?? null;
  const advancedEnabled = isAdvancedModelEnabled();
  const requested = advancedEnabled
    ? (options.requestedTier ?? "advanced")
    : "basic";
  const runId = options.runId ?? crypto.randomUUID();

  let plan: PlanId;
  try {
    plan = await getPlan(userId);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.plan_read_err");
    throw new UsageError("usage_unavailable", "Couldn't check your usage limit.", {
      cause: error,
    });
  }

  let store: UsageEventStore;
  try {
    store = resolveStore(options.store);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.store_err");
    throw new UsageError(
      "usage_unavailable",
      "Couldn't check your usage limit. Try again in a moment.",
      { cause: error },
    );
  }

  const availability = await peekUserTierAvailability(store, userId, plan, now);
  let selection = selectEffectiveTier(
    requested,
    availability,
    advancedEnabled,
    durationSeconds,
  );

  if (!selection.ok) {
    throw new UsageError(
      "quota_exceeded",
      quotaExhaustedMessage(selection.reason),
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
    runId,
  );

  if (
    !reserveResult.ok &&
    reserveResult.failedScope === "user" &&
    selection.tier === "advanced" &&
    requested === "advanced" &&
    durationFitsBasicFallback(durationSeconds)
  ) {
    const basicAvailability = await peekUserTierAvailability(store, userId, plan, now);
    if (basicAvailability.basic) {
      selection = { ok: true, tier: "basic", fellBackFrom: "advanced" };
      reserveResult = await attemptReserve(
        store,
        userId,
        plan,
        selection,
        options.ipHash ?? null,
        now,
        runId,
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

  return {
    tier: selection.tier,
    ...(selection.fellBackFrom ? { fellBackFrom: selection.fellBackFrom } : {}),
    plan,
    runId,
    usage,
    maxDurationSeconds: analysisConfig.modelTiers[selection.tier].maxDurationSeconds,
  };
}

async function attemptReserve(
  store: UsageEventStore,
  userId: string,
  plan: PlanId,
  selection: { tier: ModelTier; fellBackFrom?: "advanced" },
  ipHash: string | null,
  now: Date,
  runId: string,
): Promise<
  | { ok: true; userUsed: number }
  | {
      ok: false;
      failedScope: "user" | "global" | "ip";
      tier: ModelTier;
    }
> {
  try {
    const reserveResult = await store.reserve({
      userId,
      runId,
      tier: selection.tier,
      ipHash,
      now,
      limits: {
        user: userDailyLimit(plan, selection.tier),
        globalHourly: analysisConfig.usageLimits.global[selection.tier].hourly,
        globalDaily: analysisConfig.usageLimits.global[selection.tier].daily,
        ip: ipHash ? analysisConfig.usageLimits.ip[selection.tier].daily : null,
      },
    });
    if (!reserveResult.ok) {
      return { ok: false, failedScope: reserveResult.failedScope, tier: selection.tier };
    }
    return { ok: true, userUsed: reserveResult.userUsed };
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.reserve_err");
    throw new UsageError(
      "usage_unavailable",
      "Couldn't check your usage limit. Try again in a moment.",
      { cause: error },
    );
  }
}

export async function refundGenerateSlot(
  userId: string,
  options: UsageQuotaDeps & {
    runId?: string;
  } = {},
): Promise<void> {
  const runId = options.runId;
  if (!runId) {
    logger.warn({ userId }, "usage.refund_missing_run");
    return;
  }

  try {
    const store = resolveStore(options.store);
    await store.refund(userId, runId);
  } catch (error) {
    logger.error({ userId, runId, ...errorFields(error) }, "usage.refund_err");
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
    const store = resolveStore(deps.store);
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
    tiers,
    used: tiers.basic.used + tiers.advanced.used,
    limit: tiers.basic.limit + tiers.advanced.limit,
  };
}

export {
  createPostgresUsageEventStore,
  type UsageEventStore,
} from "./event-store";
export { utcDayPeriodEndsAt, utcDayPeriodKey } from "./keys";
