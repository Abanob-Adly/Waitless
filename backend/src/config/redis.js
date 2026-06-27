import IORedis from 'ioredis';
import { env } from './env.js';

const redis = new IORedis(env.redis.url, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
});

redis.on('error', (err) => console.error('[redis]', err.message));

export default redis;
