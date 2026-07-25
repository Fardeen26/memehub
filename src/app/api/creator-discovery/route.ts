import { NextRequest, NextResponse } from 'next/server';
import {
    fetchIndiaTrends,
    searchWikimediaImages,
} from '@/lib/indiaTrendSources';
import { consumeDiscoverySearchRateLimit } from '@/lib/discoveryRateLimit';
import type {
    CreatorDiscoveryResponse,
    DiscoveryProviderState,
    IndiaTrendSignal,
    ReusableImageAsset,
} from '@/types/creatorDiscovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_SECONDS = 600;
const MAX_QUERY_LENGTH = 120;
const MIN_STRONG_IMAGE_RESULTS = 6;
const SEARCH_FILLER_WORDS = new Set([
    'clip',
    'clips',
    'image',
    'images',
    'latest',
    'meme',
    'memes',
    'photo',
    'photos',
    'pic',
    'pics',
    'reel',
    'reels',
    'trend',
    'trending',
    'video',
    'videos',
    'viral',
    'तस्वीर',
    'तस्वीरें',
    'फोटो',
    'मीम',
    'रील',
    'वीडियो',
    'वायरल',
]);

function readQuery(request: NextRequest): string {
    return (request.nextUrl.searchParams.get('q') ?? '')
        .replace(/\s+/g, ' ')
        .trim();
}

function subjectOnlyQuery(query: string): string {
    return query
        .split(/\s+/)
        .filter(
            (word) =>
                !SEARCH_FILLER_WORDS.has(
                    word
                        .normalize('NFKC')
                        .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
                        .toLocaleLowerCase('en-IN')
                )
        )
        .join(' ')
        .trim();
}

async function searchReusableImages(
    query: string
): Promise<ReusableImageAsset[]> {
    const subjectQuery = subjectOnlyQuery(query);
    let exactImages: ReusableImageAsset[] = [];
    let exactError: unknown;

    try {
        exactImages = await searchWikimediaImages(query);
    } catch (error) {
        exactError = error;
    }

    if (
        !subjectQuery ||
        subjectQuery.toLocaleLowerCase('en-IN') ===
            query.toLocaleLowerCase('en-IN') ||
        exactImages.length >= MIN_STRONG_IMAGE_RESULTS
    ) {
        if (exactError) throw exactError;
        return exactImages;
    }

    let subjectImages: ReusableImageAsset[] = [];
    try {
        subjectImages = await searchWikimediaImages(subjectQuery);
    } catch (error) {
        if (exactError) throw error;
    }

    const seenAssets = new Set<string>();
    return [...exactImages, ...subjectImages].filter((asset) => {
        const key = `${asset.id}:${asset.assetUrl}`;
        if (seenAssets.has(key)) return false;
        seenAssets.add(key);
        return true;
    });
}

export async function GET(request: NextRequest) {
    const query = readQuery(request);
    if (query.length > MAX_QUERY_LENGTH) {
        return NextResponse.json(
            { error: 'Searches must be 120 characters or fewer.' },
            {
                status: 400,
                headers: { 'Cache-Control': 'private, no-store' },
            }
        );
    }
    if (
        request.nextUrl.searchParams.has('q') &&
        !/[\p{L}\p{N}]/u.test(query)
    ) {
        return NextResponse.json(
            { error: 'Search for a person, event, phrase, or topic.' },
            {
                status: 400,
                headers: { 'Cache-Control': 'private, no-store' },
            }
        );
    }

    if (query) {
        const rateLimit = await consumeDiscoverySearchRateLimit(request).catch(
            () => ({
                allowed: false as const,
                reason: 'unavailable' as const,
                retryAfterSeconds: 60,
            })
        );
        if (!rateLimit.allowed) {
            const temporarilyUnavailable =
                rateLimit.reason === 'unavailable';
            return NextResponse.json(
                {
                    error: temporarilyUnavailable
                        ? 'Live discovery search is temporarily unavailable.'
                        : 'Too many discovery searches. Try again shortly.',
                },
                {
                    status: temporarilyUnavailable ? 503 : 429,
                    headers: {
                        'Cache-Control': 'private, no-store',
                        'Retry-After': String(rateLimit.retryAfterSeconds),
                    },
                }
            );
        }
    }

    const trendPromise = query
        ? Promise.resolve<IndiaTrendSignal[]>([])
        : fetchIndiaTrends();
    const commonsPromise = query
        ? searchReusableImages(query)
        : Promise.resolve<ReusableImageAsset[]>([]);

    const [trendResult, commonsResult] = await Promise.allSettled([
        trendPromise,
        commonsPromise,
    ]);

    const allTrends: IndiaTrendSignal[] =
        trendResult.status === 'fulfilled' ? trendResult.value : [];
    const matchedTrends = query ? [] : allTrends.slice(0, 12);
    const trends = matchedTrends.map((trend) => ({
        id: trend.id,
        title: trend.title,
        approximateTraffic: trend.approximateTraffic,
        trafficLabel: trend.trafficLabel,
        publishedAt: trend.publishedAt,
        sources: [],
    }));
    const reusableImages =
        commonsResult.status === 'fulfilled'
            ? commonsResult.value.slice(0, 18)
            : [];

    const commonsState: DiscoveryProviderState = !query
        ? 'idle'
        : commonsResult.status === 'fulfilled'
          ? 'live'
          : 'unavailable';

    const payload: CreatorDiscoveryResponse = {
        fetchedAt: new Date().toISOString(),
        query,
        region: 'IN',
        trends,
        reusableImages,
        videos: [],
        providers: {
            trends:
                query
                    ? 'idle'
                    : trendResult.status === 'fulfilled'
                      ? 'live'
                      : 'unavailable',
            commons: commonsState,
            youtube: 'not-configured',
        },
    };
    const degraded =
        (!query && payload.providers.trends === 'unavailable') ||
        (Boolean(query) && payload.providers.commons === 'unavailable');

    return NextResponse.json(payload, {
        headers: {
            'Cache-Control': degraded
                ? 'private, no-store'
                : `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
        },
    });
}
