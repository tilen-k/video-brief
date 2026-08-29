import type IORedis from "ioredis";

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

const RESERVE_LUA = `
local num_keys = #KEYS
for i = 1, num_keys do
  local limit = tonumber(ARGV[(i - 1) * 2 + 1])
  local ttl = tonumber(ARGV[(i - 1) * 2 + 2])
  local current = redis.call("INCR", KEYS[i])
  if current == 1 then
    redis.call("EXPIRE", KEYS[i], ttl)
  end
  if current > limit then
    redis.call("DECR", KEYS[i])
    for j = 1, i - 1 do
      redis.call("DECR", KEYS[j])
    end
    return -i
  end
end
return tonumber(redis.call("GET", KEYS[1]))
`;

export type UsageCounterStore = {
  consume(key: string, limit: number, ttlSeconds: number): Promise<number>;
  reserve(
    keys: string[],
    limits: number[],
    ttlSeconds: number[],
  ): Promise<{ ok: true; userUsed: number } | { ok: false; failedIndex: number }>;
  refund(key: string): Promise<number>;
  get(key: string): Promise<number>;
};

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
    async reserve(keys, limits, ttlSeconds) {
      if (keys.length === 0) {
        return { ok: true, userUsed: 0 };
      }
      const args = keys.flatMap((_, index) => [
        String(limits[index]),
        String(ttlSeconds[index]),
      ]);
      const result = await redis.eval(RESERVE_LUA, keys.length, ...keys, ...args);
      const value = Number(result);
      if (value < 0) {
        return { ok: false, failedIndex: Math.abs(value) };
      }
      return { ok: true, userUsed: value };
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
