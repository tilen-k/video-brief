import type IORedis from "ioredis";

import type { PlanId } from "@/db/schema";
import { analysisConfig } from "@/domain/analysis/config";
import { UsageError } from "@/domain/usage/errors";
import { getPlanForUser } from "@/domain/usage/plan";
import { assertRedisReady, getRedis } from "@/lib/redis";
import { errorFields, logger } from "@/lib/logger";

const CONSUME_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[2])
end
if current > tonumber(ARGV[1]) then
  redis.call("DECR", KEYS[1])
  return -1
end
return current
`;

const REFUND_LUA = `
local raw = redis.call("GET", KEYS[1])
if raw == false then
  return 0
end
local n = tonumber(raw)
if n == nil or n <= 0 then
  return 0
end
return redis.call("DECR", KEYS[1])
`;

export type UsageCounterStore = {
  consume(key: string, limit: number, ttlSeconds: number): Promise<number>;
  refund(key: string): Promise<number>;
  get(key: string): Promise<number>;
};

export function monthlyUsageKey(userId: string, at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `vb:usage:videos:${userId}:${y}${m}`;
}

export function utcMonthPeriodKey(at: Date = new Date()): string {
  const y = at.getUTCFullYear();
  const m = String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

/** Exclusive start of next UTC month. */
export function utcPeriodEndsAt(at: Date = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
}

/** Seconds until end of UTC month + 3 days grace. */
export function monthlyKeyTtlSeconds(at: Date = new Date()): number {
  const ends = utcPeriodEndsAt(at).getTime();
  const graceMs = 3 * 24 * 60 * 60 * 1000;
  return Math.max(60, Math.ceil((ends + graceMs - at.getTime()) / 1000));
}

export function createRedisUsageCounterStore(redis: IORedis): UsageCounterStore {
  return {
    async consume(key, limit, ttlSeconds) {
      const result = await redis.eval(
        CONSUME_LUA,
        1,
        key,
        String(limit),
        String(ttlSeconds),
      );
      return Number(result);
    },
    async refund(key) {
      const result = await redis.eval(REFUND_LUA, 1, key);
      return Number(result);
    },
    async get(key) {
      const raw = await redis.get(key);
      if (raw == null) {
        return 0;
      }
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
  };
}

export type UsageQuotaDeps = {
  getPlan?: typeof getPlanForUser;
  counters?: UsageCounterStore;
  now?: () => Date;
};

export type ConsumeResult = {
  used: number;
  limit: number;
  plan: PlanId;
  /** Redis key that was incremented — pass to refund to avoid month-boundary miss. */
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

export async function consumeMonthlyGenerateSlot(
  userId: string,
  deps: UsageQuotaDeps = {},
): Promise<ConsumeResult> {
  const getPlan = deps.getPlan ?? getPlanForUser;
  const now = deps.now?.() ?? new Date();

  let plan: PlanId;
  try {
    plan = await getPlan(userId);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.plan_read_err");
    throw new UsageError("usage_unavailable", "Couldn't check your usage limit.", {
      cause: error,
    });
  }

  const limit = analysisConfig.planLimits[plan].videosPerMonth;
  const redisKey = monthlyUsageKey(userId, now);
  const ttl = monthlyKeyTtlSeconds(now);

  let used: number;
  try {
    const store = await resolveCounters(deps.counters);
    used = await store.consume(redisKey, limit, ttl);
  } catch (error) {
    if (error instanceof UsageError) {
      throw error;
    }
    logger.warn({ userId, ...errorFields(error) }, "usage.consume_err");
    throw new UsageError(
      "usage_unavailable",
      "Couldn't check your usage limit. Try again in a moment.",
      { cause: error },
    );
  }

  if (used < 0) {
    throw new UsageError(
      "quota_exceeded",
      `You've used all ${limit} videos for this month.`,
    );
  }

  return { used, limit, plan, redisKey };
}

export async function refundMonthlyGenerateSlot(
  userId: string,
  options: UsageQuotaDeps & { redisKey?: string } = {},
): Promise<void> {
  const now = options.now?.() ?? new Date();
  const key = options.redisKey ?? monthlyUsageKey(userId, now);

  try {
    const store = await resolveCounters(options.counters);
    await store.refund(key);
  } catch (error) {
    logger.error(
      { userId, redisKey: key, ...errorFields(error) },
      "usage.refund_err",
    );
    throw new UsageError(
      "usage_unavailable",
      "Couldn't update your usage after a failed analysis.",
      { cause: error },
    );
  }
}

export type UsageSnapshot = {
  plan: PlanId;
  used: number;
  limit: number;
  periodKey: string;
  periodEndsAt: Date;
  maxDurationSeconds: number | null;
};

export async function getUsageSnapshot(
  userId: string,
  deps: UsageQuotaDeps = {},
): Promise<UsageSnapshot> {
  const getPlan = deps.getPlan ?? getPlanForUser;
  const now = deps.now?.() ?? new Date();
  const plan = await getPlan(userId);
  const limits = analysisConfig.planLimits[plan];
  const key = monthlyUsageKey(userId, now);

  let used = 0;
  try {
    const store = await resolveCounters(deps.counters);
    used = await store.get(key);
  } catch (error) {
    logger.warn({ userId, ...errorFields(error) }, "usage.snapshot_err");
    throw new UsageError(
      "usage_unavailable",
      "Couldn't load usage right now.",
      { cause: error },
    );
  }

  return {
    plan,
    used,
    limit: limits.videosPerMonth,
    periodKey: utcMonthPeriodKey(now),
    periodEndsAt: utcPeriodEndsAt(now),
    maxDurationSeconds: limits.maxDurationSeconds,
  };
}
