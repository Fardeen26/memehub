import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { IndiaTrendSignal } from '@/types/creatorDiscovery';

const sourcesMock = vi.hoisted(() => ({
    fetchIndiaTrends: vi.fn(),
    filterIndiaTrends: vi.fn(),
    searchWikimediaImages: vi.fn(),
    searchYouTubeVideos: vi.fn(),
}));
const rateLimitMock = vi.hoisted(() => ({
    consumeDiscoverySearchRateLimit: vi.fn(),
    consumeYouTubeDiscoveryQuota: vi.fn(),
}));

vi.mock('@/lib/indiaTrendSources', () => sourcesMock);
vi.mock('@/lib/discoveryRateLimit', () => rateLimitMock);

import { GET } from './route';

const trend: IndiaTrendSignal = {
    id: 'trend-1',
    title: 'जनता पार्टी',
    approximateTraffic: 20_000,
    trafficLabel: '20000+',
    publishedAt: '2026-07-25T13:00:00.000Z',
    imageUrl: 'https://tracking-news.example/trend.jpg',
    sources: [],
};

describe('creator discovery route', () => {
    beforeEach(() => {
        delete process.env.YOUTUBE_API_KEY;
        sourcesMock.fetchIndiaTrends.mockResolvedValue([trend]);
        sourcesMock.filterIndiaTrends.mockImplementation(
            (trends: IndiaTrendSignal[]) => trends
        );
        sourcesMock.searchWikimediaImages.mockResolvedValue([]);
        sourcesMock.searchYouTubeVideos.mockResolvedValue([]);
        rateLimitMock.consumeDiscoverySearchRateLimit.mockResolvedValue({
            allowed: true,
        });
        rateLimitMock.consumeYouTubeDiscoveryQuota.mockResolvedValue({
            allowed: true,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete process.env.YOUTUBE_API_KEY;
    });

    it('loads live India topics without spending image or video search quota', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/creator-discovery')
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            query: '',
            region: 'IN',
            trends: [
                {
                    id: trend.id,
                    title: trend.title,
                    approximateTraffic: trend.approximateTraffic,
                    trafficLabel: trend.trafficLabel,
                    publishedAt: trend.publishedAt,
                    sources: [],
                },
            ],
            reusableImages: [],
            videos: [],
            providers: {
                trends: 'live',
                commons: 'idle',
                youtube: 'not-configured',
            },
        });
        expect(sourcesMock.searchWikimediaImages).not.toHaveBeenCalled();
        expect(sourcesMock.searchYouTubeVideos).not.toHaveBeenCalled();
        expect(payload.trends[0]).not.toHaveProperty('imageUrl');
        expect(
            rateLimitMock.consumeDiscoverySearchRateLimit
        ).not.toHaveBeenCalled();
    });

    it('normalizes a creator query and spends quota only on reusable images', async () => {
        process.env.YOUTUBE_API_KEY = 'test-key';

        const response = await GET(
            new NextRequest(
                'http://localhost/api/creator-discovery?q=%20%20Dharmendra%20%20Pradhan%20'
            )
        );
        const payload = await response.json();

        expect(payload.query).toBe('Dharmendra Pradhan');
        expect(sourcesMock.fetchIndiaTrends).not.toHaveBeenCalled();
        expect(sourcesMock.filterIndiaTrends).not.toHaveBeenCalled();
        expect(sourcesMock.searchWikimediaImages).toHaveBeenCalledWith(
            'Dharmendra Pradhan'
        );
        expect(sourcesMock.searchYouTubeVideos).not.toHaveBeenCalled();
        expect(
            rateLimitMock.consumeDiscoverySearchRateLimit
        ).toHaveBeenCalledOnce();
        expect(
            rateLimitMock.consumeYouTubeDiscoveryQuota
        ).not.toHaveBeenCalled();
        expect(payload.videos).toEqual([]);
        expect(payload.providers.trends).toBe('idle');
        expect(payload.providers.youtube).toBe('not-configured');
        expect(response.headers.get('cache-control')).toContain(
            'public, s-maxage='
        );
    });

    it('retries sparse viral-phrase searches with the actual subject name', async () => {
        const subjectImage = {
            id: 'commons-modi',
            title: 'Narendra Modi speaking',
            previewUrl: 'https://upload.wikimedia.org/modi.jpg',
            assetUrl: 'https://upload.wikimedia.org/modi.jpg',
            sourceUrl:
                'https://commons.wikimedia.org/wiki/File:Narendra_Modi.jpg',
            width: 800,
            height: 600,
            mimeType: 'image/jpeg',
            creator: 'Government photographer',
            licenseName: 'CC BY 4.0',
            licenseUrl:
                'https://creativecommons.org/licenses/by/4.0/',
            provider: 'Wikimedia Commons',
            rights: 'attribution',
        };
        sourcesMock.searchWikimediaImages
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([subjectImage]);

        const response = await GET(
            new NextRequest(
                'http://localhost/api/creator-discovery?q=Narendra%20Modi%20viral%20reel'
            )
        );
        const payload = await response.json();

        expect(sourcesMock.searchWikimediaImages).toHaveBeenNthCalledWith(
            1,
            'Narendra Modi viral reel'
        );
        expect(sourcesMock.searchWikimediaImages).toHaveBeenNthCalledWith(
            2,
            'Narendra Modi'
        );
        expect(payload.query).toBe('Narendra Modi viral reel');
        expect(payload.reusableImages).toEqual([subjectImage]);
    });

    it('rejects punctuation-only searches before calling any provider', async () => {
        const response = await GET(
            new NextRequest(
                'http://localhost/api/creator-discovery?q=%20!!!%20%3F%3F%20'
            )
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: 'Search for a person, event, phrase, or topic.',
        });
        expect(sourcesMock.fetchIndiaTrends).not.toHaveBeenCalled();
        expect(sourcesMock.searchWikimediaImages).not.toHaveBeenCalled();
        expect(sourcesMock.searchYouTubeVideos).not.toHaveBeenCalled();
        expect(
            rateLimitMock.consumeDiscoverySearchRateLimit
        ).not.toHaveBeenCalled();
    });

    it('rejects overlong searches instead of silently changing the creator query', async () => {
        const response = await GET(
            new NextRequest(
                `http://localhost/api/creator-discovery?q=${encodeURIComponent(
                    'a'.repeat(121)
                )}`
            )
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: 'Searches must be 120 characters or fewer.',
        });
        expect(sourcesMock.fetchIndiaTrends).not.toHaveBeenCalled();
        expect(
            rateLimitMock.consumeDiscoverySearchRateLimit
        ).not.toHaveBeenCalled();
    });

    it('returns a retryable 429 before spending provider quota', async () => {
        rateLimitMock.consumeDiscoverySearchRateLimit.mockResolvedValue({
            allowed: false,
            reason: 'rate_limited',
            retryAfterSeconds: 37,
            scope: 'client',
        });

        const response = await GET(
            new NextRequest(
                'http://localhost/api/creator-discovery?q=Narendra%20Modi'
            )
        );

        expect(response.status).toBe(429);
        expect(response.headers.get('retry-after')).toBe('37');
        expect(response.headers.get('cache-control')).toBe('private, no-store');
        expect(await response.json()).toEqual({
            error: 'Too many discovery searches. Try again shortly.',
        });
        expect(sourcesMock.fetchIndiaTrends).not.toHaveBeenCalled();
        expect(sourcesMock.searchWikimediaImages).not.toHaveBeenCalled();
        expect(sourcesMock.searchYouTubeVideos).not.toHaveBeenCalled();
    });

    it('fails closed when production quota protection is unavailable', async () => {
        rateLimitMock.consumeDiscoverySearchRateLimit.mockResolvedValue({
            allowed: false,
            reason: 'unavailable',
            retryAfterSeconds: 60,
        });

        const response = await GET(
            new NextRequest(
                'http://localhost/api/creator-discovery?q=Narendra%20Modi'
            )
        );

        expect(response.status).toBe(503);
        expect(response.headers.get('retry-after')).toBe('60');
        expect(await response.json()).toEqual({
            error: 'Live discovery search is temporarily unavailable.',
        });
        expect(sourcesMock.fetchIndiaTrends).not.toHaveBeenCalled();
    });

    it('does not make an image search wait for the unrelated trend feed', async () => {
        sourcesMock.fetchIndiaTrends.mockRejectedValue(
            new Error('upstream unavailable')
        );
        sourcesMock.searchWikimediaImages.mockResolvedValue([
            {
                id: 'commons-1',
                title: 'Reusable portrait',
                previewUrl: 'https://upload.wikimedia.org/portrait.jpg',
                assetUrl: 'https://upload.wikimedia.org/portrait.jpg',
                sourceUrl: 'https://commons.wikimedia.org/wiki/File:Portrait.jpg',
                width: 800,
                height: 600,
                mimeType: 'image/jpeg',
                creator: 'Photographer',
                licenseName: 'CC BY 4.0',
                licenseUrl:
                    'https://creativecommons.org/licenses/by/4.0/',
                provider: 'Wikimedia Commons',
                rights: 'attribution',
            },
        ]);

        const response = await GET(
            new NextRequest(
                'http://localhost/api/creator-discovery?q=Narendra%20Modi'
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.trends).toEqual([]);
        expect(payload.reusableImages).toHaveLength(1);
        expect(payload.providers).toMatchObject({
            trends: 'idle',
            commons: 'live',
        });
        expect(sourcesMock.fetchIndiaTrends).not.toHaveBeenCalled();
        expect(response.headers.get('cache-control')).toContain(
            'public, s-maxage='
        );
    });
});
