import {
    VIDEO_PROJECT_SCHEMA_VERSION,
    type NormalizedTransform,
    type VideoFilterPreset,
    type VideoProjectV1,
    type VideoSourceMetadata,
    type VideoTextLayer,
} from '@/types/videoProject';
import {
    TEXT_STYLE_PRESETS,
    getTextStylePreset,
    type TextStylePresetId,
} from '@/lib/textStylePresets';

export const VIDEO_TEXT_FONT_OPTIONS = [
    'Impact',
    'Anton',
    'Bebas Neue',
    'Oswald',
    'Montserrat',
    'Poppins',
    'Roboto Condensed',
    'Inter',
    'Nunito',
    'Work Sans',
] as const;

export const VIDEO_TEXT_STYLE_PRESETS = TEXT_STYLE_PRESETS;

export type VideoTextStylePresetId = TextStylePresetId;

export const VIDEO_TEXT_FONT_OPTIONS = [
    'Impact',
    'Anton',
    'Bebas Neue',
    'Oswald',
    'Montserrat',
    'Poppins',
    'Roboto Condensed',
    'Inter',
    'Nunito',
    'Work Sans',
] as const;

export const VIDEO_TEXT_STYLE_PRESETS = [
    {
        id: 'cinema-caption',
        label: 'Cinema caption',
        style: {
            fontFamily: 'Montserrat', fontWeight: '800', letterSpacing: 0.03, textCase: 'uppercase' as const,
            color: '#ffffff', outlineColor: '#000000', outlineWidth: 0, backgroundColor: 'transparent', backgroundRadius: 0,
            textAlign: 'center' as const, shadow: { blur: 0.012, offsetX: 0, offsetY: 0.008, color: '#000000' },
        },
    },
    {
        id: 'meme-classic',
        label: 'Meme classic',
        style: {
            fontFamily: 'Impact', fontWeight: '400', letterSpacing: 0.01, textCase: 'uppercase' as const,
            color: '#ffffff', outlineColor: '#000000', outlineWidth: 0.012, backgroundColor: 'transparent', backgroundRadius: 0,
            textAlign: 'center' as const, shadow: { blur: 0.004, offsetX: 0.003, offsetY: 0.004, color: '#000000' },
        },
    },
    {
        id: 'pop-caption',
        label: 'Pop caption',
        style: {
            fontFamily: 'Poppins', fontWeight: '900', letterSpacing: 0, textCase: 'normal' as const,
            color: '#ffffff', outlineColor: '#000000', outlineWidth: 0, backgroundColor: '#17171d', backgroundRadius: 0.018,
            textAlign: 'center' as const, shadow: { blur: 0, offsetX: 0, offsetY: 0, color: '#000000' },
        },
    },
    {
        id: 'neon-reaction',
        label: 'Neon reaction',
        style: {
            fontFamily: 'Anton', fontWeight: '400', letterSpacing: 0.02, textCase: 'uppercase' as const,
            color: '#ffe95c', outlineColor: '#261c6b', outlineWidth: 0.006, backgroundColor: 'transparent', backgroundRadius: 0,
            textAlign: 'center' as const, shadow: { blur: 0.018, offsetX: 0, offsetY: 0.006, color: '#7f5cff' },
        },
    },
] as const;

export type VideoTextStylePresetId = (typeof VIDEO_TEXT_STYLE_PRESETS)[number]['id'];

export const VIDEO_FILTER_PRESETS: Array<{
    id: VideoFilterPreset;
    label: string;
    cssFilter: string;
    overlay?: {
        colors: [string, string, string];
        blendMode: GlobalCompositeOperation;
    };
}> = [
    { id: 'original', label: 'Original', cssFilter: 'none' },
    { id: 'black-and-white', label: 'B&W', cssFilter: 'grayscale(1) contrast(1.15)' },
    { id: 'sepia', label: 'Sepia', cssFilter: 'sepia(.85) contrast(1.05) saturate(.9)' },
    { id: 'warm', label: 'Warm', cssFilter: 'sepia(.2) saturate(1.15) brightness(1.03)' },
    { id: 'cool', label: 'Cool', cssFilter: 'hue-rotate(180deg) saturate(.9) brightness(1.04)' },
    { id: 'high-contrast', label: 'High contrast', cssFilter: 'contrast(1.28) saturate(1.18)' },
    {
        id: 'rio-de-janeiro',
        label: 'Rio de Janeiro',
        cssFilter: 'saturate(1.75) contrast(1.12) brightness(1.04)',
        overlay: {
            colors: [
                'rgba(35, 76, 255, 0.32)',
                'rgba(232, 35, 255, 0.3)',
                'rgba(255, 91, 35, 0.34)',
            ],
            blendMode: 'screen',
        },
    },
];

