import IORedis from 'ioredis';
import { env } from './env.js';

const isTest = env.nodeEnv === 'test';

const redis = new IORedis(env.redis.url, {
  lazyConnect:          true,
  maxRetriesPerRequest: isTest ? 0 : 3,
  // Disable reconnect loop in test environment so ECONNREFUSED doesn't flood output.
  retryStrategy:        isTest ? () => null : undefined,
});

redis.on('error', (err) => {
  if (!isTest) console.error('[redis]', err.message);
});

export default redis;
