export type ImagePlacementMode = 'fit' | 'cover';

export interface StillImageFormatMetadata {
    id: string;
    label: string;
    mimeType: string;
    extension: string;
    supportsTransparency: boolean;
    supportsQuality: boolean;
    defaultQuality?: number;
}

export const STILL_IMAGE_FORMATS = {
    png: {
        id: 'png',
        label: 'PNG',
        mimeType: 'image/png',
        extension: 'png',
        supportsTransparency: true,
        supportsQuality: false,
    },
    jpeg: {
        id: 'jpeg',
        label: 'JPEG',
        mimeType: 'image/jpeg',
        extension: 'jpg',
        supportsTransparency: false,
        supportsQuality: true,
        defaultQuality: 0.9,
    },
    webp: {
        id: 'webp',
        label: 'WebP',
        mimeType: 'image/webp',
        extension: 'webp',
        supportsTransparency: true,
        supportsQuality: true,
        defaultQuality: 0.9,
    },
} as const satisfies Record<string, StillImageFormatMetadata>;

export type StillImageFormatId = keyof typeof STILL_IMAGE_FORMATS;

export type CreatorExportProfileSize =
    | { mode: 'original' }
    | { mode: 'fixed'; width: number; height: number }
    | { mode: 'max-width'; width: number; upscale: boolean };

export interface CreatorExportProfile {
    id: string;
    label: string;
    description: string;
    size: CreatorExportProfileSize;
    defaultFormat: StillImageFormatId;
    defaultQuality?: number;
    defaultPlacement: ImagePlacementMode;
}

export const CREATOR_EXPORT_PROFILES = {
    original: {
        id: 'original',
        label: 'Original size',
        description: 'Keep the current canvas dimensions.',
        size: { mode: 'original' },
        defaultFormat: 'png',
        defaultPlacement: 'fit',
    },
    'instagram-square': {
        id: 'instagram-square',
        label: 'Instagram square',
        description: 'Square Instagram post at 1080 × 1080.',
        size: { mode: 'fixed', width: 1080, height: 1080 },
        defaultFormat: 'png',
        defaultPlacement: 'fit',
    },
    'instagram-portrait': {
        id: 'instagram-portrait',
        label: 'Instagram portrait',
        description: 'Portrait Instagram post at 1080 × 1350.',
        size: { mode: 'fixed', width: 1080, height: 1350 },
        defaultFormat: 'png',
        defaultPlacement: 'fit',
    },
    'instagram-story': {
        id: 'instagram-story',
        label: 'Instagram story',
        description: 'Full-screen Story at 1080 × 1920.',
        size: { mode: 'fixed', width: 1080, height: 1920 },
        defaultFormat: 'png',
        defaultPlacement: 'fit',
    },
    'whatsapp-compressed': {
        id: 'whatsapp-compressed',
        label: 'WhatsApp compressed',
        description: 'Preserve the aspect ratio and limit width to 1080 pixels.',
        size: { mode: 'max-width', width: 1080, upscale: false },
        defaultFormat: 'jpeg',
        defaultQuality: 0.82,
        defaultPlacement: 'fit',
    },
} as const satisfies Record<string, CreatorExportProfile>;

export type CreatorExportProfileId = keyof typeof CREATOR_EXPORT_PROFILES;

export interface ImageDimensions {
    width: number;
    height: number;
}

export function resolveCreatorExportDimensions(
    profileId: CreatorExportProfileId,
    source: ImageDimensions
): ImageDimensions {
    assertPositiveDimensions(
        [source.width, source.height],
        'Source dimensions must be positive finite numbers.'
    );

    const profile = CREATOR_EXPORT_PROFILES[profileId];
    const { size } = profile;

    if (size.mode === 'original') {
        return { ...source };
    }

    if (size.mode === 'fixed') {
        return { width: size.width, height: size.height };
    }

    const width = size.upscale
        ? size.width
        : Math.min(source.width, size.width);

    return {
        width,
        height: Math.max(1, Math.round((source.height * width) / source.width)),
    };
}

export interface CalculateImagePlacementOptions {
    sourceWidth: number;
    sourceHeight: number;
    targetWidth: number;
    targetHeight: number;
    mode?: ImagePlacementMode;
}

export interface ImagePlacement {
    mode: ImagePlacementMode;
    x: number;
    y: number;
    width: number;
    height: number;
    scale: number;
    cropped: boolean;
}

export function calculateImagePlacement({
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    mode = 'fit',
}: CalculateImagePlacementOptions): ImagePlacement {
    assertPositiveDimensions(
        [sourceWidth, sourceHeight, targetWidth, targetHeight],
        'Placement dimensions must be positive finite numbers.'
    );

    const widthScale = targetWidth / sourceWidth;
    const heightScale = targetHeight / sourceHeight;
    const scale =
        mode === 'cover'
            ? Math.max(widthScale, heightScale)
            : Math.min(widthScale, heightScale);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    const x = (targetWidth - width) / 2;
    const y = (targetHeight - height) / 2;

    return {
        mode,
        x,
        y,
        width,
        height,
        scale,
        cropped:
            mode === 'cover' &&
            (width > targetWidth || height > targetHeight),
    };
}

export interface BuildCreatorExportFilenameOptions {
    baseName: string;
    profileId: CreatorExportProfileId;
    format: StillImageFormatId;
}

const NON_ALPHANUMERIC_CHARACTERS = new RegExp(
    '[^\\p{L}\\p{M}\\p{N}]+',
    'gu'
);

export function buildCreatorExportFilename({
    baseName,
    profileId,
    format,
}: BuildCreatorExportFilenameOptions): string {
    const nameWithoutKnownExtension = baseName
        .trim()
        .replace(/\.(?:png|jpe?g|webp)$/i, '');
    const slug =
        nameWithoutKnownExtension
            .normalize('NFKC')
            .toLocaleLowerCase('en-US')
            .replace(NON_ALPHANUMERIC_CHARACTERS, '-')
            .replace(/^-+|-+$/g, '') || 'meme';

    return `${slug}-${profileId}.${STILL_IMAGE_FORMATS[format].extension}`;
}

function assertPositiveDimensions(values: number[], message: string): void {
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
        throw new RangeError(message);
    }
}
