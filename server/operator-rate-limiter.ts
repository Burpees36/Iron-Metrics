const WINDOW_MS = 10 * 60 * 1000;
const USER_LIMIT = 10;
const GYM_LIMIT = 20;

interface RateBucket {
  timestamps: number[];
}

const userBuckets = new Map<string, RateBucket>();
const gymBuckets = new Map<string, RateBucket>();

function pruneAndCount(bucket: RateBucket, now: number): number {
  bucket.timestamps = bucket.timestamps.filter(t => now - t < WINDOW_MS);
  return bucket.timestamps.length;
}

function getBucket(map: Map<string, RateBucket>, key: string): RateBucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    map.set(key, bucket);
  }
  return bucket;
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

export function checkRateLimit(userId: string, gymId: string): RateLimitResult {
  const now = Date.now();

  const userBucket = getBucket(userBuckets, userId);
  const userCount = pruneAndCount(userBucket, now);
  if (userCount >= USER_LIMIT) {
    const oldest = userBucket.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldest);
    console.warn(`[RATE-LIMIT] User ${userId} exceeded ${USER_LIMIT} requests in 10min (count: ${userCount})`);
    return {
      allowed: false,
      reason: `User rate limit exceeded. Max ${USER_LIMIT} generations per 10 minutes.`,
      retryAfterMs,
    };
  }

  const gymBucket = getBucket(gymBuckets, gymId);
  const gymCount = pruneAndCount(gymBucket, now);
  if (gymCount >= GYM_LIMIT) {
    const oldest = gymBucket.timestamps[0];
    const retryAfterMs = WINDOW_MS - (now - oldest);
    console.warn(`[RATE-LIMIT] Gym ${gymId} exceeded ${GYM_LIMIT} requests in 10min (count: ${gymCount})`);
    return {
      allowed: false,
      reason: `Gym rate limit exceeded. Max ${GYM_LIMIT} generations per 10 minutes.`,
      retryAfterMs,
    };
  }

  return { allowed: true };
}

export function recordGeneration(userId: string, gymId: string): void {
  const now = Date.now();

  const userBucket = getBucket(userBuckets, userId);
  userBucket.timestamps.push(now);

  const gymBucket = getBucket(gymBuckets, gymId);
  gymBucket.timestamps.push(now);
}