const FILTER_IDS = new Set<VideoFilterPreset>(VIDEO_FILTER_PRESETS.map((preset) => preset.id));

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function normalizeTransform(transform: NormalizedTransform): NormalizedTransform {
    return {
        x: clamp(transform.x, 0, 1),
        y: clamp(transform.y, 0, 1),
        width: clamp(transform.width, 0.01, 1),
        height: clamp(transform.height, 0.01, 1),
        rotation: Number.isFinite(transform.rotation) ? transform.rotation : 0,
    };
}

export function createVideoTextLayer(index = 0): VideoTextLayer {
    return {
        id: `video-text-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
        kind: 'text',
        text: 'Your text',
        transform: { x: 0.1, y: Math.min(0.72, 0.12 + index * 0.08), width: 0.8, height: 0.18, rotation: 0 },
        style: {
            fontFamily: 'Impact',
            fontSize: 0.075,
            fontWeight: '400',
            letterSpacing: 0,
            textCase: 'uppercase',
            color: '#ffffff',
            outlineColor: '#000000',
            outlineWidth: 0.012,
            backgroundColor: 'transparent',
            backgroundRadius: 0,
            textAlign: 'center',
            shadow: { blur: 0.004, offsetX: 0.003, offsetY: 0.004, color: '#000000' },
        },
        timing: { startMs: 0, endMs: null },
    };
}

export function applyVideoTextStylePreset(
    layer: VideoTextLayer,
    presetId: VideoTextStylePresetId
): VideoTextLayer {
    const { settings } = getTextStylePreset(presetId);
    return {
        ...layer,
        style: {
            ...layer.style,
            color: settings.color,
            letterSpacing: settings.letterSpacing / 100,
            textCase: settings.textCase,
            backgroundColor: settings.backgroundColor,
            backgroundRadius: settings.backgroundRadius / 1000,
            outlineColor: settings.outline.color,
            outlineWidth: settings.outline.width / 1000,
            shadow: {
                blur: settings.shadow.blur / 1000,
                offsetX: settings.shadow.offsetX / 1000,
                offsetY: settings.shadow.offsetY / 1000,
                color: settings.shadow.color,
            },
        },
    };
}

export function createVideoProject(source: VideoSourceMetadata): VideoProjectV1 {
    return {
        schemaVersion: VIDEO_PROJECT_SCHEMA_VERSION,
        source,
        layers: [createVideoTextLayer()],
        effects: [{ kind: 'filter', preset: 'original' }],
        audio: { enabled: true },
    };
}

export function normalizeVideoProject(project: VideoProjectV1): VideoProjectV1 {
    return {
        ...project,
        schemaVersion: VIDEO_PROJECT_SCHEMA_VERSION,
        layers: project.layers.map((layer) => ({
            ...layer,
            style: {
                ...createVideoTextLayer().style,
                ...layer.style,
                shadow: {
                    ...createVideoTextLayer().style.shadow,
                    ...layer.style.shadow,
                },
            },
            transform: normalizeTransform(layer.transform),
            timing: {
                startMs: Math.max(0, layer.timing.startMs || 0),
                endMs: layer.timing.endMs === null ? null : Math.max(0, layer.timing.endMs || 0),
            },
        })),
        effects: project.effects.map((effect) => ({
            kind: 'filter' as const,
            preset: FILTER_IDS.has(effect.preset) ? effect.preset : 'original',
        })),
    };
}

export function isTextLayerVisibleAt(layer: VideoTextLayer, timeMs: number): boolean {
    return timeMs >= layer.timing.startMs && (layer.timing.endMs === null || timeMs <= layer.timing.endMs);
}

export function getVideoFilterCss(project: VideoProjectV1): string {
    const filter = project.effects.find((effect) => effect.kind === 'filter')?.preset ?? 'original';
    return VIDEO_FILTER_PRESETS.find((preset) => preset.id === filter)?.cssFilter ?? 'none';
}

export function getVideoFilterOverlay(project: VideoProjectV1) {
    const filter = project.effects.find((effect) => effect.kind === 'filter')?.preset ?? 'original';
    return VIDEO_FILTER_PRESETS.find((preset) => preset.id === filter)?.overlay;
}
