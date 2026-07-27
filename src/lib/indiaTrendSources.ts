import type {
    CreatorSourceReference,
    IndiaTrendSignal,
    ReusableImageAsset,
} from '@/types/creatorDiscovery';
import {
    hasMeaningfulReusableCredit,
    resolveReusableImageRights,
} from './reusableMediaRights';

export const GOOGLE_TRENDS_INDIA_RSS_URL =
    'https://trends.google.com/trending/rss?geo=IN';
export const WIKIMEDIA_COMMONS_API_URL =
    'https://commons.wikimedia.org/w/api.php';
export const YOUTUBE_SEARCH_API_URL =
    'https://www.googleapis.com/youtube/v3/search';

const SAFE_IMAGE_MIME_TYPES = new Set<ReusableImageAsset['mimeType']>([
    'image/jpeg',
    'image/png',
    'image/webp',
]);

type Fetcher = typeof fetch;

type WikimediaMetadataValue = {
    value?: string;
};

type WikimediaImageInfo = {
    mime?: string;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    thumbmime?: string;
    descriptionurl?: string;
    extmetadata?: Record<string, WikimediaMetadataValue>;
};

type WikimediaPage = {
    pageid?: number;
    title?: string;
    imageinfo?: WikimediaImageInfo[];
};

type WikimediaResponse = {
    query?: {
        pages?: Record<string, WikimediaPage>;
    };
};

type YouTubeSearchItem = {
    id?: { videoId?: string } | string;
    snippet?: {
        title?: string;
        channelTitle?: string;
        publishedAt?: string;
        thumbnails?: Record<
            string,
            { url?: string; width?: number; height?: number }
        >;
    };
};

type YouTubeSearchResponse = {
    items?: YouTubeSearchItem[];
};

function stableId(prefix: string, value: string): string {
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function decodeEntities(value: string): string {
    const named: Record<string, string> = {
        amp: '&',
        apos: "'",
        gt: '>',
        lt: '<',
        nbsp: ' ',
        quot: '"',
    };

    return value
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(
            /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
            (match, entity: string) => {
                if (entity.startsWith('#x')) {
                    const codePoint = Number.parseInt(entity.slice(2), 16);
                    return Number.isFinite(codePoint)
                        ? String.fromCodePoint(codePoint)
                        : match;
                }
                if (entity.startsWith('#')) {
                    const codePoint = Number.parseInt(entity.slice(1), 10);
                    return Number.isFinite(codePoint)
                        ? String.fromCodePoint(codePoint)
                        : match;
                }
                return named[entity.toLowerCase()] ?? match;
            }
        )
        .trim();
}

function stripHtml(value: string): string {
    return decodeEntities(value.replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readTag(block: string, tag: string): string {
    const escapedTag = escapeRegExp(tag);
    const match = block.match(
        new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`, 'i')
    );
    return match ? decodeEntities(match[1]) : '';
}

function readBlocks(block: string, tag: string): string[] {
    const escapedTag = escapeRegExp(tag);
    return Array.from(
        block.matchAll(
            new RegExp(
                `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
                'gi'
            )
        ),
        (match) => match[1]
    );
}

export function safeWebUrl(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return undefined;
        }
        return url.toString();
    } catch {
        return undefined;
    }
}

function parseTraffic(value: string): number {
    const normalized = value.replace(/,/g, '').trim().toLowerCase();
    const match = normalized.match(/^([\d.]+)\s*([kmb])?/);
    if (!match) return 0;
    const amount = Number.parseFloat(match[1]);
    const multiplier =
        match[2] === 'b'
            ? 1_000_000_000
            : match[2] === 'm'
              ? 1_000_000
              : match[2] === 'k'
                ? 1_000
                : 1;
    return Number.isFinite(amount) ? Math.round(amount * multiplier) : 0;
}

function toIsoDate(value: string): string {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp)
        ? new Date(timestamp).toISOString()
        : new Date(0).toISOString();
}

