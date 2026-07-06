// Replaces ioredis with a no-op stub so queue tests run without a Redis server.
// queueService already handles Redis failures gracefully (try/catch with console.warn).
// This stub silences those warnings and avoids connection timeouts in CI.

const stub = {
  hgetall: async () => null,
  hmset:   async () => 'OK',
  hset:    async () => 1,
  hget:    async () => null,
  expire:  async () => 1,
  publish: async () => 0,
};

export default stub;
