import { NextRequest, NextResponse } from 'next/server';
import {
    type WebImageSearchResult,
    type WebSearchCandidate,
} from '@/lib/webImageSearch';
import { searchSearxngImages } from '@/lib/searxngImageSearch';
import { consumeDiscoverySearchRateLimit } from '@/lib/discoveryRateLimit';
import { searchWikimediaImages } from '@/lib/indiaTrendSources';
import {
    buildMemeSearchPlan,
    isMemeSearchIntent,
    type MemeSearchIntent,
    type MemeSearchPlan,
} from '@/lib/memeSearchPlanner';
import { findWikipediaSearchSuggestion } from '@/lib/searchSuggestions';
import {
    countSearchWords,
    extractSearchWords,
} from '@/lib/searchText';
import type {
    CreatorDiscoveryResponse,
    DiscoveryProviderState,
    ReusableImageAsset,
    WebImageAsset,
} from '@/types/creatorDiscovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_SECONDS = 600;
const MAX_QUERY_LENGTH = 120;
const MAX_QUERY_WORDS = 50;
const MAX_WEB_RESULTS = 24;
const MAX_REUSABLE_RESULTS = 18;
const MIN_WEB_RESULTS_BEFORE_FOLLOWUP = 8;
const MIN_REUSABLE_RESULTS = 6;
const MAX_COMMONS_QUERY_ATTEMPTS = 4;

function readQuery(request: NextRequest): string {
    return (request.nextUrl.searchParams.get('q') ?? '')
        .normalize('NFKC')
        .replace(/\s+/g, ' ')
        .trim();
}

function readIntent(request: NextRequest): MemeSearchIntent | undefined {
    const value = request.nextUrl.searchParams.get('intent') ?? 'moment';
    return isMemeSearchIntent(value) ? value : undefined;
}

function safeCorrection(value: string | undefined): string | undefined {
    if (!value) return undefined;

    const correction = value.normalize('NFKC').replace(/\s+/g, ' ').trim();
    return correction.length <= MAX_QUERY_LENGTH &&
        countSearchWords(correction) <= MAX_QUERY_WORDS &&
        /[\p{L}\p{N}]/u.test(correction)
        ? correction
        : undefined;
}

function toWebImageAsset(
    candidate: WebSearchCandidate,
    provider: WebImageAsset['provider']
): WebImageAsset {
    const relayUrl = (url: string) =>
        `/api/creator-discovery/image?${new URLSearchParams({ url }).toString()}`;
    const previewUrl = provider === 'SearXNG'
        ? relayUrl(candidate.previewUrl)
        : candidate.previewUrl;
    const assetUrl = provider === 'SearXNG'
        ? relayUrl(candidate.assetUrl)
        : candidate.assetUrl;
    return {
        id: candidate.id,
        title: candidate.title,
        previewUrl,
        assetUrl,
        sourceUrl: candidate.sourceUrl,
        sourceDomain: candidate.sourceDomain,
        width: candidate.width,
        height: candidate.height,
        provider,
        kind: candidate.kind,
        ...(candidate.publishedAt
            ? { publishedAt: candidate.publishedAt }
            : {}),
        ...(candidate.confidence
            ? { confidence: candidate.confidence }
            : {}),
        rights: 'unknown',
    };
}

type ReusableSearchResult = {
    images: ReusableImageAsset[];
    state: DiscoveryProviderState;
    usedCorrection: boolean;
    attemptedQueries: string[];
};

type ReusableSearchOptions = {
    maxAttempts?: number;
    excludedQueries?: ReadonlySet<string>;
};

function appendUniqueReusableImages(
    target: ReusableImageAsset[],
    candidates: ReusableImageAsset[]
): void {
    const knownIds = new Set(target.map(({ id }) => id));
    for (const candidate of candidates) {
        if (knownIds.has(candidate.id)) continue;
        knownIds.add(candidate.id);
        target.push(candidate);
        if (target.length === MAX_REUSABLE_RESULTS) return;
    }
}

