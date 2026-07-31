import type { TextSettings } from '@/types/editor';

export const TEXT_STYLE_PRESET_IDS = [
    'classic',
    'headline-news',
    'subtitle',
    'reaction',
] as const;

export type TextStylePresetId = (typeof TEXT_STYLE_PRESET_IDS)[number];

export type TextStylePresetSettings = Readonly<
    Omit<TextSettings, 'fontSize' | 'outline' | 'shadow' | 'backgroundColor' | 'backgroundRadius'> & {
        backgroundColor: string;
        backgroundRadius: number;
        outline: Readonly<TextSettings['outline']>;
        shadow: Readonly<TextSettings['shadow']>;
    }
>;

export type TextStylePreset = Readonly<{
    id: TextStylePresetId;
    label: string;
    description: string;
    settings: TextStylePresetSettings;
}>;

export const TEXT_STYLE_PRESETS: readonly TextStylePreset[] = [
    {
        id: 'classic',
        label: 'Classic',
        description: 'The familiar high-contrast Impact meme style.',
        settings: {
            color: '#ffffff',
            fontFamily: 'Impact',
            fontWeight: '900',
            letterSpacing: 0,
            textCase: 'uppercase',
            backgroundColor: 'transparent',
            backgroundRadius: 0,
            outline: {
                width: 4,
                color: '#000000',
            },
            shadow: {
                blur: 4,
                offsetX: 2,
                offsetY: 2,
                color: '#000000',
            },
        },
    },
    {
        id: 'headline-news',
        label: 'Headline / News',
        description: 'A compact editorial treatment for headlines and quotes.',
        settings: {
            color: '#ffffff',
            fontFamily: 'Source Sans 3',
            fontWeight: '900',
            letterSpacing: 0,
            textCase: 'uppercase',
            backgroundColor: 'transparent',
            backgroundRadius: 0,
            outline: {
                width: 2,
                color: '#000000',
            },
            shadow: {
                blur: 2,
                offsetX: 1,
                offsetY: 2,
                color: '#000000',
            },
        },
    },
    {
        id: 'subtitle',
        label: 'Subtitle',
        description: 'Readable mixed-case copy for dialogue and attribution.',
        settings: {
            color: '#ffffff',
            fontFamily: 'Source Sans 3',
            fontWeight: '700',
            letterSpacing: 0,
            textCase: 'normal',
            backgroundColor: 'transparent',
            backgroundRadius: 0,
            outline: {
                width: 2,
                color: '#000000',
            },
            shadow: {
                blur: 2,
                offsetX: 1,
                offsetY: 1,
                color: '#000000',
            },
        },
    },
    {
        id: 'reaction',
        label: 'Reaction',
        description: 'Bold yellow reaction copy that stands out on busy images.',
        settings: {
            color: '#ffd400',
            fontFamily: 'Anton',
            fontWeight: '400',
            letterSpacing: 1,
            textCase: 'uppercase',
            backgroundColor: 'transparent',
            backgroundRadius: 0,
            outline: {
                width: 5,
                color: '#000000',
            },
            shadow: {
                blur: 6,
                offsetX: 3,
                offsetY: 3,
                color: '#000000',
            },
        },
    },
];

export function getTextStylePreset(
    presetId: TextStylePresetId
): TextStylePreset {
    const preset = TEXT_STYLE_PRESETS.find(({ id }) => id === presetId);

    if (!preset) {
        throw new RangeError(`Unknown text style preset: ${presetId}`);
    }

    return preset;
}

export function applyTextStylePreset(
    currentSettings: TextSettings,
    presetId: TextStylePresetId
): TextSettings {
    const { settings } = getTextStylePreset(presetId);

    return {
        ...settings,
        fontSize: currentSettings.fontSize,
        visible: currentSettings.visible,
        outline: { ...settings.outline },
        shadow: { ...settings.shadow },
    };
}
