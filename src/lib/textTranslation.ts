export const TRANSLATABLE_MIME_TYPES = ['text/plain'] as const;

export const MEME_TRANSLATION_LANGUAGES = [
    { code: 'ar', label: 'Arabic' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'it', label: 'Italian' },
    { code: 'hi', label: 'Hindi' },
    { code: 'bn', label: 'Bengali' },
    { code: 'ta', label: 'Tamil' },
    { code: 'te', label: 'Telugu' },
    { code: 'mr', label: 'Marathi' },
    { code: 'gu', label: 'Gujarati' },
    { code: 'kn', label: 'Kannada' },
    { code: 'ml', label: 'Malayalam' },
    { code: 'ur', label: 'Urdu' },
] as const;

export type MemeTranslationLanguageCode =
    (typeof MEME_TRANSLATION_LANGUAGES)[number]['code'];

type TranslateFetcher = typeof fetch;
export type MemeTranslationSourceLanguage = 'auto' | MemeTranslationLanguageCode;

export function parseTranslatedTextResponse(payload: unknown): string {
    if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
        throw new Error('Translation service returned an unexpected response.');
    }

    const firstChunk = payload[0][0];
    if (typeof firstChunk === 'string') {
        return firstChunk;
    }

    if (Array.isArray(firstChunk)) {
        if (typeof firstChunk[0] === 'string') {
            return firstChunk[0];
        }

        const translatedText = firstChunk
            .map((segment) => (Array.isArray(segment) ? segment[0] : undefined))
            .filter((part): part is string => typeof part === 'string')
            .join('');

        if (translatedText) {
            return translatedText;
        }
    }

    throw new Error('Translation service returned an unexpected response.');
}

export async function translateText(
    text: string,
    to: MemeTranslationLanguageCode,
    options: {
        fetcher?: TranslateFetcher;
        from?: MemeTranslationSourceLanguage;
    } = {}
): Promise<string> {
    const trimmed = text.trim();
    if (!trimmed) return '';

    const fetcher = options.fetcher ?? fetch;
    const sourceLanguage = options.from ?? 'auto';
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', sourceLanguage);
    url.searchParams.set('tl', to);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', trimmed);

    const response = await fetcher(url.toString(), {
        method: 'GET',
        credentials: 'omit',
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error('Translation service request failed.');
    }

    const payload = await response.json();
    return parseTranslatedTextResponse(payload);
}
