import type IORedis from "ioredis";

import { ANALYSIS_LOCK_TTL_MS } from "./types";

const RELEASE_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

const HEARTBEAT_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
end
return 0
`;

export function analysisLockKey(userVideoId: string): string {
  return `analysis:lock:${userVideoId}`;
}

export type AnalysisLockStore = {
  tryAcquire(userVideoId: string, runId: string): Promise<boolean>;
  heartbeat(userVideoId: string, runId: string): Promise<boolean>;
  release(userVideoId: string, runId: string): Promise<void>;
};

export function createAnalysisLocks(redis: IORedis): AnalysisLockStore {
  return {
    async tryAcquire(userVideoId, runId) {
      const result = await redis.set(
        analysisLockKey(userVideoId),
        runId,
        "PX",
        ANALYSIS_LOCK_TTL_MS,
        "NX",
      );
      return result === "OK";
    },
    async heartbeat(userVideoId, runId) {
      const result = await redis.eval(
        HEARTBEAT_LUA,
        1,
        analysisLockKey(userVideoId),
        runId,
        String(ANALYSIS_LOCK_TTL_MS),
      );
      return result === 1 || result === "1";
    },
    async release(userVideoId, runId) {
      await redis.eval(RELEASE_LUA, 1, analysisLockKey(userVideoId), runId);
    },
  };
}
