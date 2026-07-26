const searchWordPattern = () =>
    /[\p{L}\p{N}][\p{L}\p{N}\p{M}\p{Join_Control}]*/gu;

export function extractSearchWords(value: string): string[] {
    return value.match(searchWordPattern()) ?? [];
}

export function countSearchWords(value: string): number {
    return extractSearchWords(value).length;
}

export function truncateSearchWords(
    value: string,
    maxWords: number
): string {
    if (maxWords <= 0) return '';

    const matches = [...value.matchAll(searchWordPattern())];
    if (matches.length <= maxWords) return value;

    const lastIncluded = matches[maxWords - 1];
    const end =
        (lastIncluded.index ?? 0) + lastIncluded[0].length;
    return value.slice(0, end).trim();
}
