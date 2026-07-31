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
    it('keeps only the three useful multi-control effects without replacing the chosen font', () => {
        expect(
            TEXT_STYLE_PRESETS.map(({ id, label }) => ({ id, label }))
        ).toEqual([
            { id: 'black-bar', label: 'Black Bar' },
            { id: 'meme-outline', label: 'Meme Outline' },
            { id: 'reaction', label: 'Reaction' },
        ]);
        expect(
            TEXT_STYLE_PRESETS.every(
                (preset) =>
                    !('fontSize' in preset.settings) &&
                    !('fontFamily' in preset.settings) &&
                    !('fontWeight' in preset.settings)
            )
        ).toBe(true);
        expect(
            TEXT_STYLE_PRESETS.filter(
                (preset) => preset.settings.backgroundColor !== 'transparent'
            ).map(({ id }) => id)
        ).toEqual(['black-bar']);
    });

    it('returns a preset by its typed id', () => {
        expect(getTextStylePreset('black-bar')).toMatchObject({
            id: 'black-bar',
            label: 'Black Bar',
            settings: {
                color: '#ffffff',
                backgroundColor: '#000000',
                backgroundRadius: 0,
                textCase: 'normal',
                outline: { width: 0 },
                shadow: { blur: 0 },
            },
        });
    });

    it('applies a preset without changing the creator-selected font size', () => {
        const result = applyTextStylePreset(currentSettings, 'meme-outline');

        expect(result.fontSize).toBe(73);
        expect(result).toMatchObject({
            color: '#ffffff',
            backgroundColor: 'transparent',
            backgroundRadius: 0,
            fontFamily: 'Inter',
            fontWeight: '500',
            letterSpacing: 0,
            textCase: 'uppercase',
            outline: {
                width: 5,
                color: '#000000',
            },
            shadow: {
                blur: 3,
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
            },
        });
    });

    it('does not reveal a hidden text layer when its style changes', () => {
        expect(
            applyTextStylePreset(
                { ...currentSettings, visible: false },
                'meme-outline'
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

});