export function parseGoogleTrendsRss(xml: string): IndiaTrendSignal[] {
    return readBlocks(xml, 'item')
        .map((itemBlock): IndiaTrendSignal | null => {
            const title = stripHtml(readTag(itemBlock, 'title'));
            if (!title) return null;

            const publishedAt = toIsoDate(readTag(itemBlock, 'pubDate'));
            const trafficLabel = stripHtml(
                readTag(itemBlock, 'ht:approx_traffic')
            );
            const sources = readBlocks(itemBlock, 'ht:news_item')
                .map((sourceBlock): CreatorSourceReference | null => {
                    const sourceTitle = stripHtml(
                        readTag(sourceBlock, 'ht:news_item_title')
                    );
                    const url = safeWebUrl(
                        readTag(sourceBlock, 'ht:news_item_url')
                    );
                    if (!sourceTitle || !url) return null;

                    const publisher =
                        stripHtml(
                            readTag(sourceBlock, 'ht:news_item_source')
                        ) || new URL(url).hostname;
                    const imageUrl = safeWebUrl(
                        readTag(sourceBlock, 'ht:news_item_picture')
                    );

                    return {
                        id: stableId('news', url),
                        title: sourceTitle,
                        publisher,
                        url,
                        imageUrl,
                        publishedAt,
                        kind: 'news',
                    };
                })
                .filter(
                    (source): source is CreatorSourceReference =>
                        source !== null
                );

            return {
                id: stableId('trend', `${title}:${publishedAt}`),
                title,
                approximateTraffic: parseTraffic(trafficLabel),
                trafficLabel,
                publishedAt,
                imageUrl: safeWebUrl(readTag(itemBlock, 'ht:picture')),
                imageSource:
                    stripHtml(readTag(itemBlock, 'ht:picture_source')) ||
                    undefined,
                sources,
            };
        })
        .filter((trend): trend is IndiaTrendSignal => trend !== null)
        .sort(
            (left, right) =>
                Date.parse(right.publishedAt) - Date.parse(left.publishedAt) ||
                right.approximateTraffic - left.approximateTraffic
        );
}

function normalizeSearchValue(value: string): string {
    return value
        .normalize('NFKC')
        .toLocaleLowerCase('en-IN')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

export function filterIndiaTrends(
    trends: IndiaTrendSignal[],
    query: string
): IndiaTrendSignal[] {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) return trends;
    const queryTokens = normalizedQuery.split(/\s+/);

    return trends.filter((trend) => {
        const haystack = normalizeSearchValue(
            [
                trend.title,
                ...trend.sources.flatMap((source) => [
                    source.title,
                    source.publisher,
                    source.url,
                ]),
            ].join(' ')
        );
        return (
            haystack.includes(normalizedQuery) ||
            queryTokens.every((token) => haystack.includes(token))
        );
    });
}

function cleanFileTitle(value: string): string {
    return value
        .replace(/^file:/i, '')
        .replace(/\.(?:jpe?g|png|webp)$/i, '')
        .replace(/_/g, ' ')
        .trim();
}

export function mapWikimediaImages(
    response: WikimediaResponse
): ReusableImageAsset[] {
    const pages = Object.values(response.query?.pages ?? {});

    return pages
        .map((page): ReusableImageAsset | null => {
            const image = page.imageinfo?.[0];
            const mimeType = (
                image?.thumbmime ?? image?.mime
            )?.toLowerCase() as
                | ReusableImageAsset['mimeType']
                | undefined;
            const assetUrl = safeWebUrl(image?.thumburl);
            const sourceUrl = safeWebUrl(image?.descriptionurl);
            const title = cleanFileTitle(page.title ?? '');
            const metadata = image?.extmetadata ?? {};
            const licenseName = stripHtml(
                metadata.LicenseShortName?.value ?? ''
            );
            const rights = resolveReusableImageRights(licenseName);
            const rawCreator = stripHtml(
                metadata.Artist?.value ??
                    metadata.Credit?.value ??
                    metadata.Attribution?.value ??
                    ''
            ).slice(0, 1_000);
            const creditLine =
                stripHtml(
                    metadata.Attribution?.value ??
                        metadata.Credit?.value ??
                        metadata.Artist?.value ??
                        ''
                ).slice(0, 1_000) || undefined;
            const attributionRequired = /^(?:true|1|yes)$/i.test(
                stripHtml(metadata.AttributionRequired?.value ?? '')
            );

            if (
                !image ||
                !title ||
                !mimeType ||
                !SAFE_IMAGE_MIME_TYPES.has(mimeType) ||
                !assetUrl ||
                !sourceUrl ||
                !licenseName ||
                !rights ||
                ((rights !== 'editable' || attributionRequired) &&
                    !hasMeaningfulReusableCredit(creditLine))
            ) {
                return null;
            }

            const creator = rawCreator || 'See source page';
            const usageTerms =
                stripHtml(metadata.UsageTerms?.value ?? '').slice(0, 1_000) ||
                undefined;
            const restrictions =
                stripHtml(metadata.Restrictions?.value ?? '').slice(0, 1_000) ||
                undefined;
            return {
                id: `commons-${page.pageid ?? stableId('file', sourceUrl)}`,
                title,
                previewUrl: assetUrl,
                assetUrl,
                sourceUrl,
                width: Math.max(1, image.thumbwidth ?? 1),
                height: Math.max(1, image.thumbheight ?? 1),
                mimeType,
                creator,
                creditLine,
                licenseName,
                licenseUrl: safeWebUrl(metadata.LicenseUrl?.value),
                attributionRequired,
                usageTerms,
                restrictions,
                provider: 'Wikimedia Commons',
                rights,
            };
        })
        .filter((image): image is ReusableImageAsset => image !== null);
}

