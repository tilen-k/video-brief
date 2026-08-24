import IORedis from "ioredis";

function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}

/**
 * Shared Redis helpers for usage counters and the BullMQ analysis queue.
 * Worker connections must set maxRetriesPerRequest: null.
 */
export function createRedisConnection(kind: "queue" | "worker"): IORedis {
  return new IORedis(redisUrl(), {
    maxRetriesPerRequest: kind === "worker" ? null : 20,
    enableReadyCheck: true,
  });
}

let sharedProducer: IORedis | null = null;
let readyPromise: Promise<IORedis> | null = null;

/** Producer-style singleton (usage counters, queue producers). */
export function getRedis(): IORedis {
  if (!sharedProducer) {
    sharedProducer = new IORedis(redisUrl(), {
      maxRetriesPerRequest: 20,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return sharedProducer;
}

async function ensureConnected(redis: IORedis): Promise<void> {
  if (redis.status === "ready") {
    return;
  }
  if (redis.status === "wait") {
    await redis.connect();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    if (redis.status === "ready") {
      resolve();
      return;
    }
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      redis.off("ready", onReady);
      redis.off("error", onError);
    };
    redis.once("ready", onReady);
    redis.once("error", onError);
  });
}

export async function assertRedisReady(): Promise<IORedis> {
  if (!readyPromise) {
    readyPromise = (async () => {
      const redis = getRedis();
      await ensureConnected(redis);
      const pong = await redis.ping();
      if (pong !== "PONG") {
        throw new Error("Redis ping failed");
      }
      return redis;
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

export async function pingRedis(): Promise<void> {
  await assertRedisReady();
}

/** Test helper — reset the producer singleton between Vitest cases. */
export function resetRedisForTests(): void {
  if (sharedProducer) {
    sharedProducer.disconnect();
    sharedProducer = null;
  }
  readyPromise = null;
}
