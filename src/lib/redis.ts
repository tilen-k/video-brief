import IORedis from "ioredis";

function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}

let shared: IORedis | null = null;
let readyPromise: Promise<IORedis> | null = null;

/**
 * Shared Redis client for usage counters (and later the analysis queue).
 * Producer-style options: maxRetriesPerRequest is finite.
 */
export function getRedis(): IORedis {
  if (!shared) {
    shared = new IORedis(redisUrl(), {
      maxRetriesPerRequest: 20,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }
  return shared;
}

async function ensureConnected(redis: IORedis): Promise<void> {
  if (redis.status === "ready") {
    return;
  }
  if (redis.status === "wait") {
    await redis.connect();
    return;
  }
  // connecting / reconnecting / connect — wait for ready once
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

/** Test helper — reset the singleton between Vitest cases. */
export function resetRedisForTests(): void {
  if (shared) {
    shared.disconnect();
    shared = null;
  }
  readyPromise = null;
}
