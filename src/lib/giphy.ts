import type { GiphyItem, GiphyMediaItem, GiphySearchResponse } from '@/types/giphy';

const GIPHY_BASE = 'https://api.giphy.com/v1';
type GiphyMediaType = 'gif' | 'sticker';
type GiphyImageKey = keyof GiphyItem['images'];
type PickedGiphyRendition = { url: string; width: number; height: number };

const FALLBACK_RENDITION_SIZE = 200;

const STILL_PREVIEW_KEYS: GiphyImageKey[] = [
    'fixed_height_small_still',
    'fixed_width_small_still',
    'fixed_height_still',
    'fixed_width_still',
    'downsized_still',
    'original_still',
];

const STILL_EDITOR_KEYS: GiphyImageKey[] = [
    'fixed_height_still',
    'fixed_width_still',
    'fixed_height_small_still',
    'fixed_width_small_still',
    'downsized_still',
    'original_still',
];

const BOUNDED_ANIMATED_KEYS: GiphyImageKey[] = [
    'fixed_height',
    'fixed_width',
    'fixed_height_small',
    'fixed_width_small',
    'downsized',
    'original',
];

const SMALL_ANIMATED_FALLBACK_KEYS: GiphyImageKey[] = [
    'fixed_height_small',
    'fixed_width_small',
    'fixed_height',
    'fixed_width',
    'downsized',
    'original',
];

function parseRenditionDimension(value: string | undefined): number {
    const parsed = parseInt(value ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_RENDITION_SIZE;
}

function pickRendition(item: GiphyItem, keys: GiphyImageKey[]): PickedGiphyRendition | undefined {
    for (const key of keys) {
        const img = item.images[key];
        if (!img?.url) continue;

        return {
            url: img.url,
            width: parseRenditionDimension(img.width),
            height: parseRenditionDimension(img.height),
        };
    }

    return undefined;
}

export function pickGiphyUrl(item: GiphyItem, type: GiphyMediaType = 'gif'): PickedGiphyRendition {
    const img =
        type === 'sticker'
            ? pickRendition(item, [...STILL_EDITOR_KEYS, ...SMALL_ANIMATED_FALLBACK_KEYS])
            : pickRendition(item, BOUNDED_ANIMATED_KEYS);

    if (!img) {
        throw new Error('Giphy item has no usable image URL');
    }

    return img;
}

export function pickGiphyPreviewUrl(item: GiphyItem): string {
    return pickRendition(item, [...STILL_PREVIEW_KEYS, ...SMALL_ANIMATED_FALLBACK_KEYS])?.url || '';
}

export function pickGiphyStillUrl(item: GiphyItem): string | undefined {
    return pickRendition(item, STILL_EDITOR_KEYS)?.url;
}

export function mapGiphyItems(items: GiphyItem[], type: GiphyMediaType): GiphyMediaItem[] {
    const mapped: GiphyMediaItem[] = [];

    for (const item of items) {
        try {
            const { url, width, height } = pickGiphyUrl(item, type);
            const previewUrl = pickGiphyPreviewUrl(item) || url;
            const stillUrl = pickGiphyStillUrl(item);
            const animated = type === 'gif';

            mapped.push({
                id: item.id,
                mediaType: type,
                title: item.title || 'Untitled',
                previewUrl,
                url,
                width,
                height,
                animated,
                mimeHint: 'image/gif',
                stillUrl,
            });
        } catch {
            continue;
        }
    }

    return mapped;
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
        items: mapGiphyItems(data.data ?? [], type),
        pagination: data.pagination ?? { total_count: 0, count: 0, offset: 0 },
    };
}
