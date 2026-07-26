import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('creator discovery image relay', () => {
    afterEach(() => {
        delete process.env.SEARXNG_URL;
        vi.unstubAllGlobals();
    });

    it('relays only image-proxy URLs from the configured SearXNG instance', async () => {
        process.env.SEARXNG_URL = 'http://localhost:8088';
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            })
        );
        vi.stubGlobal('fetch', fetcher);
        const imageUrl =
            'http://localhost:8088/image_proxy?url=https%3A%2F%2Fimages.example.com%2Fframe.png';

        const response = await GET(
            new NextRequest(
                `http://localhost/api/creator-discovery/image?${new URLSearchParams({
                    url: imageUrl,
                }).toString()}`
            )
        );

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('image/png');
        expect(fetcher).toHaveBeenCalledWith(
            imageUrl,
            expect.objectContaining({
                credentials: 'omit',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
            })
        );
    });

    it('refuses proxy URLs from any other origin', async () => {
        process.env.SEARXNG_URL = 'http://localhost:8088';

        const response = await GET(
            new NextRequest(
                'http://localhost/api/creator-discovery/image?url=https%3A%2F%2Fattacker.example%2Fimage_proxy%3Furl%3Dhttp%253A%252F%252Finternal'
            )
        );

        expect(response.status).toBe(400);
    });
});
