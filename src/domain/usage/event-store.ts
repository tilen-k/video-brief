import { and, count, eq, isNull, sql, type SQL } from "drizzle-orm";

import { createDb, type Db } from "@/db";
import { usageEvents, type ModelTier } from "@/db/schema";
import { utcDayPeriodKey, utcHourPeriodKey } from "@/domain/usage/keys";

export type ReserveLimits = {
  user: number;
  globalHourly: number;
  globalDaily: number;
  ip: number | null;
};

export type UsageEventStore = {
  reserve(input: {
    userId: string;
    runId: string;
    tier: ModelTier;
    ipHash: string | null;
    now: Date;
    limits: ReserveLimits;
  }): Promise<
    | { ok: true; userUsed: number }
    | { ok: false; failedScope: "user" | "global" | "ip" }
  >;
  refund(userId: string, runId: string): Promise<void>;
  countUserDaily(userId: string, tier: ModelTier, now: Date): Promise<number>;
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function countMatching(tx: Tx, where: SQL | undefined): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(usageEvents)
    .where(where);
  return Number(row?.n ?? 0);
}

async function lockUsage(tx: Tx, key: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
}

export function createPostgresUsageEventStore(
  db: Db = createDb(),
): UsageEventStore {
  return {
    async reserve(input) {
      const periodDay = utcDayPeriodKey(input.now);
      const periodHour = utcHourPeriodKey(input.now);

      return db.transaction(async (tx) => {
        await lockUsage(tx, `usage:u:${input.userId}:${periodDay}:${input.tier}`);
        await lockUsage(tx, `usage:gh:${periodHour}:${input.tier}`);
        await lockUsage(tx, `usage:gd:${periodDay}:${input.tier}`);
        if (input.ipHash) {
          await lockUsage(
            tx,
            `usage:ip:${input.ipHash}:${periodDay}:${input.tier}`,
          );
        }

        const userUsed = await countMatching(
          tx,
          and(
            eq(usageEvents.userId, input.userId),
            eq(usageEvents.periodDay, periodDay),
            eq(usageEvents.tier, input.tier),
            isNull(usageEvents.refundedAt),
          ),
        );
        if (userUsed >= input.limits.user) {
          return { ok: false, failedScope: "user" as const };
        }

        const globalHourlyUsed = await countMatching(
          tx,
          and(
            eq(usageEvents.periodHour, periodHour),
            eq(usageEvents.tier, input.tier),
            isNull(usageEvents.refundedAt),
          ),
        );
        if (globalHourlyUsed >= input.limits.globalHourly) {
          return { ok: false, failedScope: "global" as const };
        }

        const globalDailyUsed = await countMatching(
          tx,
          and(
            eq(usageEvents.periodDay, periodDay),
            eq(usageEvents.tier, input.tier),
            isNull(usageEvents.refundedAt),
          ),
        );
        if (globalDailyUsed >= input.limits.globalDaily) {
          return { ok: false, failedScope: "global" as const };
        }

        if (input.ipHash && input.limits.ip != null) {
          const ipUsed = await countMatching(
            tx,
            and(
              eq(usageEvents.ipHash, input.ipHash),
              eq(usageEvents.periodDay, periodDay),
              eq(usageEvents.tier, input.tier),
              isNull(usageEvents.refundedAt),
            ),
          );
          if (ipUsed >= input.limits.ip) {
            return { ok: false, failedScope: "ip" as const };
          }
        }

        await tx.insert(usageEvents).values({
          userId: input.userId,
          runId: input.runId,
          tier: input.tier,
          periodDay,
          periodHour,
          ipHash: input.ipHash,
        });

        return { ok: true, userUsed: userUsed + 1 };
      });
    },

    async refund(userId, runId) {
      await db
        .update(usageEvents)
        .set({ refundedAt: new Date() })
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.runId, runId),
            isNull(usageEvents.refundedAt),
          ),
        );
    },

    async countUserDaily(userId, tier, now) {
      const periodDay = utcDayPeriodKey(now);
      const [row] = await db
        .select({ n: count() })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, userId),
            eq(usageEvents.periodDay, periodDay),
            eq(usageEvents.tier, tier),
            isNull(usageEvents.refundedAt),
          ),
        );
      return Number(row?.n ?? 0);
    },
  };
}
