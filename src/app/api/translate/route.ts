import { NextRequest } from 'next/server';
import {
    MEME_TRANSLATION_LANGUAGES,
    translateText,
    type MemeTranslationSourceLanguage,
    type MemeTranslationLanguageCode,
} from '@/lib/textTranslation';
import { consumeDiscoverySearchRateLimit } from '@/lib/discoveryRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supportedLanguages = new Set<MemeTranslationLanguageCode>(
    MEME_TRANSLATION_LANGUAGES.map((language) => language.code)
);
const MAX_TRANSLATION_TEXT_LENGTH = 5_000;
const supportedSourceLanguages = new Set<MemeTranslationSourceLanguage>([
    'auto',
    ...MEME_TRANSLATION_LANGUAGES.map((language) => language.code),
]);

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const text = url.searchParams.get('text') ?? '';
    const to = url.searchParams.get('to') as MemeTranslationLanguageCode | null;
    const from = url.searchParams.get('from') ?? 'auto';

    if (!text.trim()) {
        return Response.json(
            { error: 'Missing text to translate.' },
            { status: 400 }
        );
    }

    if (text.length > MAX_TRANSLATION_TEXT_LENGTH) {
        return Response.json(
            { error: 'Translation text must be 5,000 characters or fewer.' },
            { status: 400 }
        );
    }

    if (!to || !supportedLanguages.has(to)) {
        return Response.json(
            { error: 'Unsupported translation language.' },
            { status: 400 }
        );
    }

    if (!supportedSourceLanguages.has(from as MemeTranslationSourceLanguage)) {
        return Response.json(
            { error: 'Unsupported source language.' },
            { status: 400 }
        );
    }

    const rateLimit = await consumeDiscoverySearchRateLimit(request);
    if (!rateLimit.allowed) {
        return Response.json(
            {
                error:
                    rateLimit.reason === 'unavailable'
                        ? 'Translation is temporarily unavailable.'
                        : 'Too many translation requests. Try again shortly.',
            },
            {
                status: rateLimit.reason === 'unavailable' ? 503 : 429,
                headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
            }
        );
    }

    try {
        const translated = await translateText(text, to, {
            from: from as MemeTranslationSourceLanguage,
        });
        return Response.json({
            text: translated,
            to,
            from,
            source: text,
        });
    } catch (error) {
        console.error('[api/translate] Failed to translate text:', error);
        return Response.json(
            { error: 'Unable to translate text right now.' },
            { status: 502 }
        );
    }
}