export function mapYouTubeVideos(
    response: YouTubeSearchResponse
): CreatorSourceReference[] {
    return (response.items ?? [])
        .map((item): CreatorSourceReference | null => {
            const videoId =
                typeof item.id === 'string' ? item.id : item.id?.videoId;
            if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) return null;
            const title = stripHtml(item.snippet?.title ?? '');
            if (!title) return null;
            const thumbnails = item.snippet?.thumbnails ?? {};
            const thumbnail =
                thumbnails.high ??
                thumbnails.medium ??
                thumbnails.default ??
                Object.values(thumbnails)[0];
            const url = `https://www.youtube.com/watch?v=${videoId}`;

            return {
                id: `youtube-${videoId}`,
                title,
                publisher:
                    stripHtml(item.snippet?.channelTitle ?? '') || 'YouTube',
                url,
                imageUrl: safeWebUrl(thumbnail?.url),
                publishedAt: toIsoDate(item.snippet?.publishedAt ?? ''),
                kind: 'video',
            };
        })
        .filter(
            (video): video is CreatorSourceReference => video !== null
        );
}

export function youtubePublishedAfter(now = Date.now()): string {
    const cutoff = new Date(now);
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - 14);
    return cutoff.toISOString();
}

export async function fetchIndiaTrends(
    fetcher: Fetcher = fetch
): Promise<IndiaTrendSignal[]> {
    const response = await fetcher(GOOGLE_TRENDS_INDIA_RSS_URL, {
        headers: {
            Accept: 'application/rss+xml, application/xml;q=0.9',
            'User-Agent': 'MemeHub/1.0 trend-discovery',
        },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
        throw new Error(`India Trends request failed (${response.status})`);
    }
    return parseGoogleTrendsRss(await response.text());
}

export async function searchWikimediaImages(
    query: string,
    fetcher: Fetcher = fetch
): Promise<ReusableImageAsset[]> {
    const url = new URL(WIKIMEDIA_COMMONS_API_URL);
    url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        generator: 'search',
        gsrnamespace: '6',
        gsrlimit: '18',
        gsrsearch: query,
        iiprop: 'url|mime|size|extmetadata',
        iiurlwidth: '1200',
        origin: '*',
        prop: 'imageinfo',
    }).toString();

    const response = await fetcher(url, {
        headers: {
            Accept: 'application/json',
            'User-Agent': 'MemeHub/1.0 creator-discovery',
        },
        next: { revalidate: 3_600 },
        signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
        throw new Error(`Wikimedia request failed (${response.status})`);
    }
    return mapWikimediaImages((await response.json()) as WikimediaResponse);
}

export async function searchYouTubeVideos(
    apiKey: string,
    query: string,
    fetcher: Fetcher = fetch
): Promise<CreatorSourceReference[]> {
    const url = new URL(YOUTUBE_SEARCH_API_URL);
    url.search = new URLSearchParams({
        part: 'snippet',
        q: query,
        key: apiKey,
        maxResults: '8',
        order: 'viewCount',
        publishedAfter: youtubePublishedAfter(),
        regionCode: 'IN',
        safeSearch: 'moderate',
        type: 'video',
        videoEmbeddable: 'true',
    }).toString();

    const response = await fetcher(url, {
        headers: { Accept: 'application/json' },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
        throw new Error(`YouTube search failed (${response.status})`);
    }
    return mapYouTubeVideos(
        (await response.json()) as YouTubeSearchResponse
    );
}
