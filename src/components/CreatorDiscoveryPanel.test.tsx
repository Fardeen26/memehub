// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CreatorDiscoveryPanel from './CreatorDiscoveryPanel';

const reusableImage = {
    id: 'commons-12',
    title: 'Dharmendra Pradhan portrait',
    previewUrl: 'https://upload.wikimedia.org/pradhan-480.jpg',
    assetUrl: 'https://upload.wikimedia.org/pradhan-1200.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pradhan.jpg',
    width: 1_200,
    height: 800,
    mimeType: 'image/jpeg' as const,
    creator: 'Government photographer',
    creditLine: 'Photo: Government of India / PIB',
    licenseName: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionRequired: true,
    provider: 'Wikimedia Commons' as const,
    rights: 'share-alike' as const,
};

const webImage = {
    id: 'brave-news-cjp',
    title: 'Police use lathis during CJP protest',
    previewUrl:
        'https://imgs.search.brave.com/example/rs:fit:500:0/g:ce/photo',
    assetUrl:
        'https://imgs.search.brave.com/example/rs:fit:500:0/g:ce/photo',
    sourceUrl: 'https://example-news.test/cjp-protest',
    sourceDomain: 'example-news.test',
    width: 500,
    height: 333,
    provider: 'SearXNG' as const,
    kind: 'news' as const,
    publishedAt: '2026-07-25T10:00:00.000Z',
    rights: 'unknown' as const,
};

function discoveryPayload(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        fetchedAt: '2026-07-25T13:05:00.000Z',
        query: 'darmendra pardhan',
        resolvedQuery: 'Dharmendra Pradhan',
        intent: 'moment',
        region: 'IN',
        trends: [],
        webImages: [webImage],
        reusableImages: [reusableImage],
        videos: [],
        providers: {
            web: 'live',
            commons: 'live',
        },
        ...overrides,
    };
}

function response(data: unknown) {
    return {
        ok: true,
        json: async () => data,
    };
}

function errorResponse(error: string, status: number) {
    return {
        ok: false,
        status,
        json: async () => ({ error }),
    };
}

function deferredResponse() {
    let resolve!: (value: ReturnType<typeof response>) => void;
    const promise = new Promise<ReturnType<typeof response>>((done) => {
        resolve = done;
    });
    return { promise, resolve };
}

