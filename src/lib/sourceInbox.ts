import type { ReusableImageRights } from '@/types/creatorDiscovery';

export const SOURCE_INBOX_STORAGE_KEY = 'memehub-source-inbox-v1';
export const SOURCE_INBOX_LIMIT = 60;
export const SOURCE_INBOX_MAX_URL_LENGTH = 2048;
export const SOURCE_INBOX_MAX_TITLE_LENGTH = 240;
export const SOURCE_INBOX_MAX_PUBLISHER_LENGTH = 160;
export const SOURCE_INBOX_MAX_CONTEXT_LENGTH = 1000;
export const SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH = 240;
export const SOURCE_INBOX_MAX_NOTICE_LENGTH = 1000;

const SOURCE_INBOX_MAX_ID_LENGTH = 128;
const SOURCE_INBOX_MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const SOURCE_KINDS = new Set<SavedSourceKind>([
    'news',
    'video',
    'social',
    'image',
    'other',
]);
const REUSABLE_IMAGE_RIGHTS = new Set<ReusableImageRights>([
    'editable',
    'attribution',
    'share-alike',
]);

export type SavedSourceKind = 'news' | 'video' | 'social' | 'image' | 'other';

export type SavedCreatorSource = {
    id: string;
    title: string;
    url: string;
    publisher: string;
    kind: SavedSourceKind;
    context?: string;
    imageUrl?: string;
    creator?: string;
    creditLine?: string;
    licenseName?: string;
    licenseUrl?: string;
    rights?: ReusableImageRights;
    attributionRequired?: boolean;
    usageTerms?: string;
    restrictions?: string;
    savedAt: number;
};

export type SaveSourceInput = Omit<SavedCreatorSource, 'id' | 'savedAt'>;

function getStorage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

function normalizeSourceUrl(value: string): string {
    if (
        typeof value !== 'string' ||
        value.length > SOURCE_INBOX_MAX_URL_LENGTH
    ) {
        throw new Error('Source links must be 2,048 characters or fewer.');
    }
    let url: URL;
    try {
        url = new URL(value.trim());
    } catch {
        throw new Error('Enter a valid http or https source link.');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Enter a valid http or https source link.');
    }
    url.hash = '';
    const normalized = url.toString();
    if (normalized.length > SOURCE_INBOX_MAX_URL_LENGTH) {
        throw new Error('Source links must be 2,048 characters or fewer.');
    }
    return normalized;
}

function isSavedSourceKind(value: unknown): value is SavedSourceKind {
    return (
        typeof value === 'string' &&
        SOURCE_KINDS.has(value as SavedSourceKind)
    );
}

function isReusableImageRights(
    value: unknown
): value is ReusableImageRights {
    return (
        typeof value === 'string' &&
        REUSABLE_IMAGE_RIGHTS.has(value as ReusableImageRights)
    );
}

function isBoundedString(
    value: unknown,
    maxLength: number,
    allowEmpty = false
): value is string {
    return (
        typeof value === 'string' &&
        value.length <= maxLength &&
        (allowEmpty || value.trim().length > 0)
    );
}

function isHttpUrl(value: unknown): value is string {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > SOURCE_INBOX_MAX_URL_LENGTH
    ) {
        return false;
    }
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function boundText(value: string, maxLength: number): string {
    return value.trim().slice(0, maxLength).trimEnd();
}

function hasValidAttributionSnapshot(
    candidate: Partial<SavedCreatorSource>
): boolean {
    const hasAttribution = [
        candidate.creator,
        candidate.licenseName,
        candidate.licenseUrl,
        candidate.rights,
        candidate.creditLine,
        candidate.attributionRequired,
        candidate.usageTerms,
        candidate.restrictions,
    ].some((field) => field !== undefined);
    if (!hasAttribution) return true;
    return (
        isBoundedString(
            candidate.creator,
            SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH
        ) &&
        isBoundedString(
            candidate.licenseName,
            SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH
        ) &&
        (candidate.licenseUrl === undefined ||
            isHttpUrl(candidate.licenseUrl)) &&
        isReusableImageRights(candidate.rights) &&
        (candidate.creditLine === undefined ||
            isBoundedString(
                candidate.creditLine,
                SOURCE_INBOX_MAX_NOTICE_LENGTH
            )) &&
        (candidate.attributionRequired === undefined ||
            typeof candidate.attributionRequired === 'boolean') &&
        (candidate.usageTerms === undefined ||
            isBoundedString(
                candidate.usageTerms,
                SOURCE_INBOX_MAX_NOTICE_LENGTH
            )) &&
        (candidate.restrictions === undefined ||
            isBoundedString(
                candidate.restrictions,
                SOURCE_INBOX_MAX_NOTICE_LENGTH
            ))
    );
}

