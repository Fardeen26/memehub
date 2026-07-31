// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    FONT_CONFIGS,
    getGoogleFontStylesheetUrl,
    useFontLoader,
    type FontConfig,
} from './useFontLoader';

const REMOVED_INDIC_FONT_FAMILIES = [
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

describe('editor font catalog', () => {
    it.each(REMOVED_INDIC_FONT_FAMILIES)(
        'does not include %s',
        (fontName) => {
            expect(FONT_CONFIGS[fontName]).toBeUndefined();
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
            source: 'google',
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

    it('uses the locally declared Impact face without requesting Google Fonts', async () => {
        const load = vi.fn().mockResolvedValue([]);
        Object.defineProperty(document, 'fonts', {
            configurable: true,
            value: {
                load,
                ready: Promise.resolve(),
            },
        });
        const { result } = renderHook(() => useFontLoader());

        expect(FONT_CONFIGS.Impact).toMatchObject({
            name: 'Impact',
            source: 'system',
        });

        await act(async () => {
            await result.current.loadFont(FONT_CONFIGS.Impact);
        });

        expect(load).toHaveBeenCalledWith('400 20px "Impact"');
        expect(
            document.querySelector('[data-memehub-font-stylesheet]')
        ).toBeNull();
    });

    it('uses bundled or system fonts for every configured editor font', () => {
        expect(
            Object.values(FONT_CONFIGS).every((font) => (
                font.source === 'bundled' || font.source === 'system'
            ))
        ).toBe(true);
    });

    it('continues with a fallback when a Google Fonts stylesheet fails', async () => {
        const config: FontConfig = {
            name: 'Blocked Font',
            weights: ['400'],
            source: 'google',
        };
        const { result } = renderHook(() => useFontLoader());

        let fontPromise!: Promise<void>;
        act(() => {
            fontPromise = result.current.loadFont(config);
        });
        document
            .querySelector<HTMLLinkElement>(
                'link[data-memehub-font-stylesheet]'
            )
            ?.dispatchEvent(new Event('error'));

        await expect(fontPromise).resolves.toBeUndefined();
        expect(result.current.isFontReady(config.name, config.weights)).toBe(true);
    });

});