describe('CreatorDiscoveryPanel', () => {
    const onAddImage = vi.fn(async () => undefined);
    const onUseAsTemplate = vi.fn(async () => undefined);

    beforeEach(() => {
        onAddImage.mockClear();
        onUseAsTemplate.mockClear();
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    function searchFor(value: string) {
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search people, moments, reactions, and meme material',
            }),
            { target: { value } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search images' }));
    }

    it('opens with meme-material intents instead of generic trending searches', () => {
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        expect(
            screen.getByRole('heading', { name: 'Find meme material' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Breaking moment/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Reaction face/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Clean cutout/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Blank template/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /Social post/ })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole('heading', { name: 'Trending in India' })
        ).not.toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('searches the selected creator intent and separates fresh web from reusable results', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(discoveryPayload()) as never
        );
        render(
            <CreatorDiscoveryPanel
                onAddImage={onAddImage}
                onUseAsTemplate={onUseAsTemplate}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: /Breaking moment/ })
        );
        searchFor('darmendra pardhan');

        await screen.findByText('Police use lathis during CJP protest');
        expect(fetch).toHaveBeenCalledWith(
            '/api/creator-discovery?q=darmendra+pardhan&intent=moment',
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
        expect(
            screen.getByText(/Showing results for “Dharmendra Pradhan”/)
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Fresh web' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Reusable & licensed' })
        ).toBeInTheDocument();
        expect(screen.getByText('Check source rights')).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /Open source for Police use/ })
        ).toHaveAttribute(
            'href',
            'https://example-news.test/cjp-protest'
        );
        expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Use Police use lathis during CJP protest as template',
            })
        );
        await waitFor(() =>
            expect(onUseAsTemplate).toHaveBeenCalledWith(webImage)
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Add Dharmendra Pradhan portrait as a layer',
            })
        );
        await waitFor(() =>
            expect(onAddImage).toHaveBeenCalledWith(reusableImage)
        );
    });

    it('re-runs an existing query when the creator switches material type', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(discoveryPayload()) as never
        );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('Dharmendra Pradhan');
        await screen.findByText('Police use lathis during CJP protest');
        fireEvent.click(
            screen.getByRole('button', { name: /Reaction face/ })
        );

        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(
            '/api/creator-discovery?q=Dharmendra+Pradhan&intent=reaction'
        );
    });

    it('stops punctuation-only searches without spending a request', async () => {
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('!!! ???');

        expect(
            await screen.findByText(
                'Search for a person, event, phrase, or topic.'
            )
        ).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('clears stale results when a newer search fails', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(response(discoveryPayload()) as never)
            .mockResolvedValueOnce(
                errorResponse(
                    'Live image search is temporarily unavailable.',
                    503
                ) as never
            );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('CJP protest');
        await screen.findByText('Police use lathis during CJP protest');
        searchFor('another event');

        expect(
            await screen.findByText(
                'Live image search is temporarily unavailable.'
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText('Police use lathis during CJP protest')
        ).not.toBeInTheDocument();
    });

    it('explains partial provider coverage without hiding useful results', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(
                discoveryPayload({
                    webImages: [],
                    providers: {
                        web: 'not-configured',
                        commons: 'live',
                    },
                })
            ) as never
        );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('Dharmendra Pradhan');

        expect(
            await screen.findByText(
                'Live web results are unavailable; showing reusable sources.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('Dharmendra Pradhan portrait')
        ).toBeInTheDocument();
    });

    it('warns when one live-web lane failed while keeping returned web images', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(
                discoveryPayload({
                    providers: {
                        web: 'degraded',
                        commons: 'live',
                    },
                })
            ) as never
        );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('CJP protest');

        expect(
            await screen.findByText(
                'Some live web sources are temporarily unavailable; showing the results that responded.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('Police use lathis during CJP protest')
        ).toBeInTheDocument();
    });

    it('does not blame the query when no-key web and failed reusable providers leave no coverage', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(
                discoveryPayload({
                    webImages: [],
                    reusableImages: [],
                    providers: {
                        web: 'not-configured',
                        commons: 'unavailable',
                    },
                })
            ) as never
        );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('CJP protest');

        expect(
            await screen.findByText(
                'Live web search is not configured, and reusable image search is temporarily unavailable.'
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/No useful visual yet/)
        ).not.toBeInTheDocument();
    });

    it('reports a reusable-provider failure while preserving live web results', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(
                discoveryPayload({
                    reusableImages: [],
                    providers: {
                        web: 'live',
                        commons: 'unavailable',
                    },
                })
            ) as never
        );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('CJP protest');

        expect(
            await screen.findByText(
                'Reusable image search is temporarily unavailable; showing live web results.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('Police use lathis during CJP protest')
        ).toBeInTheDocument();
    });

    it('reports both lanes when web is degraded and reusable search is down', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(
                discoveryPayload({
                    reusableImages: [],
                    providers: {
                        web: 'degraded',
                        commons: 'unavailable',
                    },
                })
            ) as never
        );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('CJP protest');

        expect(
            await screen.findByText(
                'Some live web sources are temporarily unavailable; showing the results that responded.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Reusable image search is temporarily unavailable; showing live web results.'
            )
        ).toBeInTheDocument();
    });

    it('provides creator-specific recovery when every provider is empty', async () => {
        vi.mocked(fetch).mockResolvedValue(
            response(
                discoveryPayload({
                    resolvedQuery: 'cjp protest lathi charge',
                    webImages: [],
                    reusableImages: [],
                })
            ) as never
        );
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('cjp protest lathi charge');

        expect(
            await screen.findByText(/No useful visual yet/)
        ).toBeInTheDocument();
        expect(
            screen.getByText(/try Reaction face or Clean cutout/i)
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/Show trending searches/i)
        ).not.toBeInTheDocument();
    });

    it('keeps the newest result when an older request resolves later', async () => {
        const olderRequest = deferredResponse();
        const newerRequest = deferredResponse();
        let olderSignal: AbortSignal | null | undefined;
        vi.mocked(fetch)
            .mockImplementationOnce((_input, init) => {
                olderSignal = init?.signal;
                return olderRequest.promise as never;
            })
            .mockImplementationOnce(() => newerRequest.promise as never);
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);

        searchFor('older');
        await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search people, moments, reactions, and meme material',
            }),
            { target: { value: 'newer' } }
        );
        fireEvent.submit(screen.getByRole('search'));

        newerRequest.resolve(
            response(
                discoveryPayload({
                    query: 'newer',
                    resolvedQuery: 'newer',
                    webImages: [
                        {
                            ...webImage,
                            id: 'brave-newer',
                            title: 'Newest event frame',
                        },
                    ],
                    reusableImages: [],
                })
            )
        );
        expect(
            await screen.findByText('Newest event frame')
        ).toBeInTheDocument();

        olderRequest.resolve(
            response(
                discoveryPayload({
                    query: 'older',
                    resolvedQuery: 'older',
                    webImages: [
                        {
                            ...webImage,
                            id: 'brave-older',
                            title: 'Stale event frame',
                        },
                    ],
                })
            )
        );

        await waitFor(() => {
            expect(olderSignal?.aborted).toBe(true);
            expect(
                screen.queryByText('Stale event frame')
            ).not.toBeInTheDocument();
        });
    });
});
