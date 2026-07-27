import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export const DISCOVERY_SEARCH_RATE_LIMITS = {
    clientMaxRequests: 20,
    globalMaxRequests: 120,
    windowMs: 10 * 60 * 1000,
} as const;

export const YOUTUBE_DISCOVERY_DAILY_QUOTA = {
    defaultMaxRequests: 90,
    minMaxRequests: 1,
    maxMaxRequests: 100,
} as const;

const UNAVAILABLE_RETRY_SECONDS = 60;
const CLIENT_IDENTITY_MAX_LENGTH = 512;
const RATE_LIMIT_STORE_TIMEOUT_MS = 4_000;
const RATE_LIMIT_KEY_PREFIX = 'memehub:creator-discovery:v1';
const GLOBAL_RATE_LIMIT_KEY = `${RATE_LIMIT_KEY_PREFIX}:global`;
const YOUTUBE_RATE_LIMIT_KEY_PREFIX = `${RATE_LIMIT_KEY_PREFIX}:youtube`;

type RequestWithHeaders = {
    headers: {
        get(name: string): string | null;
    };
    signal?: AbortSignal;
};

type RateLimitScope = 'client' | 'global';

export type DiscoverySearchRateLimitResult =
    | { allowed: true }
    | {
          allowed: false;
          reason: 'rate_limited';
          retryAfterSeconds: number;
          scope: RateLimitScope;
      }
    | {
          allowed: false;
          reason: 'unavailable';
          retryAfterSeconds: number;
      };

export type DiscoveryRateLimitEnvironment = {
    nodeEnv?: string;
    redisToken?: string;
    redisUrl?: string;
    youtubeDailySearchLimit?: string;
};

type DiscoveryRateLimitLimits = {
    clientMaxRequests: number;
    globalMaxRequests: number;
    windowMs: number;
};

export type DiscoveryRateLimitOptions = {
    environment?: DiscoveryRateLimitEnvironment;
    fetcher?: typeof fetch;
    limits?: DiscoveryRateLimitLimits;
    now?: () => number;
};

export type YouTubeDiscoveryQuotaOptions = {
    environment?: DiscoveryRateLimitEnvironment;
    fetcher?: typeof fetch;
    now?: () => number;
    signal?: AbortSignal;
};

export type YouTubeDiscoveryQuotaResult =
    | { allowed: true }
    | {
          allowed: false;
          reason: 'quota_exhausted';
          retryAfterSeconds: number;
      }
    | {
          allowed: false;
          reason: 'unavailable';
          retryAfterSeconds: number;
      };

type MemoryBucket = {
    count: number;
    resetAt: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();
let youtubeMemoryBucket:
    | {
          count: number;
          dayKey: string;
      }
    | undefined;

const CONSUME_BOTH_BUCKETS_SCRIPT = `
local client_count = tonumber(redis.call('GET', KEYS[1]) or '0')
local global_count = tonumber(redis.call('GET', KEYS[2]) or '0')

if client_count >= tonumber(ARGV[1]) then
    local ttl = redis.call('PTTL', KEYS[1])
    return {0, 2, math.max(ttl, 1000)}
end

if global_count >= tonumber(ARGV[2]) then
    local ttl = redis.call('PTTL', KEYS[2])
    return {0, 3, math.max(ttl, 1000)}
end

client_count = redis.call('INCR', KEYS[1])
if client_count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[3])
end

global_count = redis.call('INCR', KEYS[2])
if global_count == 1 then
    redis.call('PEXPIRE', KEYS[2], ARGV[3])
end

return {1, 0, 0}
`.trim();

const CONSUME_YOUTUBE_DAILY_BUCKET_SCRIPT = `
local current_count = tonumber(redis.call('GET', KEYS[1]) or '0')

if current_count >= tonumber(ARGV[1]) then
    return {0, current_count}
end

current_count = redis.call('INCR', KEYS[1])
if current_count == 1 then
    redis.call('PEXPIREAT', KEYS[1], ARGV[2])
end

return {1, current_count}
`.trim();

function firstForwardedIp(request: RequestWithHeaders): string | undefined {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
}

function normalizeIp(value: string | null | undefined): string | undefined {
    const candidate = value?.trim().slice(0, CLIENT_IDENTITY_MAX_LENGTH);
    return candidate && isIP(candidate) ? candidate.toLowerCase() : undefined;
}

function clientIdentity(request: RequestWithHeaders): string {
    const ip =
        normalizeIp(request.headers.get('cf-connecting-ip')) ||
        normalizeIp(request.headers.get('x-real-ip')) ||
        normalizeIp(firstForwardedIp(request));

    if (ip) {
        return `ip:${ip}`;
    }

    const userAgent =
        request.headers.get('user-agent')?.trim().slice(0, CLIENT_IDENTITY_MAX_LENGTH) ||
        'no-user-agent';
    return `ua:${userAgent}`;
}

export function deriveDiscoveryClientKey(request: RequestWithHeaders): string {
    const digest = createHash('sha256').update(clientIdentity(request)).digest('hex').slice(0, 32);
    return `client:${digest}`;
}

function retryAfterSeconds(resetAt: number, now: number): number {
    return Math.max(1, Math.ceil((resetAt - now) / 1000));
}

function youtubeDailyLimit(value: string | undefined): number {
    const normalized = value?.trim();
    if (!normalized || !/^\d+$/.test(normalized)) {
        return YOUTUBE_DISCOVERY_DAILY_QUOTA.defaultMaxRequests;
    }

    const parsed = Number(normalized);
    if (!Number.isSafeInteger(parsed)) {
        return YOUTUBE_DISCOVERY_DAILY_QUOTA.defaultMaxRequests;
    }

    return Math.min(
        YOUTUBE_DISCOVERY_DAILY_QUOTA.maxMaxRequests,
        Math.max(YOUTUBE_DISCOVERY_DAILY_QUOTA.minMaxRequests, parsed)
    );
}

function utcDay(now: number): {
    dayKey: string;
    resetAt: number;
} {
    const date = new Date(now);
    return {
        dayKey: date.toISOString().slice(0, 10),
        resetAt: Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate() + 1
        ),
    };
}