function rankReusableImages(
    images: ReusableImageAsset[],
    query: string
): ReusableImageAsset[] {
    const normalizedQuery = query.toLocaleLowerCase();
    const queryTokens = extractSearchWords(normalizedQuery).filter(
        (token) => token.length > 1
    );

    return images
        .map((image, index) => {
            const title = image.title.toLocaleLowerCase();
            const tokenMatches = queryTokens.reduce(
                (score, token) =>
                    score + (title.includes(token) ? 1 : 0),
                0
            );
            return {
                image,
                index,
                score:
                    tokenMatches +
                    (title.includes(normalizedQuery) ? 4 : 0),
            };
        })
        .sort(
            (left, right) =>
                right.score - left.score || left.index - right.index
        )
        .map(({ image }) => image);
}

async function searchReusableImages(
    originalPlan: MemeSearchPlan,
    resolvedPlan: MemeSearchPlan,
    options: ReusableSearchOptions = {}
): Promise<ReusableSearchResult> {
    const images: ReusableImageAsset[] = [];
    const attemptedQueries: string[] = [];
    const originalKeys = new Set(
        originalPlan.reusableCandidates.map((candidate) =>
            candidate.toLocaleLowerCase()
        )
    );
    const correctedCandidates =
        originalPlan.resolvedQuery.toLocaleLowerCase() ===
        resolvedPlan.resolvedQuery.toLocaleLowerCase()
            ? []
            : resolvedPlan.reusableCandidates.filter(
                  (candidate) =>
                      !originalKeys.has(candidate.toLocaleLowerCase())
              );
    let successfulRequests = 0;
    let attempts = 0;
    let providerFailed = false;
    let usedCorrection = false;
    const maxAttempts = Math.max(
        0,
        Math.min(
            options.maxAttempts ?? MAX_COMMONS_QUERY_ATTEMPTS,
            MAX_COMMONS_QUERY_ATTEMPTS
        )
    );
    const excludedQueries = options.excludedQueries ?? new Set<string>();

    const searchPhase = async (
        candidates: string[],
        correctionPhase: boolean
    ) => {
        for (const candidate of candidates) {
            if (
                attempts >= maxAttempts ||
                images.length >= MIN_REUSABLE_RESULTS
            ) {
                break;
            }

            const candidateKey = candidate.toLocaleLowerCase();
            if (excludedQueries.has(candidateKey)) continue;

            attempts += 1;
            attemptedQueries.push(candidate);
            try {
                const result = await searchWikimediaImages(candidate);
                successfulRequests += 1;
                const previousCount = images.length;
                appendUniqueReusableImages(images, result);
                if (correctionPhase && images.length > previousCount) {
                    usedCorrection = true;
                }
            } catch {
                // Repeating the same unavailable provider can multiply a
                // timeout, so stop after the first transport failure.
                providerFailed = true;
                break;
            }
        }
    };

    await searchPhase(originalPlan.reusableCandidates, false);
    if (
        images.length === 0 &&
        !providerFailed &&
        correctedCandidates.length > 0
    ) {
        await searchPhase(correctedCandidates, true);
    }

    return {
        images: rankReusableImages(
            images,
            originalPlan.resolvedQuery
        ),
        state:
            successfulRequests === 0 && providerFailed
                ? 'unavailable'
                : providerFailed
                  ? 'degraded'
                  : 'live',
        usedCorrection,
        attemptedQueries,
    };
}

function mergeWebCandidates(
    ...groups: WebSearchCandidate[][]
): WebSearchCandidate[] {
    const candidates: WebSearchCandidate[] = [];
    const previewUrls = new Set<string>();
    const sourceUrls = new Set<string>();

    for (const group of groups) {
        for (const candidate of group) {
            if (
                previewUrls.has(candidate.previewUrl) ||
                sourceUrls.has(candidate.sourceUrl)
            ) {
                continue;
            }
            previewUrls.add(candidate.previewUrl);
            sourceUrls.add(candidate.sourceUrl);
            candidates.push(candidate);
            if (candidates.length === MAX_WEB_RESULTS) return candidates;
        }
    }

    return candidates;
}

