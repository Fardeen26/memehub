import { describe, expect, it, vi } from 'vitest';
import { findWikipediaSearchSuggestion } from './searchSuggestions';

describe('Wikipedia search suggestions', () => {
    it('returns a safe correction for a misspelled public figure', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    query: {
                        searchinfo: {
                            suggestion: 'dharmendra pradhan',
                        },
                        search: [],
                    },
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        );

        await expect(
            findWikipediaSearchSuggestion('darmendra pardhan', fetcher)
        ).resolves.toBe('dharmendra pradhan');
        const requestedUrl = new URL(String(fetcher.mock.calls[0]?.[0]));
        expect(requestedUrl.hostname).toBe('en.wikipedia.org');
        expect(requestedUrl.searchParams.get('srsearch')).toBe(
            'darmendra pardhan'
        );
        expect(requestedUrl.searchParams.get('srinfo')).toBe('suggestion');
    });

    it('ignores absent, unsafe, unchanged, and unreasonably long suggestions', async () => {
        const payloads = [
            { query: { searchinfo: {}, search: [] } },
            {
                query: {
                    searchinfo: { suggestion: 'javascript:alert(1)' },
                    search: [],
                },
            },
            {
                query: {
                    searchinfo: { suggestion: 'Narendra   Modi' },
                    search: [],
                },
            },
            {
                query: {
                    searchinfo: { suggestion: 'x'.repeat(121) },
                    search: [],
                },
            },
        ];
        const fetcher = vi.fn<typeof fetch>();
        for (const payload of payloads) {
            fetcher.mockResolvedValueOnce(
                new Response(JSON.stringify(payload), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                })
            );
        }

        await expect(
            findWikipediaSearchSuggestion('anything', fetcher)
        ).resolves.toBeUndefined();
        await expect(
            findWikipediaSearchSuggestion('anything', fetcher)
        ).resolves.toBeUndefined();
        await expect(
            findWikipediaSearchSuggestion('Narendra Modi', fetcher)
        ).resolves.toBeUndefined();
        await expect(
            findWikipediaSearchSuggestion('anything', fetcher)
        ).resolves.toBeUndefined();
    });

    it('degrades to no suggestion when Wikipedia is unavailable', async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response('unavailable', { status: 503 }));

        await expect(
            findWikipediaSearchSuggestion('cjp protest', fetcher)
        ).resolves.toBeUndefined();
    });

    it('does not rewrite long current-event phrases with a nearby but wrong word', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    query: {
                        searchinfo: {
                            suggestion: 'cjp project lathi charge',
                        },
                    },
                }),
                { status: 200 }
            )
        );

        await expect(
            findWikipediaSearchSuggestion(
                'cjp protest lathi charge',
                fetcher
            )
        ).resolves.toBeUndefined();
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('counts Hindi words by grapheme content instead of splitting matras', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    query: {
                        searchinfo: {
                            suggestion: 'धर्मेंद्र प्रधान प्रतिक्रिया',
                        },
                    },
                }),
                { status: 200 }
            )
        );

        await findWikipediaSearchSuggestion(
            'धर्मेंद्र प्रधान रिएक्शन',
            fetcher
        );

        expect(fetcher).toHaveBeenCalledOnce();
    });
});