function activeMemoryBucket(key: string, now: number): MemoryBucket | undefined {
    const bucket = memoryBuckets.get(key);
    if (bucket && bucket.resetAt <= now) {
        memoryBuckets.delete(key);
        return undefined;
    }
    return bucket;
}

function consumeMemoryRateLimit(
    clientKey: string,
    limits: DiscoveryRateLimitLimits,
    now: number
): DiscoverySearchRateLimitResult {
    const clientBucket = activeMemoryBucket(clientKey, now);
    if (clientBucket && clientBucket.count >= limits.clientMaxRequests) {
        return {
            allowed: false,
            reason: 'rate_limited',
            retryAfterSeconds: retryAfterSeconds(clientBucket.resetAt, now),
            scope: 'client',
        };
    }

    const globalBucket = activeMemoryBucket(GLOBAL_RATE_LIMIT_KEY, now);
    if (globalBucket && globalBucket.count >= limits.globalMaxRequests) {
        return {
            allowed: false,
            reason: 'rate_limited',
            retryAfterSeconds: retryAfterSeconds(globalBucket.resetAt, now),
            scope: 'global',
        };
    }

    if (clientBucket) {
        clientBucket.count += 1;
    } else {
        memoryBuckets.set(clientKey, {
            count: 1,
            resetAt: now + limits.windowMs,
        });
    }

    if (globalBucket) {
        globalBucket.count += 1;
    } else {
        memoryBuckets.set(GLOBAL_RATE_LIMIT_KEY, {
            count: 1,
            resetAt: now + limits.windowMs,
        });
    }

    return { allowed: true };
}

function configuredEnvironment(
    override: DiscoveryRateLimitEnvironment | undefined
): Required<Pick<DiscoveryRateLimitEnvironment, 'nodeEnv'>> &
    Pick<
        DiscoveryRateLimitEnvironment,
        'redisToken' | 'redisUrl' | 'youtubeDailySearchLimit'
    > {
    if (override) {
        return {
            nodeEnv: override.nodeEnv || 'development',
            redisToken: override.redisToken?.trim() || undefined,
            redisUrl: override.redisUrl?.trim().replace(/\/+$/, '') || undefined,
            youtubeDailySearchLimit: override.youtubeDailySearchLimit?.trim() || undefined,
        };
    }

    return {
        nodeEnv: process.env.NODE_ENV || 'development',
        redisToken: process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || undefined,
        redisUrl:
            process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/+$/, '') || undefined,
        youtubeDailySearchLimit:
            process.env.YOUTUBE_DAILY_SEARCH_LIMIT?.trim() || undefined,
    };
}

function unavailableResult(): DiscoverySearchRateLimitResult {
    return {
        allowed: false,
        reason: 'unavailable',
        retryAfterSeconds: UNAVAILABLE_RETRY_SECONDS,
    };
}

async function consumeSharedRateLimit(
    clientKey: string,
    limits: DiscoveryRateLimitLimits,
    redisUrl: string,
    redisToken: string,
    fetcher: typeof fetch,
    signal: AbortSignal
): Promise<DiscoverySearchRateLimitResult> {
    const response = await fetcher(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${redisToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([
            [
                'EVAL',
                CONSUME_BOTH_BUCKETS_SCRIPT,
                2,
                `${RATE_LIMIT_KEY_PREFIX}:${clientKey}`,
                GLOBAL_RATE_LIMIT_KEY,
                limits.clientMaxRequests,
                limits.globalMaxRequests,
                limits.windowMs,
            ],
        ]),
        cache: 'no-store',
        signal,
    });
    const payload = (await response.json().catch(() => null)) as
        | Array<{ error?: string; result?: unknown }>
        | null;
    const item = payload?.[0];

    if (!response.ok || !item || item.error || !Array.isArray(item.result)) {
        throw new Error('Discovery rate limit store request failed.');
    }

    const [allowedFlag, scopeCode, retryMs] = item.result.map(Number);
    if (allowedFlag === 1) {
        return { allowed: true };
    }
    if (allowedFlag !== 0 || (scopeCode !== 2 && scopeCode !== 3) || !Number.isFinite(retryMs)) {
        throw new Error('Discovery rate limit store returned an invalid result.');
    }

    return {
        allowed: false,
        reason: 'rate_limited',
        retryAfterSeconds: Math.max(1, Math.ceil(Math.max(0, retryMs) / 1000)),
        scope: scopeCode === 2 ? 'client' : 'global',
    };
}

