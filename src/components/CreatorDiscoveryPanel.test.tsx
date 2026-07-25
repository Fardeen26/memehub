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

const trend = {
    id: 'trend-janta-party',
    title: 'जनता पार्टी',
    approximateTraffic: 20_000,
    trafficLabel: '20000+',
    publishedAt: '2026-07-25T13:00:00.000Z',
    imageUrl: 'https://images.example.com/cjp.jpg',
    imageSource: 'AajTak',
    sources: [
        {
            id: 'news-pradhan',
            title: 'Dharmendra Pradhan resigns after viral protest',
            publisher: 'Example News',
            url: 'https://example.com/pradhan',
            imageUrl: 'https://images.example.com/pradhan.jpg',
            publishedAt: '2026-07-25T13:00:00.000Z',
            kind: 'news' as const,
        },
    ],
};

const reusableImage = {
    id: 'commons-12',
    title: 'Dharmendra Pradhan portrait',
    previewUrl: 'https://upload.wikimedia.org/pradhan-480.jpg',
    assetUrl: 'https://upload.wikimedia.org/pradhan-1200.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Pradhan.jpg',
    width: 1_200,
    height: 800,
    mimeType: 'image/jpeg',
    creator: 'Government photographer',
    creditLine: 'Photo: Government of India / PIB',
    licenseName: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attributionRequired: true,
    usageTerms: 'Creative Commons Attribution-ShareAlike 4.0',
    restrictions: 'Personality rights may apply',
    provider: 'Wikimedia Commons' as const,
    rights: 'share-alike' as const,
};

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
        localStorage.clear();
        onAddImage.mockClear();
        onUseAsTemplate.mockClear();
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                })
            )
        );
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it('keeps news and source details out of the image-finding workflow', async () => {
        render(
            <CreatorDiscoveryPanel
                onAddImage={onAddImage}
                onUseAsTemplate={onUseAsTemplate}
            />
        );

        const trendButton = await screen.findByRole('button', {
            name: 'Find images for जनता पार्टी',
        });
        expect(trendButton).toBeInTheDocument();
        expect(trendButton.parentElement).toHaveClass(
            'grid-cols-1'
        );
        expect(trendButton.parentElement).not.toHaveClass('sm:grid-cols-2');
        expect(trendButton).toHaveClass('min-h-10');
        expect(trendButton).not.toHaveClass('p-2');
        expect(
            screen.getByRole('heading', { name: 'Find a meme image' })
        ).toBeInTheDocument();
        expect(
            screen.queryByText(
                'Dharmendra Pradhan resigns after viral protest'
            )
        ).not.toBeInTheDocument();
        expect(screen.queryByText('20K+ searches')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: 'Source inbox' })
        ).not.toBeInTheDocument();
        expect(
            document.querySelector(
                'img[src="https://images.example.com/cjp.jpg"]'
            )
        ).toBeNull();
    });

    it('lets a creator use a result as the template or add it as a layer', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:06:00.000Z',
                    query: 'Dharmendra Pradhan',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [reusableImage],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'live',
                        youtube: 'not-configured',
                    },
                }) as never
            );

        render(
            <CreatorDiscoveryPanel
                onAddImage={onAddImage}
                onUseAsTemplate={onUseAsTemplate}
            />
        );
        await screen.findByRole('button', {
            name: 'Find images for जनता पार्टी',
        });

        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Dharmendra Pradhan' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search images' }));

        expect(
            await screen.findByText('Dharmendra Pradhan portrait')
        ).toBeInTheDocument();
        expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
        const resultCard = screen
            .getByRole('img', { name: 'Dharmendra Pradhan portrait' })
            .closest('article');
        expect(resultCard?.parentElement).toHaveClass(
            'grid-cols-1'
        );
        expect(resultCard?.parentElement).not.toHaveClass('sm:grid-cols-2');
        const storageWrite = vi.spyOn(Storage.prototype, 'setItem');

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Use Dharmendra Pradhan portrait as template',
            })
        );

        await waitFor(() =>
            expect(onUseAsTemplate).toHaveBeenCalledWith(reusableImage)
        );

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Add Dharmendra Pradhan portrait as a layer',
            })
        );
        await waitFor(() =>
            expect(onAddImage).toHaveBeenCalledWith(reusableImage)
        );
        expect(storageWrite).not.toHaveBeenCalled();
    });

    it('does not claim the template changed when the creator cancels replacement', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:06:00.000Z',
                    query: 'Dharmendra Pradhan',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [reusableImage],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'live',
                        youtube: 'not-configured',
                    },
                }) as never
            );
        const cancelTemplateChange = vi.fn(async () => false);

        render(
            <CreatorDiscoveryPanel
                onAddImage={onAddImage}
                onUseAsTemplate={cancelTemplateChange}
            />
        );
        await screen.findByRole('button', {
            name: 'Find images for जनता पार्टी',
        });
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Dharmendra Pradhan' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search images' }));
        fireEvent.click(
            await screen.findByRole('button', {
                name: 'Use Dharmendra Pradhan portrait as template',
            })
        );

        await waitFor(() =>
            expect(cancelTemplateChange).toHaveBeenCalledOnce()
        );
        expect(
            screen.queryByText('Template ready. Add your text and publish.')
        ).not.toBeInTheDocument();
    });

    it('announces a pending template action without changing its meaning visually', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:06:00.000Z',
                    query: 'Dharmendra Pradhan',
                    region: 'IN',
                    trends: [],
                    reusableImages: [reusableImage],
                    videos: [],
                    providers: {
                        trends: 'idle',
                        commons: 'live',
                        youtube: 'not-configured',
                    },
                }) as never
            );
        let finishTemplateAction: (() => void) | undefined;
        const pendingTemplateAction = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finishTemplateAction = resolve;
                })
        );

        render(
            <CreatorDiscoveryPanel
                onAddImage={onAddImage}
                onUseAsTemplate={pendingTemplateAction}
            />
        );
        await screen.findByText('जनता पार्टी');
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Dharmendra Pradhan' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search images' }));
        const templateButton = await screen.findByRole('button', {
            name: 'Use Dharmendra Pradhan portrait as template',
        });
        fireEvent.click(templateButton);

        await waitFor(() =>
            expect(templateButton).toHaveAttribute('aria-busy', 'true')
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            'Preparing Dharmendra Pradhan portrait as your template'
        );

        finishTemplateAction?.();
    });

    it('returns from a material search to the live India pulse', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:06:00.000Z',
                    query: 'Dharmendra Pradhan',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [reusableImage],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'live',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:07:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            );

        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);
        await screen.findByText('जनता पार्टी');
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Dharmendra Pradhan' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search images' }));
        await screen.findByRole('heading', {
            name: 'Images for “Dharmendra Pradhan”',
        });

        fireEvent.click(
            screen.getByRole('button', { name: 'Show trending searches' })
        );

        expect(
            await screen.findByRole('heading', {
                name: 'Trending in India',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            })
        ).toHaveValue('');
    });

    it('stops punctuation-only searches before they spend a provider request', async () => {
        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);
        await screen.findByText('जनता पार्टी');

        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: '!!! ???' } }
        );
        fireEvent.submit(screen.getByRole('search'));

        expect(
            await screen.findByText(
                'Search for a person, event, phrase, or topic.'
            )
        ).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('shows the safe API reason when discovery asks the creator to retry', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                errorResponse(
                    'Too many discovery searches. Try again shortly.',
                    429
                ) as never
            );

        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);
        await screen.findByText('जनता पार्टी');
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Narendra Modi' } }
        );
        fireEvent.submit(screen.getByRole('search'));

        expect(
            await screen.findByText(
                'Too many discovery searches. Try again shortly.'
            )
        ).toBeInTheDocument();
    });

    it('explains when licensed image search is unavailable instead of calling it an empty match', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:06:00.000Z',
                    query: 'Dharmendra Pradhan',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'unavailable',
                        youtube: 'not-configured',
                    },
                }) as never
            );

        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);
        await screen.findByText('जनता पार्टी');
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Dharmendra Pradhan' } }
        );
        fireEvent.click(screen.getByRole('button', { name: 'Search images' }));

        expect(
            await screen.findByText(
                'Image search is temporarily unavailable. Try again shortly.'
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/No clearly licensed image match/)
        ).not.toBeInTheDocument();
    });

    it('reports only the image-search failure that affects the creator', async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:06:00.000Z',
                    query: 'Narendra Modi',
                    region: 'IN',
                    trends: [],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'unavailable',
                        commons: 'unavailable',
                        youtube: 'rate-limited',
                    },
                }) as never
            );

        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);
        await screen.findByText('जनता पार्टी');
        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Narendra Modi' } }
        );
        fireEvent.submit(screen.getByRole('search'));

        expect(
            await screen.findByText(
                'Image search is temporarily unavailable. Try again shortly.'
            )
        ).toBeInTheDocument();
    });

    it('keeps the newest discovery result when an older request finishes later', async () => {
        const olderRequest = deferredResponse();
        const newerRequest = deferredResponse();
        let olderSignal: AbortSignal | null | undefined;

        vi.mocked(fetch)
            .mockResolvedValueOnce(
                response({
                    fetchedAt: '2026-07-25T13:05:00.000Z',
                    query: '',
                    region: 'IN',
                    trends: [trend],
                    reusableImages: [],
                    videos: [],
                    providers: {
                        trends: 'live',
                        commons: 'idle',
                        youtube: 'not-configured',
                    },
                }) as never
            )
            .mockImplementationOnce((_input, init) => {
                olderSignal = init?.signal;
                return olderRequest.promise as never;
            })
            .mockImplementationOnce(() => newerRequest.promise as never);

        render(<CreatorDiscoveryPanel onAddImage={onAddImage} />);
        await screen.findByText('जनता पार्टी');

        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search viral topics and reusable visuals',
            }),
            { target: { value: 'Dharmendra Pradhan' } }
        );
        const searchForm = screen.getByRole('search');
        fireEvent.submit(searchForm);
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        fireEvent.submit(searchForm);
        await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));

        newerRequest.resolve(
            response({
                fetchedAt: '2026-07-25T13:07:00.000Z',
                query: 'Dharmendra Pradhan',
                region: 'IN',
                trends: [],
                reusableImages: [
                    {
                        ...reusableImage,
                        id: 'commons-newer',
                        title: 'Newest licensed portrait',
                    },
                ],
                videos: [],
                providers: {
                    trends: 'live',
                    commons: 'live',
                    youtube: 'not-configured',
                },
            })
        );
        expect(
            await screen.findByText('Newest licensed portrait')
        ).toBeInTheDocument();

        olderRequest.resolve(
            response({
                fetchedAt: '2026-07-25T13:06:00.000Z',
                query: 'Dharmendra Pradhan',
                region: 'IN',
                trends: [],
                reusableImages: [
                    {
                        ...reusableImage,
                        id: 'commons-older',
                        title: 'Stale licensed portrait',
                    },
                ],
                videos: [],
                providers: {
                    trends: 'live',
                    commons: 'live',
                    youtube: 'not-configured',
                },
            })
        );

        await waitFor(() => {
            expect(olderSignal?.aborted).toBe(true);
            expect(
                screen.queryByText('Stale licensed portrait')
            ).not.toBeInTheDocument();
        });
    });

});