function emptyPayload(
    query: string,
    resolvedQuery: string,
    intent: MemeSearchIntent,
    providers: CreatorDiscoveryResponse['providers']
): CreatorDiscoveryResponse {
    return {
        fetchedAt: new Date().toISOString(),
        query,
        resolvedQuery,
        intent,
        region: 'IN',
        trends: [],
        webImages: [],
        reusableImages: [],
        videos: [],
        providers,
    };
}

export async function GET(request: NextRequest) {
    const query = readQuery(request);
    const intent = readIntent(request);

    if (!intent) {
        return NextResponse.json(
            { error: 'Choose a supported meme material type.' },
            {
                status: 400,
                headers: { 'Cache-Control': 'private, no-store' },
            }
        );
    }
    if (query.length > MAX_QUERY_LENGTH) {
        return NextResponse.json(
            { error: 'Searches must be 120 characters or fewer.' },
            {
                status: 400,
                headers: { 'Cache-Control': 'private, no-store' },
            }
        );
    }
    if (countSearchWords(query) > MAX_QUERY_WORDS) {
        return NextResponse.json(
            { error: 'Searches must use 50 words or fewer.' },
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

    if (!query) {
        return NextResponse.json(
            emptyPayload('', '', intent, {
                web: 'idle',
                commons: 'idle',
            }),
            {
                headers: {
                    'Cache-Control': `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
                },
            }
        );
    }

    const rateLimit = await consumeDiscoverySearchRateLimit(request).catch(
        () => ({
            allowed: false as const,
            reason: 'unavailable' as const,
            retryAfterSeconds: 60,
        })
    );
    if (!rateLimit.allowed) {
        const temporarilyUnavailable = rateLimit.reason === 'unavailable';
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

    const initialPlan = buildMemeSearchPlan(query, intent);
    const searxngUrl = process.env.SEARXNG_URL?.trim();
    const webProvider = searxngUrl ? 'searxng' : undefined;
    const searchWebImages = (candidate: string) => {
        return searchSearxngImages(candidate, {
            baseUrl: searxngUrl!,
            proxySecret: process.env.SEARXNG_SECRET,
            intent,
            timeRange: intent === 'moment' || intent === 'social'
                ? 'day'
                : 'month',
        });
    };
    const primaryWebQuery = initialPlan.providerQueries[0];
    const webPromise: Promise<WebImageSearchResult> | undefined =
        webProvider && initialPlan.providerQueries[0]
            ? searchWebImages(primaryWebQuery)
            : undefined;
    const originalReusablePromise = searchReusableImages(
        initialPlan,
        initialPlan
    );

    const [suggestionResult, webResult, originalReusableResult] =
        await Promise.allSettled([
            findWikipediaSearchSuggestion(query),
            webPromise ??
                Promise.resolve<WebImageSearchResult | undefined>(
                    undefined
                ),
            originalReusablePromise,
        ]);

    const primaryWebSearch =
        webResult.status === 'fulfilled' ? webResult.value : undefined;
    const suggestion =
        suggestionResult.status === 'fulfilled'
            ? suggestionResult.value
            : undefined;
    const correction = safeCorrection(suggestion);
    const resolvedPlan = buildMemeSearchPlan(query, intent, correction);
    const originalReusable =
        originalReusableResult.status === 'fulfilled'
            ? originalReusableResult.value
            : {
                  images: [],
                  state: 'unavailable' as const,
                  usedCorrection: false,
                  attemptedQueries: [],
              };
    const remainingReusableAttempts =
        MAX_COMMONS_QUERY_ATTEMPTS -
        originalReusable.attemptedQueries.length;
    const originalReusableQueryKeys = new Set(
        originalReusable.attemptedQueries.map((candidate) =>
            candidate.toLocaleLowerCase()
        )
    );
    const correctedReusablePromise =
        originalReusable.images.length === 0 &&
        originalReusable.state === 'live' &&
        (primaryWebSearch?.candidates.length ?? 0) === 0 &&
        remainingReusableAttempts > 0 &&
        correction &&
        resolvedPlan.resolvedQuery.toLocaleLowerCase() !==
            initialPlan.resolvedQuery.toLocaleLowerCase()
            ? searchReusableImages(resolvedPlan, resolvedPlan, {
                  maxAttempts: remainingReusableAttempts,
                  excludedQueries: originalReusableQueryKeys,
              })
            : undefined;
    let successfulWebSearches =
        primaryWebSearch === undefined ? 0 : 1;
    let failedWebSearches =
        webProvider && webResult.status === 'rejected' ? 1 : 0;
    let webDegraded =
        (primaryWebSearch?.degradedEndpoints?.length ?? 0) > 0;
    let webCandidates = mergeWebCandidates(
        primaryWebSearch?.candidates ?? []
    );
    let webUsedCorrection = false;

    if (
        webProvider &&
        primaryWebQuery &&
        primaryWebSearch !== undefined &&
        !webDegraded &&
        webCandidates.length < MIN_WEB_RESULTS_BEFORE_FOLLOWUP
    ) {
        const primaryKey = primaryWebQuery.toLocaleLowerCase();
        const followupPlan =
            webCandidates.length === 0
                ? resolvedPlan
                : initialPlan;
        const followupQuery = followupPlan.providerQueries.find(
            (candidate) => candidate.toLocaleLowerCase() !== primaryKey
        );

        if (followupQuery) {
            try {
                const followup = await searchWebImages(followupQuery);
                successfulWebSearches += 1;
                webDegraded =
                    webDegraded ||
                    (followup.degradedEndpoints?.length ?? 0) > 0;
                const previousCount = webCandidates.length;
                webCandidates = mergeWebCandidates(
                    webCandidates,
                    followup.candidates
                );
                if (
                    correction &&
                    followupQuery
                        .toLocaleLowerCase()
                        .includes(
                            resolvedPlan.resolvedQuery.toLocaleLowerCase()
                        ) &&
                    webCandidates.length > previousCount
                ) {
                    webUsedCorrection = true;
                }
            } catch {
                failedWebSearches += 1;
            }
        }
    }

    let reusableResult = originalReusable;
    if (correctedReusablePromise) {
        const correctedReusable = await correctedReusablePromise;
        reusableResult = {
            images: rankReusableImages(
                correctedReusable.images,
                initialPlan.resolvedQuery
            ),
            state:
                correctedReusable.state === 'live'
                    ? originalReusable.state
                    : 'degraded',
            usedCorrection: correctedReusable.images.length > 0,
            attemptedQueries: [
                ...originalReusable.attemptedQueries,
                ...correctedReusable.attemptedQueries,
            ],
        };
    }
    const webState: DiscoveryProviderState = !webProvider
        ? 'not-configured'
        : successfulWebSearches === 0
          ? 'unavailable'
          : webDegraded || failedWebSearches > 0
            ? 'degraded'
            : 'live';
    const correctionWasUsed =
        Boolean(correction) &&
        (webUsedCorrection || reusableResult.usedCorrection);
    const responseResolvedQuery = correctionWasUsed
        ? resolvedPlan.resolvedQuery
        : initialPlan.resolvedQuery;
    const payload: CreatorDiscoveryResponse = {
        ...emptyPayload(query, responseResolvedQuery, intent, {
            web: webState,
            commons: reusableResult.state,
        }),
        webImages: webCandidates.map((candidate) =>
            toWebImageAsset(candidate, 'SearXNG')
        ),
        reusableImages: reusableResult.images,
    };
    const degraded =
        payload.providers.web === 'unavailable' ||
        payload.providers.web === 'degraded' ||
        payload.providers.commons === 'unavailable' ||
        payload.providers.commons === 'degraded';

    return NextResponse.json(payload, {
        headers: {
            'Cache-Control': degraded
                ? 'private, no-store'
                : `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
        },
    });
}
