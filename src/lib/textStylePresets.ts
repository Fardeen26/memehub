import type { TextSettings } from '@/types/editor';

export const TEXT_STYLE_PRESET_IDS = [
    'black-bar',
    'meme-outline',
    'reaction',
] as const;

export type TextStylePresetId = (typeof TEXT_STYLE_PRESET_IDS)[number];

export type TextStylePresetSettings = Readonly<
    Omit<TextSettings, 'fontSize' | 'fontFamily' | 'fontWeight' | 'outline' | 'shadow' | 'backgroundColor' | 'backgroundRadius'> & {
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
        id: 'black-bar',
        label: 'Black Bar',
        description: 'White text on a solid black bar for clear captions anywhere.',
        settings: {
            color: '#ffffff',
            letterSpacing: 0,
            textCase: 'normal',
            backgroundColor: '#000000',
            backgroundRadius: 0,
            outline: {
                width: 0,
                color: '#000000',
            },
            shadow: {
                blur: 0,
                offsetX: 0,
                offsetY: 0,
                color: '#000000',
            },
        },
    },
    {
        id: 'meme-outline',
        label: 'Meme Outline',
        description: 'High-contrast white lettering with a strong black stroke and hard shadow.',
        settings: {
            color: '#ffffff',
            letterSpacing: 0,
            textCase: 'uppercase',
            backgroundColor: 'transparent',
            backgroundRadius: 0,
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
        },
    },
    {
        id: 'reaction',
        label: 'Reaction',
        description: 'Bold yellow reaction copy that stands out on busy images.',
        settings: {
            color: '#ffd400',
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
        fontFamily: currentSettings.fontFamily,
        fontWeight: currentSettings.fontWeight,
        visible: currentSettings.visible,
        outline: { ...settings.outline },
        shadow: { ...settings.shadow },
    };
}
