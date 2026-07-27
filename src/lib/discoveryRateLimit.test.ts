import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    __resetDiscoveryRateLimitForTests,
    consumeDiscoverySearchRateLimit,
    consumeYouTubeDiscoveryQuota,
    deriveDiscoveryClientKey,
} from './discoveryRateLimit';

function requestWithHeaders(values: Record<string, string> = {}) {
    const headers = new Headers(values);
    return { headers };
}

const testLimits = {
    clientMaxRequests: 2,
    globalMaxRequests: 3,
    windowMs: 10_000,
};

afterEach(() => {
    __resetDiscoveryRateLimitForTests();
    vi.restoreAllMocks();
});

describe('discovery search rate limiting', () => {
    it('derives an opaque client key from the highest-confidence proxy IP', () => {
        const request = requestWithHeaders({
            'cf-connecting-ip': '203.0.113.8',
            'x-real-ip': '203.0.113.9',
            'x-forwarded-for': '203.0.113.10, 198.51.100.1',
            'user-agent': 'Creator Browser',
        });

        const key = deriveDiscoveryClientKey(request);

        expect(key).toMatch(/^client:[a-f0-9]{32}$/);
        expect(key).not.toContain('203.0.113.8');
        expect(key).toBe(
            deriveDiscoveryClientKey(
                requestWithHeaders({
                    'cf-connecting-ip': '203.0.113.8',
                    'user-agent': 'Different browser',
                })
            )
        );
    });

    it('uses the first forwarded IP when direct proxy headers are unavailable', () => {
        const forwarded = deriveDiscoveryClientKey(
            requestWithHeaders({
                'x-forwarded-for': '198.51.100.20, 198.51.100.21',
            })
        );
        const direct = deriveDiscoveryClientKey(
            requestWithHeaders({ 'x-real-ip': '198.51.100.20' })
        );

        expect(forwarded).toBe(direct);
        expect(forwarded).not.toContain('198.51.100.20');
    });

    it('bounds and hashes the user-agent fallback', () => {
        const sharedPrefix = 'a'.repeat(512);
        const first = deriveDiscoveryClientKey(
            requestWithHeaders({ 'user-agent': `${sharedPrefix}first-tail` })
        );
        const second = deriveDiscoveryClientKey(
            requestWithHeaders({ 'user-agent': `${sharedPrefix}second-tail` })
        );

        expect(first).toBe(second);
        expect(first).not.toContain(sharedPrefix);
    });

    it('limits one client in memory without blocking a different client', async () => {
        const now = () => 1_000;
        const options = {
            environment: { nodeEnv: 'test' },
            limits: testLimits,
            now,
        };
        const firstClient = requestWithHeaders({ 'x-real-ip': '192.0.2.1' });
        const secondClient = requestWithHeaders({ 'x-real-ip': '192.0.2.2' });

        expect(await consumeDiscoverySearchRateLimit(firstClient, options)).toEqual({
            allowed: true,
        });
        expect(await consumeDiscoverySearchRateLimit(firstClient, options)).toEqual({
            allowed: true,
        });
        expect(await consumeDiscoverySearchRateLimit(firstClient, options)).toEqual({
            allowed: false,
            reason: 'rate_limited',
            retryAfterSeconds: 10,
            scope: 'client',
        });
        expect(await consumeDiscoverySearchRateLimit(secondClient, options)).toEqual({
            allowed: true,
        });
    });

    it('enforces the global memory limit across different clients', async () => {
        const options = {
            environment: { nodeEnv: 'development' },
            limits: { ...testLimits, clientMaxRequests: 5 },
            now: () => 2_000,
        };

        for (let index = 0; index < testLimits.globalMaxRequests; index += 1) {
            expect(
                await consumeDiscoverySearchRateLimit(
                    requestWithHeaders({ 'x-real-ip': `192.0.2.${index + 1}` }),
                    options
                )
            ).toEqual({ allowed: true });
        }

        expect(
            await consumeDiscoverySearchRateLimit(
                requestWithHeaders({ 'x-real-ip': '192.0.2.99' }),
                options
            )
        ).toEqual({
            allowed: false,
            reason: 'rate_limited',
            retryAfterSeconds: 10,
            scope: 'global',
        });
    });

    it('allows requests again after the fixed window expires', async () => {
        let time = 5_000;
        const request = requestWithHeaders({ 'x-real-ip': '192.0.2.30' });
        const options = {
            environment: { nodeEnv: 'test' },
            limits: { ...testLimits, clientMaxRequests: 1 },
            now: () => time,
        };

        expect(await consumeDiscoverySearchRateLimit(request, options)).toEqual({
            allowed: true,
        });
        time = 10_001;
        expect(await consumeDiscoverySearchRateLimit(request, options)).toMatchObject({
            allowed: false,
            retryAfterSeconds: 5,
        });
        time = 15_000;
        expect(await consumeDiscoverySearchRateLimit(request, options)).toEqual({
            allowed: true,
        });
    });

    it('fails closed in production when the shared store is not configured', async () => {
        const result = await consumeDiscoverySearchRateLimit(requestWithHeaders(), {
            environment: { nodeEnv: 'production' },
            limits: testLimits,
            now: () => 1_000,
        });

        expect(result).toEqual({
            allowed: false,
            reason: 'unavailable',
            retryAfterSeconds: 60,
        });
    });

    it('uses the configured Upstash store without exposing client data in keys', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify([{ result: [1, 0, 0] }]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        const request = requestWithHeaders({
            'x-real-ip': '192.0.2.44',
            'user-agent': 'Private Creator Browser',
        });

        const result = await consumeDiscoverySearchRateLimit(request, {
            environment: {
                nodeEnv: 'production',
                redisToken: 'secret-token',
                redisUrl: 'https://example.upstash.io/',
            },
            fetcher,
            limits: testLimits,
            now: () => 1_000,
        });

        expect(result).toEqual({ allowed: true });
        expect(fetcher).toHaveBeenCalledOnce();
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe('https://example.upstash.io/pipeline');
        expect(init?.headers).toMatchObject({
            Authorization: 'Bearer secret-token',
            'Content-Type': 'application/json',
        });
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        const body = String(init?.body);
        expect(body).toContain('"EVAL"');
        expect(body).toContain('"memehub:creator-discovery:v1:global"');
        expect(body).not.toContain('192.0.2.44');
        expect(body).not.toContain('Private Creator Browser');
    });

    it('returns the shared-store retry delay and limiting scope', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify([{ result: [0, 2, 7_501] }]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const result = await consumeDiscoverySearchRateLimit(requestWithHeaders(), {
            environment: {
                nodeEnv: 'production',
                redisToken: 'token',
                redisUrl: 'https://example.upstash.io',
            },
            fetcher,
            limits: testLimits,
        });

        expect(result).toEqual({
            allowed: false,
            reason: 'rate_limited',
            retryAfterSeconds: 8,
            scope: 'client',
        });
    });

    it('fails closed when the configured shared store is unavailable', async () => {
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));

        const result = await consumeDiscoverySearchRateLimit(requestWithHeaders(), {
            environment: {
                nodeEnv: 'development',
                redisToken: 'token',
                redisUrl: 'https://example.upstash.io',
            },
            fetcher,
            limits: testLimits,
        });

        expect(result).toEqual({
            allowed: false,
            reason: 'unavailable',
            retryAfterSeconds: 60,
        });
    });
});

