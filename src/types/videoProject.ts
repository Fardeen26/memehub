export const VIDEO_PROJECT_SCHEMA_VERSION = 1 as const;

export type VideoFilterPreset =
    | 'original'
    | 'black-and-white'
    | 'sepia'
    | 'warm'
    | 'cool'
    | 'high-contrast';

export type NormalizedTransform = {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
};

export type VideoTextStyle = {
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    letterSpacing: number;
    textCase: 'uppercase' | 'lowercase' | 'normal';
    color: string;
    outlineColor: string;
    outlineWidth: number;
    backgroundColor: string;
    backgroundRadius: number;
    textAlign: 'left' | 'center' | 'right';
    shadow: {
        blur: number;
        offsetX: number;
        offsetY: number;
        color: string;
    };
};

export type VideoTextLayer = {
    id: string;
    kind: 'text';
    text: string;
    transform: NormalizedTransform;
    style: VideoTextStyle;
    timing: { startMs: number; endMs: number | null };
};

export type VideoSourceMetadata = {
    name: string;
    size: number;
    lastModified: number;
    mimeType: string;
    durationMs: number;
    width: number;
    height: number;
    rotation: number;
};

export type VideoEffect = { kind: 'filter'; preset: VideoFilterPreset };

export type VideoProjectV1 = {
    schemaVersion: typeof VIDEO_PROJECT_SCHEMA_VERSION;
    source: VideoSourceMetadata;
    layers: VideoTextLayer[];
    effects: VideoEffect[];
    audio: { enabled: boolean };
};
