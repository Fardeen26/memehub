import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { ReusableImageAsset } from '@/types/creatorDiscovery';

const sourcesMock = vi.hoisted(() => ({
    fetchIndiaTrends: vi.fn(),
    searchWikimediaImages: vi.fn(),
}));
const searxngMock = vi.hoisted(() => ({
    searchSearxngImages: vi.fn(),
}));
const suggestionMock = vi.hoisted(() => ({
    findWikipediaSearchSuggestion: vi.fn(),
}));
const rateLimitMock = vi.hoisted(() => ({
    consumeDiscoverySearchRateLimit: vi.fn(),
}));

vi.mock('@/lib/indiaTrendSources', () => sourcesMock);
vi.mock('@/lib/searxngImageSearch', () => searxngMock);
vi.mock('@/lib/searchSuggestions', () => suggestionMock);
vi.mock('@/lib/discoveryRateLimit', () => rateLimitMock);

import { GET } from './route';

const reusableImage: ReusableImageAsset = {
    id: 'commons-cjp',
    title: 'CJP protestors at Jantar Mantar',
    previewUrl: 'https://upload.wikimedia.org/cjp-1200.jpg',
    assetUrl: 'https://upload.wikimedia.org/cjp-1200.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:CJP_protest.jpg',
    width: 1_200,
    height: 800,
    mimeType: 'image/jpeg',
    creator: 'Example photographer',
    licenseName: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    provider: 'Wikimedia Commons',
    rights: 'share-alike',
};

const braveCandidate = {
    id: 'brave-news-cjp',
    title: 'Police use lathis during CJP protest',
    previewUrl:
        'https://imgs.search.brave.com/example/rs:fit:500:0/g:ce/photo',
    sourceUrl: 'https://example-news.test/cjp-protest',
    sourceDomain: 'example-news.test',
    width: 500,
    height: 333,
    publishedAt: '2026-07-25T10:00:00.000Z',
    kind: 'news' as const,
    confidence: 'high' as const,
};

function request(path: string) {
    return new NextRequest(`http://localhost${path}`);
}

