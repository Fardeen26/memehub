import type { ReusableImageRights } from '@/types/creatorDiscovery';

const NON_CREDITS = new Set([
    'n a',
    'na',
    'none',
    'not applicable',
    'not available',
    'not known',
    'not provided',
    'unknown',
    'unknown artist',
    'unknown author',
    'unknown creator',
    'uncredited',
    'see source',
    'see source page',
]);

export function resolveReusableImageRights(
    licenseName: string
): ReusableImageRights | null {
    const normalized = licenseName
        .normalize('NFKC')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, ' ');

    if (
        /^(?:CC0(?: 1\.0)?|PUBLIC DOMAIN|PUBLIC DOMAIN MARK(?: 1\.0)?|PDM(?: 1\.0)?|PD|PD(?:-| )(?:USGOV|US|INDIA)|PD(?:-| )OLD(?:-| )(?:50|70|80|100|AUTO))$/.test(
            normalized
        )
    ) {
        return 'editable';
    }

    if (
        /^CC BY-SA (?:1\.0|2\.0|2\.5|3\.0|4\.0)$/.test(
            normalized
        ) ||
        /^(?:GFDL|GNU FREE DOCUMENTATION LICENSE)(?: 1\.[123])?$/.test(
            normalized
        ) ||
        /^(?:FREE ART LICENSE|FAL|ART LIBRE)(?: 1\.[123])?$/.test(
            normalized
        )
    ) {
        return 'share-alike';
    }

    if (
        /^CC BY (?:1\.0|2\.0|2\.5|3\.0|4\.0)$/.test(normalized) ||
        /^GODL-INDIA(?: 2\.0)?$/.test(normalized) ||
        /^OPEN GOVERNMENT LICEN[CS]E(?: V?[1-3](?:\.0)?)?$/.test(
            normalized
        )
    ) {
        return 'attribution';
    }

    return null;
}

export function hasMeaningfulReusableCredit(
    value: string | undefined
): value is string {
    if (!value || !/[\p{L}\p{N}]/u.test(value)) return false;
    const normalized = value
        .normalize('NFKC')
        .toLocaleLowerCase('en')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
    return !NON_CREDITS.has(normalized);
}
