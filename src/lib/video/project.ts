import {
    VIDEO_PROJECT_SCHEMA_VERSION,
    type NormalizedTransform,
    type VideoFilterPreset,
    type VideoProjectV1,
    type VideoSourceMetadata,
    type VideoTextLayer,
} from '@/types/videoProject';

export const VIDEO_FILTER_PRESETS: Array<{
    id: VideoFilterPreset;
    label: string;
    cssFilter: string;
}> = [
    { id: 'original', label: 'Original', cssFilter: 'none' },
    { id: 'black-and-white', label: 'B&W', cssFilter: 'grayscale(1) contrast(1.15)' },
    { id: 'sepia', label: 'Sepia', cssFilter: 'sepia(.85) contrast(1.05) saturate(.9)' },
    { id: 'warm', label: 'Warm', cssFilter: 'sepia(.2) saturate(1.15) brightness(1.03)' },
    { id: 'cool', label: 'Cool', cssFilter: 'hue-rotate(180deg) saturate(.9) brightness(1.04)' },
    { id: 'high-contrast', label: 'High contrast', cssFilter: 'contrast(1.28) saturate(1.18)' },
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
            color: '#ffffff',
            outlineColor: '#000000',
            outlineWidth: 0.012,
            backgroundColor: 'transparent',
            textAlign: 'center',
        },
        timing: { startMs: 0, endMs: null },
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