describe('creator discovery route', () => {
    beforeEach(() => {
        process.env.SEARXNG_URL = 'http://localhost:8088';
        sourcesMock.fetchIndiaTrends.mockReset().mockResolvedValue([]);
        sourcesMock.searchWikimediaImages.mockReset().mockResolvedValue([]);
        searxngMock.searchSearxngImages.mockReset().mockResolvedValue({
            candidates: [],
            degradedEndpoints: [],
        });
        suggestionMock.findWikipediaSearchSuggestion
            .mockReset()
            .mockResolvedValue(undefined);
        rateLimitMock.consumeDiscoverySearchRateLimit
            .mockReset()
            .mockResolvedValue({
                allowed: true,
            });
    });

    afterEach(() => {
        vi.clearAllMocks();
        delete process.env.SEARXNG_URL;
    });

    it('opens the creator-first material picker without loading generic trends', async () => {
        const response = await GET(request('/api/creator-discovery'));
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            query: '',
            resolvedQuery: '',
            intent: 'moment',
            webImages: [],
            reusableImages: [],
            providers: {
                web: 'idle',
                commons: 'idle',
            },
        });
        expect(payload.trends).toEqual([]);
        expect(sourcesMock.fetchIndiaTrends).not.toHaveBeenCalled();
        expect(sourcesMock.searchWikimediaImages).not.toHaveBeenCalled();
        expect(
            rateLimitMock.consumeDiscoverySearchRateLimit
        ).not.toHaveBeenCalled();
    });

    it('recovers a misspelled public figure and returns fresh web imagery with source context', async () => {
        suggestionMock.findWikipediaSearchSuggestion.mockResolvedValue(
            'Dharmendra Pradhan'
        );
        searxngMock.searchSearxngImages
            .mockResolvedValueOnce({
                candidates: [],
                degradedEndpoints: [],
            })
            .mockResolvedValueOnce({
                candidates: [braveCandidate],
                degradedEndpoints: [],
            });
        sourcesMock.searchWikimediaImages
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([reusableImage]);

        const response = await GET(
            request(
                '/api/creator-discovery?q=darmendra%20pardhan&intent=moment'
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.query).toBe('darmendra pardhan');
        expect(payload.resolvedQuery).toBe('Dharmendra Pradhan');
        expect(payload.intent).toBe('moment');
        expect(searxngMock.searchSearxngImages).toHaveBeenNthCalledWith(
            1,
            'darmendra pardhan',
            expect.objectContaining({ baseUrl: 'http://localhost:8088' })
        );
        expect(searxngMock.searchSearxngImages).toHaveBeenNthCalledWith(
            2,
            'Dharmendra Pradhan',
            expect.objectContaining({ baseUrl: 'http://localhost:8088' })
        );
        expect(
            sourcesMock.searchWikimediaImages.mock.calls.map(
                ([candidate]) => candidate
            )
        ).toEqual(['darmendra pardhan', 'Dharmendra Pradhan']);
        expect(payload.webImages).toEqual([
            expect.objectContaining({
                id: braveCandidate.id,
                title: braveCandidate.title,
                provider: 'SearXNG',
                rights: 'unknown',
                sourceDomain: 'example-news.test',
                kind: 'news',
            }),
        ]);
        expect(payload.reusableImages).toEqual([reusableImage]);
        expect(payload.providers).toMatchObject({
            web: 'live',
            commons: 'live',
        });
    });

    it('prefers a configured self-hosted SearXNG instance for current-event image discovery', async () => {
        process.env.SEARXNG_URL = 'http://localhost:8088';
        searxngMock.searchSearxngImages.mockResolvedValue({
            candidates: [braveCandidate],
            degradedEndpoints: [],
        });

        const response = await GET(
            request('/api/creator-discovery?q=Trump%20speech%20stumble')
        );
        const payload = await response.json();

        expect(searxngMock.searchSearxngImages).toHaveBeenCalledWith(
            'Trump speech stumble',
            expect.objectContaining({
                baseUrl: 'http://localhost:8088',
                timeRange: 'day',
            })
        );
        expect(payload.webImages).toEqual([
            expect.objectContaining({
                id: braveCandidate.id,
                provider: 'SearXNG',
                rights: 'unknown',
            }),
        ]);
        expect(payload.providers.web).toBe('live');
    });

    it('does not fall back to Brave when SearXNG is not configured', async () => {
        delete process.env.SEARXNG_URL;
        const response = await GET(
            request('/api/creator-discovery?q=CJP%20protest')
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.webImages).toEqual([]);
        expect(payload.providers.web).toBe('not-configured');
    });

    it('progressively relaxes a current-event phrase when live web search is not configured', async () => {
        delete process.env.SEARXNG_URL;
        sourcesMock.searchWikimediaImages
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([reusableImage]);

        const response = await GET(
            request(
                '/api/creator-discovery?q=cjp%20protest%20lathi%20charge'
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(
            sourcesMock.searchWikimediaImages.mock.calls.map(
                ([query]) => query
            )
        ).toEqual([
            'cjp protest lathi charge',
            'cjp protest lathi',
            'cjp protest',
        ]);
        expect(payload.reusableImages).toEqual([reusableImage]);
        expect(payload.providers.web).toBe('not-configured');
    });

    it('puts title-matched reusable material ahead of generic coverage frames', async () => {
        delete process.env.SEARXNG_URL;
        sourcesMock.searchWikimediaImages.mockResolvedValue([
            {
                ...reusableImage,
                id: 'commons-generic',
                title: 'Person taken to hospital',
            },
            reusableImage,
        ]);

        const response = await GET(
            request('/api/creator-discovery?q=CJP%20protest')
        );
        const payload = await response.json();

        expect(payload.reusableImages.map(
            ({ id }: { id: string }) => id
        )).toEqual(['commons-cjp', 'commons-generic']);
    });

    it('turns a reaction intent into a meme-specific provider query', async () => {
        await GET(
            request(
                '/api/creator-discovery?q=Dharmendra%20Pradhan&intent=reaction'
            )
        );

        expect(searxngMock.searchSearxngImages).toHaveBeenCalledWith(
            expect.stringMatching(/Dharmendra Pradhan.*reaction/i),
            expect.objectContaining({ baseUrl: 'http://localhost:8088' })
        );
    });

    it('searches Reddit, X, and Instagram together for social material', async () => {
        await GET(
            request(
                '/api/creator-discovery?q=budget%20speech%20reactions&intent=social'
            )
        );

        const primaryQuery =
            searxngMock.searchSearxngImages.mock.calls[0]?.[0] ?? '';
        expect(primaryQuery).toContain('site:reddit.com');
        expect(primaryQuery).toContain('site:x.com');
        expect(primaryQuery).toContain('site:instagram.com');
    });

    it('does not turn an intent-decorated Brave rewrite into the base entity correction', async () => {
        searxngMock.searchSearxngImages.mockResolvedValue({
            candidates: [braveCandidate],
            alteredQuery: 'Dharmendra Pradhan reaction image',
        });
        sourcesMock.searchWikimediaImages.mockResolvedValue([reusableImage]);

        const response = await GET(
            request(
                '/api/creator-discovery?q=darmendra%20pardhan&intent=reaction'
            )
        );
        const payload = await response.json();

        expect(payload.resolvedQuery).toBe('darmendra pardhan');
        expect(sourcesMock.searchWikimediaImages).toHaveBeenCalledWith(
            'darmendra pardhan'
        );
        expect(sourcesMock.searchWikimediaImages).not.toHaveBeenCalledWith(
            'Dharmendra Pradhan reaction image'
        );
    });

    it('uses one bounded follow-up query when the primary web result is sparse', async () => {
        searxngMock.searchSearxngImages
            .mockResolvedValueOnce({
                candidates: [braveCandidate],
            })
            .mockResolvedValueOnce({
                candidates: [
                    {
                        ...braveCandidate,
                        id: 'brave-web-cjp-2',
                        title: 'Second current-event frame',
                        previewUrl:
                            'https://imgs.search.brave.com/second/current.jpg',
                        sourceUrl:
                            'https://second-news.example/cjp-protest',
                        sourceDomain: 'second-news.example',
                    },
                ],
            });

        const response = await GET(
            request('/api/creator-discovery?q=CJP%20protest')
        );
        const payload = await response.json();

        expect(searxngMock.searchSearxngImages).toHaveBeenCalledTimes(2);
        expect(searxngMock.searchSearxngImages.mock.calls[0]?.[0]).toBe(
            'CJP protest'
        );
        expect(searxngMock.searchSearxngImages.mock.calls[1]?.[0]).toMatch(
            /CJP protest.*current event/i
        );
        expect(payload.webImages.map(({ id }: { id: string }) => id)).toEqual([
            'brave-news-cjp',
            'brave-web-cjp-2',
        ]);
    });

    it('starts reusable fallback without waiting for the live web lane to settle', async () => {
        let releaseWebSearch!: (value: {
            candidates: typeof braveCandidate[];
            degradedEndpoints: never[];
        }) => void;
        const pendingWebSearch = new Promise<{
            candidates: typeof braveCandidate[];
            degradedEndpoints: never[];
        }>((resolve) => {
            releaseWebSearch = resolve;
        });
        searxngMock.searchSearxngImages.mockReturnValueOnce(
            pendingWebSearch
        );

        const responsePromise = GET(
            request('/api/creator-discovery?q=current%20event')
        );
        await vi.waitFor(() =>
            expect(searxngMock.searchSearxngImages).toHaveBeenCalledOnce()
        );
        const reusableStartedBeforeWebSettled =
            sourcesMock.searchWikimediaImages.mock.calls.length > 0;

        releaseWebSearch({
            candidates: Array.from({ length: 8 }, (_, index) => ({
                ...braveCandidate,
                id: `brave-concurrent-${index}`,
                previewUrl: `https://imgs.search.brave.com/concurrent-${index}/image.jpg`,
                sourceUrl: `https://concurrent-${index}.example/story`,
                sourceDomain: `concurrent-${index}.example`,
            })),
            degradedEndpoints: [],
        });
        await responsePromise;

        expect(reusableStartedBeforeWebSettled).toBe(true);
    });

    it('does not count Hindi matras as separate words at the input boundary', async () => {
        const hindiQuery = Array.from(
            { length: 18 },
            () => 'पुलिस'
        ).join(' ');

        const response = await GET(
            request(
                `/api/creator-discovery?q=${encodeURIComponent(hindiQuery)}`
            )
        );

        expect(response.status).toBe(200);
        expect(searxngMock.searchSearxngImages).toHaveBeenCalledWith(
            hindiQuery,
            expect.objectContaining({ baseUrl: 'http://localhost:8088' })
        );
    });

    it('caps a full primary provider response to the public result limit', async () => {
        searxngMock.searchSearxngImages.mockResolvedValue({
            candidates: Array.from({ length: 30 }, (_, index) => ({
                ...braveCandidate,
                id: `brave-result-${index}`,
                previewUrl: `https://imgs.search.brave.com/result-${index}/image.jpg`,
                sourceUrl: `https://news-${index}.example/story`,
                sourceDomain: `news-${index}.example`,
            })),
            degradedEndpoints: [],
        });

        const response = await GET(
            request('/api/creator-discovery?q=current%20event')
        );
        const payload = await response.json();

        expect(searxngMock.searchSearxngImages).toHaveBeenCalledOnce();
        expect(payload.webImages).toHaveLength(24);
    });

    it('keeps original event candidates ahead of a dubious short-query suggestion', async () => {
        suggestionMock.findWikipediaSearchSuggestion.mockResolvedValue(
            'cjp project lathe'
        );
        sourcesMock.searchWikimediaImages
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([reusableImage]);

        const response = await GET(
            request('/api/creator-discovery?q=cjp%20protest%20lathi')
        );
        const payload = await response.json();

        expect(
            sourcesMock.searchWikimediaImages.mock.calls.map(
                ([candidate]) => candidate
            )
        ).toEqual(['cjp protest lathi', 'cjp protest']);
        expect(payload.resolvedQuery).toBe('cjp protest lathi');
        expect(payload.reusableImages).toEqual([reusableImage]);
    });

    it('does not replace a working web query with a dubious sparse-result suggestion', async () => {
        suggestionMock.findWikipediaSearchSuggestion.mockResolvedValue(
            'cjp project lathe'
        );
        searxngMock.searchSearxngImages
            .mockResolvedValueOnce({
                candidates: [braveCandidate],
                degradedEndpoints: [],
            })
            .mockResolvedValueOnce({
                candidates: [
                    {
                        ...braveCandidate,
                        id: 'brave-original-followup',
                        previewUrl:
                            'https://imgs.search.brave.com/original/followup.jpg',
                        sourceUrl:
                            'https://example-news.test/cjp-followup',
                    },
                ],
                degradedEndpoints: [],
            });

        const response = await GET(
            request('/api/creator-discovery?q=cjp%20protest%20lathi')
        );
        const payload = await response.json();

        expect(searxngMock.searchSearxngImages).toHaveBeenCalledTimes(2);
        expect(searxngMock.searchSearxngImages.mock.calls[1]?.[0]).toBe(
            'cjp protest lathi current event'
        );
        expect(payload.resolvedQuery).toBe('cjp protest lathi');
    });

    it('shares the four-request Commons budget across original and corrected queries', async () => {
        suggestionMock.findWikipediaSearchSuggestion.mockResolvedValue(
            'alpha beta gamma delta epsilon zeta eta'
        );

        await GET(
            request(
                '/api/creator-discovery?q=one%20two%20three%20four%20five%20six%20seven'
            )
        );

        expect(
            sourcesMock.searchWikimediaImages
        ).toHaveBeenCalledTimes(4);
    });

    it('marks a partially available SearXNG search as degraded without hiding its results', async () => {
        searxngMock.searchSearxngImages.mockResolvedValue({
            candidates: [braveCandidate],
            degradedEndpoints: ['news'],
        });

        const response = await GET(
            request('/api/creator-discovery?q=CJP%20protest')
        );
        const payload = await response.json();

        expect(payload.webImages).toHaveLength(1);
        expect(payload.providers.web).toBe('degraded');
        expect(searxngMock.searchSearxngImages).toHaveBeenCalledOnce();
        expect(response.headers.get('cache-control')).toBe(
            'private, no-store'
        );
    });

    it('keeps licensed fallback results when live web search fails', async () => {
        searxngMock.searchSearxngImages.mockRejectedValue(
            new Error('SearXNG unavailable')
        );
        sourcesMock.searchWikimediaImages.mockResolvedValue([reusableImage]);

        const response = await GET(
            request('/api/creator-discovery?q=CJP%20protest')
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.webImages).toEqual([]);
        expect(payload.reusableImages).toEqual([reusableImage]);
        expect(payload.providers).toMatchObject({
            web: 'unavailable',
            commons: 'live',
        });
        expect(searxngMock.searchSearxngImages).toHaveBeenCalledOnce();
        expect(response.headers.get('cache-control')).toBe(
            'private, no-store'
        );
    });

    it('rejects unsupported intents before spending provider quota', async () => {
        const response = await GET(
            request(
                '/api/creator-discovery?q=CJP%20protest&intent=political-persuasion'
            )
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            error: 'Choose a supported meme material type.',
        });
        expect(
            rateLimitMock.consumeDiscoverySearchRateLimit
        ).not.toHaveBeenCalled();
    });

    it('rejects punctuation-only and overlong searches', async () => {
        const punctuation = await GET(
            request('/api/creator-discovery?q=%20!!!%20%3F%3F%20')
        );
        const overlong = await GET(
            request(
                `/api/creator-discovery?q=${encodeURIComponent('a'.repeat(121))}`
            )
        );

        expect(punctuation.status).toBe(400);
        expect(await punctuation.json()).toEqual({
            error: 'Search for a person, event, phrase, or topic.',
        });
        expect(overlong.status).toBe(400);
        expect(await overlong.json()).toEqual({
            error: 'Searches must be 120 characters or fewer.',
        });
    });

    it('normalizes compatibility characters and enforces Brave word limits before quota', async () => {
        const expandedUnicode = await GET(
            request(
                `/api/creator-discovery?q=${encodeURIComponent('ﬃ'.repeat(41))}`
            )
        );
        const tooManyWords = await GET(
            request(
                `/api/creator-discovery?q=${encodeURIComponent(
                    Array.from({ length: 51 }, () => 'a').join(' ')
                )}`
            )
        );

        expect(expandedUnicode.status).toBe(400);
        expect(await expandedUnicode.json()).toEqual({
            error: 'Searches must be 120 characters or fewer.',
        });
        expect(tooManyWords.status).toBe(400);
        expect(await tooManyWords.json()).toEqual({
            error: 'Searches must use 50 words or fewer.',
        });
        expect(
            rateLimitMock.consumeDiscoverySearchRateLimit
        ).not.toHaveBeenCalled();
    });

    it('returns a retryable rate-limit response before any provider call', async () => {
        rateLimitMock.consumeDiscoverySearchRateLimit.mockResolvedValue({
            allowed: false,
            reason: 'rate_limited',
            retryAfterSeconds: 37,
        });

        const response = await GET(
            request('/api/creator-discovery?q=CJP%20protest')
        );

        expect(response.status).toBe(429);
        expect(response.headers.get('retry-after')).toBe('37');
        expect(searxngMock.searchSearxngImages).not.toHaveBeenCalled();
        expect(sourcesMock.searchWikimediaImages).not.toHaveBeenCalled();
    });
});
