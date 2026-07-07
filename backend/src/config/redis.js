import IORedis from 'ioredis';
import { env } from './env.js';

const isTest = env.nodeEnv === 'test';

const redis = new IORedis(env.redis.url, {
  lazyConnect:          true,
  maxRetriesPerRequest: isTest ? 0 : 300,
  // Disable reconnect loop in test environment so ECONNREFUSED doesn't flood output.
  retryStrategy:        isTest ? () => null : undefined,
});

let loggedRedisError = false;
redis.on('error', (err) => {
  if (!isTest && !loggedRedisError) {
    loggedRedisError = true;
    console.error('[redis]', err.message);
    console.error('[redis] Redis is not available — queue features will be degraded');
  }
});

export default redis;
