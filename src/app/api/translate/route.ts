import { NextRequest } from 'next/server';
import {
    MEME_TRANSLATION_LANGUAGES,
    translateText,
    type MemeTranslationSourceLanguage,
    type MemeTranslationLanguageCode,
} from '@/lib/textTranslation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supportedLanguages = new Set<MemeTranslationLanguageCode>(
    MEME_TRANSLATION_LANGUAGES.map((language) => language.code)
);

export async function GET(request: NextRequest) {
    const url = new URL(request.url);
    const text = url.searchParams.get('text') ?? '';
    const to = url.searchParams.get('to') as MemeTranslationLanguageCode | null;
    const from = (url.searchParams.get('from') ?? 'auto') as MemeTranslationSourceLanguage;

    if (!text.trim()) {
        return Response.json(
            { error: 'Missing text to translate.' },
            { status: 400 }
        );
    }

    if (!to || !supportedLanguages.has(to)) {
        return Response.json(
            { error: 'Unsupported translation language.' },
            { status: 400 }
        );
    }

    try {
        const translated = await translateText(text, to, { from });
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
