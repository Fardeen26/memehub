// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type {
    ReusableImageAsset,
    WebImageAsset,
} from '@/types/creatorDiscovery';
import {
    materializeReusableImage,
    REUSABLE_IMAGE_MAX_BYTES,
} from './reusableImagePersistence';

const asset: ReusableImageAsset = {
    id: 'commons-12',
    title: 'Dharmendra Pradhan portrait',
    previewUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg',
    assetUrl:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/example.jpg',
    sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Dharmendra_Pradhan.jpg',
    width: 1_200,
    height: 800,
    mimeType: 'image/jpeg',
    creator: 'Example photographer',
    licenseName: 'CC BY-SA 4.0',
    provider: 'Wikimedia Commons',
    rights: 'share-alike',
};

const webAsset: WebImageAsset = {
    id: 'searxng-news-1',
    title: 'CJP protest lathi charge',
    previewUrl:
        '/api/creator-discovery/image?url=http%3A%2F%2Flocalhost%3A8088%2Fimage_proxy%3Furl%3Dhttps%253A%252F%252Fimages.example.com%252Fframe.jpg',
    assetUrl:
        '/api/creator-discovery/image?url=http%3A%2F%2Flocalhost%3A8088%2Fimage_proxy%3Furl%3Dhttps%253A%252F%252Fimages.example.com%252Fframe.jpg',
    sourceUrl: 'https://example-news.test/cjp-protest',
    sourceDomain: 'example-news.test',
    width: 500,
    height: 333,
    provider: 'SearXNG',
    kind: 'news',
    publishedAt: '2026-07-25T13:00:00.000Z',
    rights: 'unknown',
};

const searxngAsset: WebImageAsset = {
    ...webAsset,
    id: 'searxng-image-1',
    previewUrl:
        '/api/creator-discovery/image?url=http%3A%2F%2Flocalhost%3A8088%2Fimage_proxy%3Furl%3Dhttps%253A%252F%252Fimages.example.com%252Fframe.jpg',
    assetUrl:
        '/api/creator-discovery/image?url=http%3A%2F%2Flocalhost%3A8088%2Fimage_proxy%3Furl%3Dhttps%253A%252F%252Fimages.example.com%252Fframe.jpg',
    provider: 'SearXNG',
};

describe('reusable image persistence', () => {
    it('downloads a bounded Commons rendition into a local File for draft recovery', async () => {
        const imageBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            {
                ok: true,
                headers: new Headers({
                    'Content-Length': '9',
                    'Content-Type': 'image/jpeg',
                }),
                blob: async () => imageBlob,
            } as Response
        );

        const file = await materializeReusableImage(asset, fetcher);

        expect(file).toBeInstanceOf(File);
        expect(file.type).toBe('image/jpeg');
        expect(file.size).toBe(9);
        expect(file.name).toBe('Dharmendra-Pradhan-portrait.jpg');
        expect(fetcher).toHaveBeenCalledWith(
            asset.assetUrl,
            expect.objectContaining({
                cache: 'force-cache',
                credentials: 'omit',
                redirect: 'error',
                referrerPolicy: 'no-referrer',
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('rejects non-Commons origins before making a request', async () => {
        const fetcher = vi.fn<typeof fetch>();

        await expect(
            materializeReusableImage(
                {
                    ...asset,
                    assetUrl: 'https://attacker.example/portrait.jpg',
                },
                fetcher
            )
        ).rejects.toThrow('trusted Wikimedia');
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('rejects oversized or MIME-mismatched downloads', async () => {
        const oversizedFetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response('too large', {
                status: 200,
                headers: {
                    'Content-Length': String(REUSABLE_IMAGE_MAX_BYTES + 1),
                    'Content-Type': 'image/jpeg',
                },
            })
        );
        const mismatchedFetcher = vi.fn<typeof fetch>().mockResolvedValue(
            {
                ok: true,
                headers: new Headers({ 'Content-Type': 'image/png' }),
                blob: async () => new Blob(['png'], { type: 'image/png' }),
            } as Response
        );

        await expect(
            materializeReusableImage(asset, oversizedFetcher)
        ).rejects.toThrow('too large');
        await expect(
            materializeReusableImage(asset, mismatchedFetcher)
        ).rejects.toThrow('unexpected image format');
    });

    it('stops an unbounded stream as soon as it exceeds the safe image limit', async () => {
        const cancel = vi.fn(async () => undefined);
        const read = vi
            .fn()
            .mockResolvedValueOnce({
                done: false,
                value: new Uint8Array(REUSABLE_IMAGE_MAX_BYTES),
            })
            .mockResolvedValueOnce({
                done: false,
                value: new Uint8Array(1),
            });
        const blob = vi.fn(async () => {
            throw new Error('The response was buffered without a limit.');
        });
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            {
                ok: true,
                headers: new Headers({
                    'Content-Type': 'image/jpeg',
                }),
                body: {
                    getReader: () => ({ read, cancel }),
                },
                blob,
            } as unknown as Response
        );

        await expect(
            materializeReusableImage(asset, fetcher)
        ).rejects.toThrow('too large');
        expect(cancel).toHaveBeenCalledOnce();
        expect(blob).not.toHaveBeenCalled();
    });

    it('materializes a SearXNG relay result after sniffing its real image type', async () => {
        const jpegBytes = new Uint8Array([
            0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
        ]);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(jpegBytes, {
                status: 200,
                headers: {
                    'Content-Type': 'application/octet-stream',
                },
            })
        );

        const file = await materializeReusableImage(webAsset, fetcher);

        expect(file.type).toBe('image/jpeg');
        expect(file.name).toBe('CJP-protest-lathi-charge.jpg');
        expect(fetcher).toHaveBeenCalledWith(
            webAsset.assetUrl,
            expect.objectContaining({
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            })
        );
    });

    it('materializes a SearXNG result only through the same-origin image relay', async () => {
        const pngBytes = new Uint8Array([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(pngBytes, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            })
        );

        const file = await materializeReusableImage(searxngAsset, fetcher);

        expect(file.type).toBe('image/png');
        expect(fetcher).toHaveBeenCalledWith(
            searxngAsset.assetUrl,
            expect.objectContaining({ credentials: 'omit' })
        );
    });

    it('never downloads an arbitrary original URL disguised as a SearXNG result', async () => {
        const fetcher = vi.fn<typeof fetch>();

        await expect(
            materializeReusableImage(
                {
                    ...webAsset,
                    assetUrl: 'https://internal.example/private.jpg',
                },
                fetcher
            )
        ).rejects.toThrow('trusted SearXNG relay');
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('rejects a response that was redirected after validating the trusted host', async () => {
        const blob = vi.fn(async () => new Blob(['redirected image']));
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            redirected: true,
            headers: new Headers({
                'Content-Length': '16',
                'Content-Type': 'image/jpeg',
            }),
            blob,
        } as unknown as Response);

        await expect(
            materializeReusableImage(asset, fetcher)
        ).rejects.toThrow('redirected');
        expect(fetcher).toHaveBeenCalledWith(
            asset.assetUrl,
            expect.objectContaining({ redirect: 'error' })
        );
        expect(blob).not.toHaveBeenCalled();
    });

    it('uses a provider-neutral error when an image download fails', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(null, { status: 502 })
        );

        await expect(
            materializeReusableImage(webAsset, fetcher)
        ).rejects.toThrow('The image could not be downloaded.');
    });
});
