// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { ReusableImageAsset } from '@/types/creatorDiscovery';
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
});