async function consumeSharedYouTubeQuota(
    dayKey: string,
    now: number,
    resetAt: number,
    limit: number,
    redisUrl: string,
    redisToken: string,
    fetcher: typeof fetch,
    signal: AbortSignal
): Promise<YouTubeDiscoveryQuotaResult> {
    const response = await fetcher(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${redisToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([
            [
                'EVAL',
                CONSUME_YOUTUBE_DAILY_BUCKET_SCRIPT,
                1,
                `${YOUTUBE_RATE_LIMIT_KEY_PREFIX}:${dayKey}`,
                limit,
                resetAt,
            ],
        ]),
        cache: 'no-store',
        signal,
    });
    const payload = (await response.json().catch(() => null)) as
        | Array<{ error?: string; result?: unknown }>
        | null;
    const item = payload?.[0];

    if (!response.ok || !item || item.error || !Array.isArray(item.result)) {
        throw new Error('YouTube discovery quota store request failed.');
    }

    const [allowedFlag, currentCount] = item.result.map(Number);
    if (
        (allowedFlag !== 0 && allowedFlag !== 1) ||
        !Number.isFinite(currentCount) ||
        currentCount < 0
    ) {
        throw new Error('YouTube discovery quota store returned an invalid result.');
    }

    if (allowedFlag === 1) {
        return { allowed: true };
    }

    return {
        allowed: false,
        reason: 'quota_exhausted',
        retryAfterSeconds: retryAfterSeconds(resetAt, now),
    };
}

export async function consumeDiscoverySearchRateLimit(
    request: RequestWithHeaders,
    options: DiscoveryRateLimitOptions = {}
): Promise<DiscoverySearchRateLimitResult> {
    const environment = configuredEnvironment(options.environment);
    const limits = options.limits || DISCOVERY_SEARCH_RATE_LIMITS;
    const clientKey = deriveDiscoveryClientKey(request);
    const hasSharedStore = Boolean(environment.redisUrl && environment.redisToken);

    if (hasSharedStore) {
        try {
            const timeoutSignal = AbortSignal.timeout(
                RATE_LIMIT_STORE_TIMEOUT_MS
            );
            const signal = request.signal
                ? AbortSignal.any([request.signal, timeoutSignal])
                : timeoutSignal;
            return await consumeSharedRateLimit(
                clientKey,
                limits,
                environment.redisUrl as string,
                environment.redisToken as string,
                options.fetcher || fetch,
                signal
            );
        } catch {
            return unavailableResult();
        }
    }

    if (environment.nodeEnv === 'production') {
        return unavailableResult();
    }

    return consumeMemoryRateLimit(clientKey, limits, (options.now || Date.now)());
}

export async function consumeYouTubeDiscoveryQuota(
    options: YouTubeDiscoveryQuotaOptions = {}
): Promise<YouTubeDiscoveryQuotaResult> {
    const environment = configuredEnvironment(options.environment);
    const now = (options.now || Date.now)();
    const { dayKey, resetAt } = utcDay(now);
    const limit = youtubeDailyLimit(environment.youtubeDailySearchLimit);
    const hasSharedStore = Boolean(environment.redisUrl && environment.redisToken);

    if (hasSharedStore) {
        try {
            const timeoutSignal = AbortSignal.timeout(RATE_LIMIT_STORE_TIMEOUT_MS);
            const signal = options.signal
                ? AbortSignal.any([options.signal, timeoutSignal])
                : timeoutSignal;
            const response = await consumeSharedYouTubeQuota(
                dayKey,
                now,
                resetAt,
                limit,
                environment.redisUrl as string,
                environment.redisToken as string,
                options.fetcher || fetch,
                signal
            );
            return response;
        } catch {
            return {
                allowed: false,
                reason: 'unavailable',
                retryAfterSeconds: UNAVAILABLE_RETRY_SECONDS,
            };
        }
    }

    if (environment.nodeEnv === 'production') {
        return {
            allowed: false,
            reason: 'unavailable',
            retryAfterSeconds: UNAVAILABLE_RETRY_SECONDS,
        };
    }

    if (!youtubeMemoryBucket || youtubeMemoryBucket.dayKey !== dayKey) {
        youtubeMemoryBucket = {
            count: 0,
            dayKey,
        };
    }
    if (youtubeMemoryBucket.count >= limit) {
        return {
            allowed: false,
            reason: 'quota_exhausted',
            retryAfterSeconds: retryAfterSeconds(resetAt, now),
        };
    }

    youtubeMemoryBucket.count += 1;
    return { allowed: true };
}

export function __resetDiscoveryRateLimitForTests(): void {
    memoryBuckets.clear();
    youtubeMemoryBucket = undefined;
}
