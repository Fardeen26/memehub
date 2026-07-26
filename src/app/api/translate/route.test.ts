import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

describe('translate route', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns translated text for supported meme languages', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify([
                    [[['नमस्ते दुनिया', 'hello world', null, null]]],
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
        vi.stubGlobal('fetch', fetcher);

        const response = await GET(
            new NextRequest(
                'http://localhost/api/translate?text=hello%20world&to=hi'
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
            text: 'नमस्ते दुनिया',
            to: 'hi',
            from: 'auto',
            source: 'hello world',
        });
    });

    it('passes the requested source language through to translation', async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify([
                    [[['বাংলা বাক্য', 'urdu sentence', null, null]]],
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
        vi.stubGlobal('fetch', fetcher);

        const response = await GET(
            new NextRequest(
                'http://localhost/api/translate?text=urdu%20sentence&from=ur&to=bn'
            )
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toMatchObject({
            text: 'বাংলা বাক্য',
            to: 'bn',
            from: 'ur',
            source: 'urdu sentence',
        });
        expect(fetcher.mock.calls[0]?.[0]).toContain('sl=ur');
        expect(fetcher.mock.calls[0]?.[0]).toContain('tl=bn');
    });

    it('rejects unsupported target languages', async () => {
        const response = await GET(
            new NextRequest('http://localhost/api/translate?text=hello&to=xx')
        );

        expect(response.status).toBe(400);
    });
});
