import { extractSearchWords } from './searchText';

const WIKIPEDIA_SEARCH_API_URL = 'https://en.wikipedia.org/w/api.php';
const MAX_SUGGESTION_LENGTH = 120;
const MAX_ENTITY_SUGGESTION_TOKENS = 3;

type WikipediaSuggestionResponse = {
    query?: {
        searchinfo?: {
            suggestion?: unknown;
        };
    };
};

function normalizeSearchText(value: string): string {
    return value.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function safeSuggestion(
    query: string,
    suggestion: unknown
): string | undefined {
    if (typeof suggestion !== 'string') return undefined;
    const normalized = normalizeSearchText(suggestion);
    if (
        !normalized ||
        normalized.length > MAX_SUGGESTION_LENGTH ||
        !/[\p{L}\p{N}]/u.test(normalized) ||
        /^(?:data|javascript|vbscript)\s*:/i.test(normalized) ||
        normalized.toLocaleLowerCase('en') ===
            normalizeSearchText(query).toLocaleLowerCase('en')
    ) {
        return undefined;
    }
    return normalized;
}

export async function findWikipediaSearchSuggestion(
    query: string,
    fetcher: typeof fetch = fetch
): Promise<string | undefined> {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return undefined;
    const queryTokens = extractSearchWords(normalizedQuery);
    if (queryTokens.length > MAX_ENTITY_SUGGESTION_TOKENS) {
        return undefined;
    }

    const url = new URL(WIKIPEDIA_SEARCH_API_URL);
    url.search = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        origin: '*',
        srinfo: 'suggestion',
        srlimit: '1',
        srsearch: normalizedQuery,
    }).toString();

    try {
        const response = await fetcher(url, {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'MemeHub/1.0 creator-discovery',
            },
            next: { revalidate: 86_400 },
            signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) return undefined;
        const payload =
            (await response.json()) as WikipediaSuggestionResponse;
        return safeSuggestion(
            normalizedQuery,
            payload.query?.searchinfo?.suggestion
        );
    } catch {
        return undefined;
    }
}
