import { describe, expect, it, vi } from 'vitest';
import { searchSearxngImages } from './searxngImageSearch';

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

describe('SearXNG image search provider', () => {
    it('requests strict, recent image results and routes safe external thumbnails through the instance proxy', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            jsonResponse({
                results: [
                    {
                        title: 'Trump speech stumble goes viral',
                        url: 'https://news.example.com/trump-speech',
                        thumbnail_src:
                            'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Fthumb.jpg',
                        img_src: 'https://images.example.com/full.jpg',
                        resolution: '1200 x 675',
                        publishedDate: '2026-07-26T09:30:00Z',
                    },
                    {
                        title: 'External thumbnail result',
                        url: 'https://news.example.com/external-thumbnail',
                        thumbnail_src: 'https://images.example.com/thumb.jpg',
                    },
                ],
            })
        );

        const result = await searchSearxngImages('  Trump speech stumble  ', {
            baseUrl: 'http://localhost:8088',
            timeRange: 'day',
            fetcher,
            proxySecret: 'test-proxy-secret',
        });

        expect(fetcher).toHaveBeenCalledOnce();
        const [input, init] = fetcher.mock.calls[0] ?? [];
        const url = new URL(String(input));
        expect(url.href).toBe(
            'http://localhost:8088/search?q=Trump+speech+stumble&categories=images&language=en&time_range=day&format=json&safesearch=2'
        );
        expect(new Headers(init?.headers).get('Accept')).toBe(
            'application/json'
        );
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(result).toEqual({
            candidates: [
                {
                    id: expect.any(String),
                    title: 'Trump speech stumble goes viral',
                    previewUrl:
                        'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Fthumb.jpg&h=658ebd45db8934bf5a9ca2c3f6af1a340554d46260ae205250eab670fa4718c4',
                    assetUrl:
                        'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Ffull.jpg&h=1a02f0972491c724e11876973bb322edf58d305b14b2944edcff785005fb9d91',
                    sourceUrl: 'https://news.example.com/trump-speech',
                    sourceDomain: 'news.example.com',
                    width: 1_200,
                    height: 675,
                    publishedAt: '2026-07-26T09:30:00.000Z',
                    kind: 'web',
                },
            ],
            degradedEndpoints: [],
        });
    });

    it('drops unrelated stock-photo results that do not match the query terms', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            jsonResponse({
                results: [
                    {
                        title: 'Smiling Man Wearing Sunglasses Outdoors in Coimbatore',
                        url: 'https://www.pexels.com/photo/smiling-man-wearing-sunglasses-outdoors-in-coimbatore-123456/',
                        thumbnail_src:
                            'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.pexels.com%2Fphotos%2F123456%2Fpexels-photo-123456.jpeg',
                        img_src:
                            'https://images.pexels.com/photos/123456/pexels-photo-123456.jpeg',
                    },
                    {
                        title: 'Kunal Kamra attends press interaction',
                        url: 'https://news.example.com/kunal-kamra-press',
                        thumbnail_src:
                            'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Fthumb.jpg',
                        img_src: 'https://images.example.com/full.jpg',
                    },
                ],
            })
        );

        const result = await searchSearxngImages('Kunal Kamra', {
            baseUrl: 'http://localhost:8088',
            fetcher,
            proxySecret: 'test-proxy-secret',
        });

        expect(result.candidates).toEqual([
            expect.objectContaining({
                title: 'Kunal Kamra attends press interaction',
            }),
        ]);
    });

    it('keeps only social-domain results that match the query terms', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            jsonResponse({
                results: [
                    {
                        title: 'Smiling Man Wearing Sunglasses Outdoors',
                        url: 'https://www.instagram.com/p/example/',
                        thumbnail_src:
                            'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Fthumb.jpg',
                        img_src: 'https://images.example.com/full.jpg',
                    },
                    {
                        title: 'Kunal Kamra on X',
                        url: 'https://x.com/kunalkamra/status/123',
                        thumbnail_src:
                            'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Fthumb2.jpg',
                        img_src: 'https://images.example.com/full2.jpg',
                    },
                    {
                        title: 'Kunal Kamra post',
                        url: 'https://news.example.com/kunal-kamra-post',
                        thumbnail_src:
                            'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Fthumb3.jpg',
                        img_src: 'https://images.example.com/full3.jpg',
                    },
                ],
            })
        );

        const result = await searchSearxngImages('Kunal Kamra', {
            baseUrl: 'http://localhost:8088',
            fetcher,
            proxySecret: 'test-proxy-secret',
            intent: 'social',
        });

        expect(result.candidates).toEqual([
            expect.objectContaining({
                title: 'Kunal Kamra on X',
            }),
        ]);
    });
});
