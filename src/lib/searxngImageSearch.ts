import { createHmac } from 'node:crypto';
import { extractSearchWords } from './searchText';
import type {
    WebImageSearchResult,
    WebSearchCandidate,
} from './webImageSearch';

const SEARXNG_SEARCH_TIMEOUT_MS = 12_000;
const MAX_SOURCE_URL_LENGTH = 1_000;

type UnknownRecord = Record<string, unknown>;

export type SearxngImageSearchFetcher = (
    input: RequestInfo | URL,
    init?: RequestInit
) => Promise<Response>;

export type SearxngImageSearchOptions = {
    baseUrl: string;
    /** Server-only SearXNG secret used to sign image-proxy URLs. */
    proxySecret?: string;
    timeRange?: 'day' | 'month' | 'year';
    fetcher?: SearxngImageSearchFetcher;
};

function asRecord(value: unknown): UnknownRecord | undefined {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as UnknownRecord
        : undefined;
}

function readString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseBaseUrl(value: string): URL {
    const baseUrl = new URL(value.trim());
    if (
        (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') ||
        baseUrl.username ||
        baseUrl.password ||
        baseUrl.search ||
        baseUrl.hash
    ) {
        throw new Error('SEARXNG_URL must be a plain HTTP(S) origin or path.');
    }
    return new URL(`${baseUrl.pathname.replace(/\/+$/, '')}/`, baseUrl);
}

function safeSourceUrl(value: unknown):
    | { sourceUrl: string; sourceDomain: string }
    | undefined {
    const sourceUrl = readString(value);
    if (!sourceUrl || sourceUrl.length > MAX_SOURCE_URL_LENGTH) return undefined;

    try {
        const parsed = new URL(sourceUrl);
        if (
            (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
            !parsed.hostname ||
            parsed.username ||
            parsed.password
        ) {
            return undefined;
        }
        return { sourceUrl, sourceDomain: parsed.hostname.toLowerCase() };
    } catch {
        return undefined;
    }
}

function trustedProxyUrl(
    value: unknown,
    baseUrl: URL,
    proxySecret: string | undefined
): string | undefined {
    const previewUrl = readString(value);
    const secret = proxySecret?.trim();
    if (!previewUrl || !secret) return undefined;

    try {
        const parsed = new URL(previewUrl);
        const expectedProxyUrl = new URL('image_proxy', baseUrl);
        const sourceUrl =
            parsed.origin === baseUrl.origin &&
            parsed.pathname === expectedProxyUrl.pathname
                ? parsed.searchParams.get('url')
                : parsed.toString();
        if (!sourceUrl) return undefined;
        const source = new URL(sourceUrl);
        if (
            (source.protocol !== 'http:' && source.protocol !== 'https:') ||
            !source.hostname ||
            source.username ||
            source.password ||
            sourceUrl.length > MAX_SOURCE_URL_LENGTH
        ) {
            return undefined;
        }
        const normalizedSourceUrl = source.toString();
        expectedProxyUrl.searchParams.set('url', normalizedSourceUrl);
        expectedProxyUrl.searchParams.set(
            'h',
            createHmac('sha256', secret)
                .update(normalizedSourceUrl)
                .digest('hex')
        );
        return expectedProxyUrl.toString();
    } catch {
        return undefined;
    }
}

function dimensions(value: unknown): { width: number; height: number } {
    const resolution = readString(value)?.match(/(\d+)\s*[x×]\s*(\d+)/i);
    const width = Number(resolution?.[1]);
    const height = Number(resolution?.[2]);
    return {
        width: Number.isSafeInteger(width) && width > 0 ? width : 500,
        height: Number.isSafeInteger(height) && height > 0 ? height : 281,
    };
}

function stableId(value: string): string {
    let hash = 2_166_136_261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return `searxng-${(hash >>> 0).toString(36)}`;
}

function isRelevantCandidate(
    query: string,
    candidate: Pick<WebSearchCandidate, 'title' | 'sourceDomain' | 'sourceUrl'>
): boolean {
    const queryTokens = extractSearchWords(query.toLocaleLowerCase()).filter(
        (token) => token.length > 1
    );
    if (queryTokens.length === 0) return true;

    const title = candidate.title.toLocaleLowerCase();
    const domain = candidate.sourceDomain.toLocaleLowerCase();
    const sourceUrl = candidate.sourceUrl.toLocaleLowerCase();
    const combined = `${title} ${domain} ${sourceUrl}`;
    const matches = queryTokens.filter((token) => combined.includes(token));

    return matches.length > 0;
}

function mapCandidate(
    query: string,
    value: unknown,
    baseUrl: URL,
    proxySecret: string | undefined
): WebSearchCandidate | undefined {
    const result = asRecord(value);
    const source = safeSourceUrl(result?.url);
    const previewUrl = trustedProxyUrl(
        result?.thumbnail_src ?? result?.thumbnail,
        baseUrl,
        proxySecret
    );
    if (!result || !source || !previewUrl) return undefined;
    const assetUrl =
        trustedProxyUrl(result.img_src, baseUrl, proxySecret) ?? previewUrl;

    if (
        !isRelevantCandidate(query, {
            title: readString(result.title) ?? '',
            sourceDomain: source.sourceDomain,
            sourceUrl: source.sourceUrl,
        })
    ) {
        return undefined;
    }

    const publishedAt = readString(result.publishedDate ?? result.published_date);
    const { width, height } = dimensions(result.resolution);
    return {
        id: stableId(`${source.sourceUrl}\u0000${previewUrl}`),
        title: readString(result.title) ?? 'Untitled search image',
        assetUrl,
        previewUrl,
        sourceUrl: source.sourceUrl,
        sourceDomain: source.sourceDomain,
        width,
        height,
        kind: 'web',
        ...(publishedAt && Number.isFinite(Date.parse(publishedAt))
            ? { publishedAt: new Date(publishedAt).toISOString() }
            : {}),
    };
}

export async function searchSearxngImages(
    query: string,
    options: SearxngImageSearchOptions
): Promise<WebImageSearchResult> {
    const baseUrl = parseBaseUrl(options.baseUrl);
    const url = new URL('search', baseUrl);
    url.search = new URLSearchParams({
        q: query.trim(),
        categories: 'images',
        language: 'en',
        ...(options.timeRange ? { time_range: options.timeRange } : {}),
        format: 'json',
        safesearch: '2',
    }).toString();

    const response = await (options.fetcher ?? fetch)(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(SEARXNG_SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`SearXNG image search request failed (${response.status})`);
    }

    const payload = asRecord(await response.json());
    const results = Array.isArray(payload?.results) ? payload.results : [];
    return {
        candidates: results
            .map((result) =>
                mapCandidate(query, result, baseUrl, options.proxySecret)
            )
            .filter(
                (candidate): candidate is WebSearchCandidate =>
                    candidate !== undefined
            ),
        degradedEndpoints: [],
    };
}