describe('YouTube discovery daily quota', () => {
    it('allows requests within the default UTC-day quota', async () => {
        const options = {
            environment: { nodeEnv: 'test' },
            now: () => Date.UTC(2026, 6, 25, 8),
        };

        for (let index = 0; index < 90; index += 1) {
            expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({ allowed: true });
        }
        expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({
            allowed: false,
            reason: 'quota_exhausted',
            retryAfterSeconds: 57_600,
        });
    });

    it('rejects requests after the configured daily quota is exhausted', async () => {
        const now = Date.UTC(2026, 6, 25, 23, 59, 30);
        const options = {
            environment: {
                nodeEnv: 'development',
                youtubeDailySearchLimit: '2',
            },
            now: () => now,
        };

        expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({ allowed: true });
        expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({ allowed: true });
        expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({
            allowed: false,
            reason: 'quota_exhausted',
            retryAfterSeconds: 30,
        });
    });

    it('starts a fresh quota bucket at the next UTC day', async () => {
        let now = Date.UTC(2026, 6, 25, 23, 59, 59, 500);
        const options = {
            environment: {
                nodeEnv: 'test',
                youtubeDailySearchLimit: '1',
            },
            now: () => now,
        };

        expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({ allowed: true });
        expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({
            allowed: false,
            reason: 'quota_exhausted',
            retryAfterSeconds: 1,
        });

        now = Date.UTC(2026, 6, 26);
        expect(await consumeYouTubeDiscoveryQuota(options)).toEqual({ allowed: true });
    });

    it('uses a bounded integer environment configuration', async () => {
        const now = Date.UTC(2026, 6, 25, 12);

        for (let index = 0; index < 100; index += 1) {
            expect(
                await consumeYouTubeDiscoveryQuota({
                    environment: {
                        nodeEnv: 'test',
                        youtubeDailySearchLimit: '999999',
                    },
                    now: () => now,
                })
            ).toEqual({ allowed: true });
        }

        expect(
            await consumeYouTubeDiscoveryQuota({
                environment: {
                    nodeEnv: 'test',
                    youtubeDailySearchLimit: '999999',
                },
                now: () => now,
            })
        ).toEqual({
            allowed: false,
            reason: 'quota_exhausted',
            retryAfterSeconds: 43_200,
        });
    });

    it('atomically consumes one global UTC-day bucket in the configured Upstash store', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify([{ result: [1, 1] }]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const result = await consumeYouTubeDiscoveryQuota({
            environment: {
                nodeEnv: 'production',
                redisToken: 'secret-token',
                redisUrl: 'https://example.upstash.io/',
                youtubeDailySearchLimit: '12',
            },
            fetcher,
            now: () => Date.UTC(2026, 6, 25, 8),
        });

        expect(result).toEqual({ allowed: true });
        expect(fetcher).toHaveBeenCalledOnce();
        const [url, init] = fetcher.mock.calls[0];
        expect(url).toBe('https://example.upstash.io/pipeline');
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.headers).toMatchObject({
            Authorization: 'Bearer secret-token',
            'Content-Type': 'application/json',
        });
        expect(JSON.parse(String(init?.body))).toEqual([
            [
                'EVAL',
                expect.stringContaining("redis.call('INCR', KEYS[1])"),
                1,
                'memehub:creator-discovery:v1:youtube:2026-07-25',
                12,
                Date.UTC(2026, 6, 26),
            ],
        ]);
    });

    it('returns the UTC reset delay when the shared daily bucket is exhausted', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify([{ result: [0, 90] }]), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const result = await consumeYouTubeDiscoveryQuota({
            environment: {
                nodeEnv: 'production',
                redisToken: 'token',
                redisUrl: 'https://example.upstash.io',
            },
            fetcher,
            now: () => Date.UTC(2026, 6, 25, 20),
        });

        expect(result).toEqual({
            allowed: false,
            reason: 'quota_exhausted',
            retryAfterSeconds: 14_400,
        });
    });

    it('fails closed in production without a shared store', async () => {
        const result = await consumeYouTubeDiscoveryQuota({
            environment: { nodeEnv: 'production' },
            now: () => Date.UTC(2026, 6, 25, 8),
        });

        expect(result).toEqual({
            allowed: false,
            reason: 'unavailable',
            retryAfterSeconds: 60,
        });
    });

    it('fails closed when the configured shared store is unavailable', async () => {
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));

        const result = await consumeYouTubeDiscoveryQuota({
            environment: {
                nodeEnv: 'development',
                redisToken: 'token',
                redisUrl: 'https://example.upstash.io',
            },
            fetcher,
            now: () => Date.UTC(2026, 6, 25, 8),
        });

        expect(result).toEqual({
            allowed: false,
            reason: 'unavailable',
            retryAfterSeconds: 60,
        });
    });
});
