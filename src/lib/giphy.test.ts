import { describe, expect, it } from 'vitest';
import { mapGiphyItems } from '@/lib/giphy';
import type { GiphyItem } from '@/types/giphy';

function makeGiphyItem(images: GiphyItem['images']): GiphyItem {
    return {
        id: 'abc123',
        title: 'Test Media',
        images,
    };
}

describe('giphy mapping', () => {
    it('maps stickers as static media with still thumbnails and still editor URLs', () => {
        const [item] = mapGiphyItems([
            makeGiphyItem({
                fixed_height: { url: 'https://example.com/animated-200.gif', width: '220', height: '200' },
                fixed_height_small: { url: 'https://example.com/animated-100.gif', width: '110', height: '100' },
                fixed_height_small_still: { url: 'https://example.com/still-100.gif', width: '110', height: '100' },
                fixed_height_still: { url: 'https://example.com/still-200.gif', width: '220', height: '200' },
                original: { url: 'https://example.com/original.gif', width: '480', height: '480' },
            }),
        ], 'sticker');

        expect(item).toMatchObject({
            animated: false,
            height: 200,
            mediaType: 'sticker',
            previewUrl: 'https://example.com/still-100.gif',
            stillUrl: 'https://example.com/still-200.gif',
            url: 'https://example.com/still-200.gif',
            width: 220,
        });
    });

    it('maps GIFs with still thumbnails and bounded animated editor URLs', () => {
        const [item] = mapGiphyItems([
            makeGiphyItem({
                downsized: { url: 'https://example.com/downsized.gif', width: '480', height: '360' },
                fixed_height: { url: 'https://example.com/animated-200.gif', width: '267', height: '200' },
                fixed_height_small_still: { url: 'https://example.com/still-100.gif', width: '134', height: '100' },
                fixed_height_still: { url: 'https://example.com/still-200.gif', width: '267', height: '200' },
                original: { url: 'https://example.com/original.gif', width: '960', height: '720' },
            }),
        ], 'gif');

        expect(item).toMatchObject({
            animated: true,
            height: 200,
            mediaType: 'gif',
            previewUrl: 'https://example.com/still-100.gif',
            stillUrl: 'https://example.com/still-200.gif',
            url: 'https://example.com/animated-200.gif',
            width: 267,
        });
    });

    it('skips Giphy items without a usable media URL', () => {
        expect(mapGiphyItems([
            makeGiphyItem({
                fixed_height: { url: '', width: '200', height: '200' },
            }),
        ], 'gif')).toEqual([]);
    });
});
