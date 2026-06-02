import type { GiphyItem, GiphyMediaItem, GiphySearchResponse } from '@/types/giphy';

const GIPHY_BASE = 'https://api.giphy.com/v1';

export function pickGiphyUrl(item: GiphyItem): { url: string; width: number; height: number } {
    const img =
        item.images.downsized ||
        item.images.fixed_height ||
        item.images.fixed_height_small ||
        item.images.original;

    if (!img?.url) {
        throw new Error('Giphy item has no usable image URL');
    }

    return {
        url: img.url,
        width: parseInt(img.width, 10) || 200,
        height: parseInt(img.height, 10) || 200,
    };
}

export function pickGiphyPreviewUrl(item: GiphyItem): string {
    return (
        item.images.fixed_height_small?.url ||
        item.images.fixed_height?.url ||
        item.images.downsized?.url ||
        item.images.original?.url ||
        ''
    );
}

export function mapGiphyItems(items: GiphyItem[]): GiphyMediaItem[] {
    return items
        .map((item) => {
            try {
                const { url, width, height } = pickGiphyUrl(item);
                const previewUrl = pickGiphyPreviewUrl(item) || url;
                return {
                    id: item.id,
                    title: item.title || 'Untitled',
                    previewUrl,
                    url,
                    width,
                    height,
                };
            } catch {
                return null;
            }
        })
        .filter((item): item is GiphyMediaItem => item !== null);
}

export async function fetchGiphy(
    apiKey: string,
    type: 'gif' | 'sticker',
    options: { q?: string; offset?: number; limit?: number }
): Promise<{ items: GiphyMediaItem[]; pagination: GiphySearchResponse['pagination'] }> {
    const limit = Math.min(options.limit ?? 24, 50);
    const offset = options.offset ?? 0;
    const hasQuery = Boolean(options.q?.trim());

    const resource = type === 'sticker' ? 'stickers' : 'gifs';
    const action = hasQuery ? 'search' : 'trending';
    const url = new URL(`${GIPHY_BASE}/${resource}/${action}`);

    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('rating', 'pg-13');
    url.searchParams.set('lang', 'en');

    if (hasQuery) {
        url.searchParams.set('q', options.q!.trim());
    }

    const response = await fetch(url.toString(), {
        headers: { Accept: 'application/json' },
        next: { revalidate: 300 },
    });

    if (!response.ok) {
        throw new Error(`Giphy request failed (${response.status})`);
    }

    const data: GiphySearchResponse = await response.json();

    if (data.meta && data.meta.status !== 200) {
        throw new Error(data.meta.msg || 'Giphy API error');
    }

    return {
        items: mapGiphyItems(data.data ?? []),
        pagination: data.pagination ?? { total_count: 0, count: 0, offset: 0 },
    };
}
