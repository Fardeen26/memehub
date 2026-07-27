import { describe, expect, it, vi } from 'vitest';
import {
    MEME_TRANSLATION_LANGUAGES,
    parseTranslatedTextResponse,
    requestTranslation,
    translateText,
} from './textTranslation';

describe('text translation helpers', () => {
    it('parses translated text from the Google translate response shape', () => {
        expect(
            parseTranslatedTextResponse([
                [
                    [
                        'नमस्ते दुनिया',
                        'hello world',
                        null,
                        null,
                        3,
                        null,
                        null,
                        [[]],
                        [[['458941ec00fd20f22c6168237a5d2eaa', 'en_hi_2023q1.md']]],
                    ],
                ],
                null,
                'en',
            ])
        ).toBe('नमस्ते दुनिया');
    });

    it('includes popular latin and arabic target languages', () => {
        expect(
            MEME_TRANSLATION_LANGUAGES.map((language) => language.code)
        ).toEqual(
            expect.arrayContaining(['ar', 'es', 'fr', 'it', 'hi', 'bn'])
        );
    });

    it('throws when the translation response is missing translated text', () => {
        expect(() => parseTranslatedTextResponse([[], null, 'en'])).toThrow(
            'Translation service returned an unexpected response.'
        );
    });

    it('requests a translation for the selected target language', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify([
                    [
                        [
                            'नमस्ते दुनिया',
                            'hello world',
                            null,
                            null,
                            3,
                            null,
                            null,
                            [[]],
                            [[['458941ec00fd20f22c6168237a5d2eaa', 'en_hi_2023q1.md']]],
                        ],
                    ],
                    null,
                    'en',
                ]),
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )
        );

        const translated = await translateText('hello world', 'hi', {
            fetcher,
        });

        expect(translated).toBe('नमस्ते दुनिया');
        expect(fetcher).toHaveBeenCalledWith(
            expect.stringContaining(
                'https://translate.googleapis.com/translate_a/single'
            ),
            expect.objectContaining({
                method: 'GET',
                credentials: 'omit',
            })
        );
        expect(fetcher.mock.calls[0]?.[0]).toContain('tl=hi');
    });

    it('allows translating from a non-English source language', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify([
                    [
                        [
                            'বাংলা বাক্য',
                            'urdu sentence',
                            null,
                            null,
                            3,
                            null,
                            null,
                            [[]],
                            [[['id', 'sample']]],
                        ],
                    ],
                    null,
                    'ur',
                ]),
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            )
        );

        const translated = await translateText('urdu sentence', 'bn', {
            from: 'ur',
            fetcher,
        });

        expect(translated).toBe('বাংলা বাক্য');
        expect(fetcher.mock.calls[0]?.[0]).toContain('sl=ur');
        expect(fetcher.mock.calls[0]?.[0]).toContain('tl=bn');
    });

    it('uses the protected application endpoint for browser translation requests', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ text: 'नमस्ते दुनिया' }), {
                headers: { 'Content-Type': 'application/json' },
            })
        );

        await expect(requestTranslation('hello world', 'hi', { fetcher })).resolves.toBe(
            'नमस्ते दुनिया'
        );
        expect(fetcher).toHaveBeenCalledWith(
            '/api/translate?text=hello+world&to=hi',
            expect.objectContaining({ credentials: 'same-origin' })
        );
    });
});