function isSavedSource(value: unknown): value is SavedCreatorSource {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<SavedCreatorSource>;
    return (
        isBoundedString(candidate.id, SOURCE_INBOX_MAX_ID_LENGTH) &&
        isBoundedString(candidate.title, SOURCE_INBOX_MAX_TITLE_LENGTH) &&
        isHttpUrl(candidate.url) &&
        isBoundedString(
            candidate.publisher,
            SOURCE_INBOX_MAX_PUBLISHER_LENGTH
        ) &&
        isSavedSourceKind(candidate.kind) &&
        (candidate.context === undefined ||
            isBoundedString(
                candidate.context,
                SOURCE_INBOX_MAX_CONTEXT_LENGTH,
                true
            )) &&
        (candidate.imageUrl === undefined || isHttpUrl(candidate.imageUrl)) &&
        hasValidAttributionSnapshot(candidate) &&
        Number.isSafeInteger(candidate.savedAt) &&
        candidate.savedAt! > 0 &&
        candidate.savedAt! <= Date.now() + SOURCE_INBOX_MAX_FUTURE_SKEW_MS
    );
}

function readSources(): SavedCreatorSource[] {
    const storage = getStorage();
    if (!storage) return [];
    try {
        const parsed = JSON.parse(
            storage.getItem(SOURCE_INBOX_STORAGE_KEY) ?? '[]'
        ) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(isSavedSource);
    } catch {
        return [];
    }
}

function writeSources(sources: SavedCreatorSource[]): void {
    const storage = getStorage();
    if (!storage) {
        throw new Error('Source Inbox needs browser storage.');
    }
    storage.setItem(SOURCE_INBOX_STORAGE_KEY, JSON.stringify(sources));
}

function makeSourceId(url: string): string {
    let hash = 0;
    for (let index = 0; index < url.length; index += 1) {
        hash = Math.imul(31, hash) + url.charCodeAt(index);
    }
    return `source-${(hash >>> 0).toString(36)}`;
}

export function listSavedSources(): SavedCreatorSource[] {
    return readSources().sort(
        (left, right) =>
            right.savedAt - left.savedAt || left.id.localeCompare(right.id)
    );
}

export function saveSource(input: SaveSourceInput): SavedCreatorSource {
    const url = normalizeSourceUrl(input.url);
    if (!isSavedSourceKind(input.kind)) {
        throw new Error('Choose a valid source type.');
    }
    const id = makeSourceId(url);
    const hostname = new URL(url).hostname;
    const title =
        boundText(input.title, SOURCE_INBOX_MAX_TITLE_LENGTH) || hostname;
    const publisher =
        boundText(input.publisher, SOURCE_INBOX_MAX_PUBLISHER_LENGTH) ||
        hostname;
    const context = input.context
        ? boundText(input.context, SOURCE_INBOX_MAX_CONTEXT_LENGTH)
        : undefined;
    const imageUrl = input.imageUrl?.trim()
        ? normalizeSourceUrl(input.imageUrl)
        : undefined;
    const hasAttribution = [
        input.creator,
        input.licenseName,
        input.licenseUrl,
        input.rights,
        input.creditLine,
        input.attributionRequired,
        input.usageTerms,
        input.restrictions,
    ].some((field) => field !== undefined);
    const creator = input.creator
        ? boundText(input.creator, SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH)
        : undefined;
    const licenseName = input.licenseName
        ? boundText(input.licenseName, SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH)
        : undefined;
    const licenseUrl = input.licenseUrl?.trim()
        ? normalizeSourceUrl(input.licenseUrl)
        : undefined;
    const creditLine = input.creditLine
        ? boundText(input.creditLine, SOURCE_INBOX_MAX_NOTICE_LENGTH)
        : undefined;
    const usageTerms = input.usageTerms
        ? boundText(input.usageTerms, SOURCE_INBOX_MAX_NOTICE_LENGTH)
        : undefined;
    const restrictions = input.restrictions
        ? boundText(input.restrictions, SOURCE_INBOX_MAX_NOTICE_LENGTH)
        : undefined;
    if (
        hasAttribution &&
        (!creator || !licenseName || !isReusableImageRights(input.rights))
    ) {
        throw new Error('Reusable image attribution is incomplete.');
    }
    const source: SavedCreatorSource = {
        id,
        title,
        publisher,
        kind: input.kind,
        url,
        savedAt: Date.now(),
        ...(context ? { context } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(hasAttribution
            ? {
                  creator,
                  licenseName,
                  rights: input.rights,
                  ...(licenseUrl ? { licenseUrl } : {}),
                  ...(creditLine ? { creditLine } : {}),
                  ...(input.attributionRequired !== undefined
                      ? {
                            attributionRequired:
                                input.attributionRequired,
                        }
                      : {}),
                  ...(usageTerms ? { usageTerms } : {}),
                  ...(restrictions ? { restrictions } : {}),
              }
            : {}),
    };
    const existing = readSources().filter((item) => item.id !== id);
    writeSources([source, ...existing].slice(0, SOURCE_INBOX_LIMIT));
    return source;
}

export function deleteSavedSource(id: string): void {
    writeSources(readSources().filter((source) => source.id !== id));
}
