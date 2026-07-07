import IORedis from 'ioredis';
import { env } from './env.js';

const isTest = env.nodeEnv === 'test';

const redis = new IORedis(env.redis.url, {
  lazyConnect:          true,
  // Every call site in this codebase already wraps Redis in try/catch and
  // falls back to a Mongo read/write on failure — but that fallback is only
  // fast if the Redis call itself fails fast. The ioredis default retries a
  // queued command up to maxRetriesPerRequest times against a reconnecting
  // client, which at 300 retries can take minutes to finally reject while
  // Redis is unreachable, making every queue/session read hang instead of
  // gracefully degrading. Cap it at 1 so a down Redis fails in milliseconds.
  maxRetriesPerRequest: isTest ? 0 : 1,
  // Disable reconnect loop in test environment so ECONNREFUSED doesn't flood output.
  // In other environments, keep reconnecting in the background so Redis is used
  // again automatically once it comes back up — but at a flat, small delay
  // rather than a growing backoff. ioredis's reconnect-attempt counter climbs
  // continuously in the background regardless of whether anyone is issuing
  // commands, and maxRetriesPerRequest:1 makes each foreground command wait
  // out exactly one such attempt before failing over — so a growing backoff
  // (e.g. capped at 2000ms) makes every Redis-touching request progressively
  // slower the longer Redis stays down, up to +2s each. A flat delay keeps
  // that worst case small and constant instead.
  retryStrategy:        isTest ? () => null : () => 200,
});

redis.on('error', (err) => {
  if (!isTest) console.error('[redis]', err.message);
});

export default redis;
