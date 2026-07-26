import {
    countSearchWords,
    truncateSearchWords,
} from './searchText';

export type MemeSearchIntent =
    | 'moment'
    | 'reaction'
    | 'cutout'
    | 'template'
    | 'social';

export interface MemeSearchPlan {
    originalQuery: string;
    resolvedQuery: string;
    intent: MemeSearchIntent;
    providerQueries: string[];
    reusableCandidates: string[];
}

const MEME_SEARCH_INTENTS: readonly MemeSearchIntent[] = [
    'moment',
    'reaction',
    'cutout',
    'template',
    'social',
];

const REUSABLE_FILLER_WORDS = new Set([
    'breaking',
    'current',
    'fresh',
    'latest',
    'meme',
    'memes',
    'new',
    'recent',
    'today',
    'trending',
    'viral',
]);

const MAX_QUERY_CANDIDATES = 6;
const MAX_PROVIDER_QUERY_WORDS = 50;

export function isMemeSearchIntent(
    value: unknown
): value is MemeSearchIntent {
    return (
        typeof value === 'string' &&
        MEME_SEARCH_INTENTS.includes(value as MemeSearchIntent)
    );
}

export function buildMemeSearchPlan(
    query: string,
    intent: MemeSearchIntent,
    correctedQuery?: string
): MemeSearchPlan {
    if (!isMemeSearchIntent(intent)) {
        throw new Error(`Unsupported meme search intent: ${String(intent)}`);
    }

    const normalizedQuery = normalizeSearchText(query);
    const normalizedCorrection = normalizeSearchText(correctedQuery ?? '');
    const resolvedQuery = normalizedCorrection || normalizedQuery;

    return {
        originalQuery: query,
        resolvedQuery,
        intent,
        providerQueries: buildProviderQueries(resolvedQuery, intent),
        reusableCandidates: buildReusableCandidates(resolvedQuery),
    };
}

function normalizeSearchText(value: string): string {
    return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function compactUnique(candidates: string[]): string[] {
    const uniqueCandidates: string[] = [];
    const seen = new Set<string>();

    for (const candidate of candidates) {
        const normalizedCandidate = normalizeSearchText(candidate);
        const key = normalizedCandidate.toLowerCase();

        if (!normalizedCandidate || seen.has(key)) {
            continue;
        }

        seen.add(key);
        uniqueCandidates.push(normalizedCandidate);

        if (uniqueCandidates.length === MAX_QUERY_CANDIDATES) {
            break;
        }
    }

    return uniqueCandidates;
}

function buildProviderQueries(
    baseQuery: string,
    intent: MemeSearchIntent
): string[] {
    if (!baseQuery) {
        return [];
    }

    switch (intent) {
        case 'moment':
            return compactUnique([
                boundProviderQuery(baseQuery),
                appendProviderContext(baseQuery, 'current event'),
                appendProviderContext(baseQuery, 'latest news photo'),
                appendProviderContext(baseQuery, 'press photo'),
            ]);
        case 'reaction':
            return compactUnique([
                appendProviderContext(baseQuery, 'reaction image'),
                appendProviderContext(baseQuery, 'facial expression'),
                appendProviderContext(baseQuery, 'reaction'),
                boundProviderQuery(baseQuery),
            ]);
        case 'cutout':
            return compactUnique([
                appendProviderContext(baseQuery, 'transparent PNG'),
                appendProviderContext(baseQuery, 'cutout'),
                appendProviderContext(
                    baseQuery,
                    'isolated transparent background'
                ),
                boundProviderQuery(baseQuery),
            ]);
        case 'template':
            return compactUnique([
                appendProviderContext(baseQuery, 'blank meme template'),
                appendProviderContext(baseQuery, 'meme template no text'),
                appendProviderContext(baseQuery, 'blank template'),
                boundProviderQuery(baseQuery),
            ]);
        case 'social':
            return compactUnique([
                appendProviderContext(
                    baseQuery,
                    '(site:reddit.com OR site:x.com OR site:instagram.com)'
                ),
                prependProviderContext('site:reddit.com', baseQuery),
                prependProviderContext('site:x.com', baseQuery),
                prependProviderContext('site:instagram.com', baseQuery),
                boundProviderQuery(baseQuery),
            ]);
    }
}

function boundProviderQuery(query: string): string {
    return truncateSearchWords(query, MAX_PROVIDER_QUERY_WORDS);
}

function appendProviderContext(
    baseQuery: string,
    context: string
): string {
    const availableBaseWords = Math.max(
        0,
        MAX_PROVIDER_QUERY_WORDS - countSearchWords(context)
    );
    return normalizeSearchText(
        `${truncateSearchWords(
            baseQuery,
            availableBaseWords
        )} ${context}`
    );
}

function prependProviderContext(
    context: string,
    baseQuery: string
): string {
    const availableBaseWords = Math.max(
        0,
        MAX_PROVIDER_QUERY_WORDS - countSearchWords(context)
    );
    return normalizeSearchText(
        `${context} ${truncateSearchWords(
            baseQuery,
            availableBaseWords
        )}`
    );
}

function buildReusableCandidates(baseQuery: string): string[] {
    const reusableTokens = baseQuery
        .split(' ')
        .filter((token) => !isReusableFillerWord(token));

    if (reusableTokens.length <= 1) {
        return compactUnique(
            reusableTokens.length === 0 ? [] : [reusableTokens[0]]
        );
    }

    const candidates: string[] = [];
    for (
        let length = reusableTokens.length;
        length >= 2 && candidates.length < MAX_QUERY_CANDIDATES - 1;
        length -= 1
    ) {
        candidates.push(reusableTokens.slice(0, length).join(' '));
    }

    candidates.push(reusableTokens.slice(0, 2).join(' '));
    return compactUnique(candidates);
}

function isReusableFillerWord(token: string): boolean {
    const comparableToken = token
        .replace(
            /^[^\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+$/gu,
            ''
        )
        .toLowerCase();

    return REUSABLE_FILLER_WORDS.has(comparableToken);
}
