import IORedis from "ioredis";

function redisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set");
  }
  return url;
}

/** Redis connections for BullMQ and the per-video analysis lock. */
export function createRedisConnection(kind: "queue" | "worker"): IORedis {
  return new IORedis(redisUrl(), {
    maxRetriesPerRequest: kind === "worker" ? null : 20,
    enableReadyCheck: true,
  });
}

export async function pingRedis(): Promise<void> {
  const redis = createRedisConnection("queue");
  try {
    const pong = await redis.ping();
    if (pong !== "PONG") {
      throw new Error("Redis ping failed");
    }
  } finally {
    redis.disconnect();
  }
}
