import { describe, expect, it } from 'vitest';
import type { TextSettings } from '@/types/editor';
import {
    TEXT_STYLE_PRESETS,
    applyTextStylePreset,
    getTextStylePreset,
} from './textStylePresets';

const currentSettings: TextSettings = {
    fontSize: 73,
    color: '#123456',
    fontFamily: 'Inter',
    fontWeight: '500',
    letterSpacing: 3,
    textCase: 'lowercase',
    backgroundColor: 'transparent',
    backgroundRadius: 0,
    outline: {
        width: 7,
        color: '#654321',
    },
    shadow: {
        blur: 9,
        offsetX: 4,
        offsetY: 5,
        color: '#abcdef',
    },
};

describe('text style presets', () => {
    it('exposes five useful creator presets in a stable UI order', () => {
        expect(
            TEXT_STYLE_PRESETS.map(({ id, label }) => ({ id, label }))
        ).toEqual([
            { id: 'classic', label: 'Classic' },
            { id: 'headline-news', label: 'Headline / News' },
            { id: 'subtitle', label: 'Subtitle' },
            { id: 'reaction', label: 'Reaction' },
            { id: 'hindi-bold', label: 'Hindi Bold' },
        ]);
        expect(
            TEXT_STYLE_PRESETS.every(
                (preset) => !('fontSize' in preset.settings)
            )
        ).toBe(true);
    });

    it('returns a preset by its typed id', () => {
        expect(getTextStylePreset('headline-news')).toMatchObject({
            id: 'headline-news',
            label: 'Headline / News',
            settings: {
                fontFamily: 'Source Sans 3',
                fontWeight: '900',
                textCase: 'uppercase',
            },
        });
    });

    it('applies a preset without changing the creator-selected font size', () => {
        const result = applyTextStylePreset(currentSettings, 'classic');

        expect(result.fontSize).toBe(73);
        expect(result).toMatchObject({
            color: '#ffffff',
            fontFamily: 'Impact',
            fontWeight: '900',
            letterSpacing: 0,
            textCase: 'uppercase',
            outline: {
                width: 4,
                color: '#000000',
            },
        });
    });

    it('does not reveal a hidden text layer when its style changes', () => {
        expect(
            applyTextStylePreset(
                { ...currentSettings, visible: false },
                'headline-news'
            ).visible
        ).toBe(false);
    });

    it('returns independent settings without mutating the current settings or preset', () => {
        const before = structuredClone(currentSettings);
        const result = applyTextStylePreset(currentSettings, 'reaction');

        result.outline.width = 99;
        result.shadow.blur = 99;

        expect(currentSettings).toEqual(before);
        expect(
            applyTextStylePreset(currentSettings, 'reaction')
        ).toMatchObject({
            outline: { width: 5 },
            shadow: { blur: 6 },
        });
    });

    it('uses a shaping-safe Devanagari style for Hindi Bold', () => {
        expect(
            applyTextStylePreset(currentSettings, 'hindi-bold')
        ).toMatchObject({
            fontSize: 73,
            fontFamily: 'Noto Sans Devanagari',
            fontWeight: '700',
            letterSpacing: 0,
            textCase: 'normal',
        });
    });
});
