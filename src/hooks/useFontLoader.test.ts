// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    FONT_CONFIGS,
    getGoogleFontStylesheetUrl,
    useFontLoader,
    type FontConfig,
} from './useFontLoader';

const INDIAN_SCRIPT_FONTS = [
    'Noto Sans Devanagari',
    'Noto Sans Bengali',
    'Noto Sans Gurmukhi',
    'Noto Sans Gujarati',
    'Noto Sans Tamil',
    'Noto Sans Telugu',
    'Noto Sans Kannada',
    'Noto Sans Malayalam',
    'Noto Nastaliq Urdu',
] as const;

describe('Indian language font support', () => {
    it.each(INDIAN_SCRIPT_FONTS)(
        'provides regular and bold weights for %s',
        (fontName) => {
            expect(FONT_CONFIGS[fontName]).toMatchObject({
                name: fontName,
                weights: expect.arrayContaining(['400', '700']),
            });
        }
    );

    it('uses the same Source Sans family name in the picker and loaded face', () => {
        expect(FONT_CONFIGS['Source Sans 3']).toMatchObject({
            name: 'Source Sans 3',
        });
        expect(FONT_CONFIGS['Source Sans Pro']).toBeUndefined();
    });
});

describe('font loading', () => {
    afterEach(() => {
        cleanup();
        document
            .querySelectorAll('[data-memehub-font-stylesheet]')
            .forEach((element) => element.remove());
    });

    it('waits for both the stylesheet and requested font weights', async () => {
        const load = vi.fn().mockResolvedValue([]);
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                load,
                ready: Promise.resolve(),
            },
        });
        const config: FontConfig = {
            name: 'Memehub Loader Test',
            weights: ['400', '700'],
            display: 'swap',
        };
        const { result } = renderHook(() => useFontLoader());

        let fontPromise!: Promise<void>;
        act(() => {
            fontPromise = result.current.loadFont(config);
        });

        const stylesheet = document.querySelector<HTMLLinkElement>(
            'link[data-memehub-font-stylesheet]'
        );
        expect(stylesheet).not.toBeNull();
        expect(stylesheet?.href).toBe(getGoogleFontStylesheetUrl(config));
        expect(load).not.toHaveBeenCalled();

        stylesheet?.dispatchEvent(new Event('load'));
        await act(async () => {
            await fontPromise;
        });

        expect(load).toHaveBeenCalledWith('400 20px "Memehub Loader Test"');
        expect(load).toHaveBeenCalledWith('700 20px "Memehub Loader Test"');
        expect(result.current.isFontReady(config.name, config.weights)).toBe(true);
    });

    it('evicts a failed request so the creator can retry the font load', async () => {
        const load = vi.fn().mockResolvedValue([]);
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                load,
                ready: Promise.resolve(),
            },
        });
        const config: FontConfig = {
            name: 'Memehub Retry Test',
            weights: ['400'],
        };
        const { result } = renderHook(() => useFontLoader());

        let firstAttempt!: Promise<void>;
        act(() => {
            firstAttempt = result.current.loadFont(config);
        });
        document
            .querySelector<HTMLLinkElement>(
                'link[data-memehub-font-stylesheet]'
            )
            ?.dispatchEvent(new Event('error'));
        await expect(firstAttempt).rejects.toThrow(
            'Failed to load font stylesheet'
        );

        let secondAttempt!: Promise<void>;
        act(() => {
            secondAttempt = result.current.loadFont(config);
        });
        document
            .querySelector<HTMLLinkElement>(
                'link[data-memehub-font-stylesheet]'
            )
            ?.dispatchEvent(new Event('load'));

        await act(async () => {
            await secondAttempt;
        });
        expect(result.current.isFontReady(config.name, config.weights)).toBe(true);
    });
});
