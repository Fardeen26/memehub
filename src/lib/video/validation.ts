export const VIDEO_SOURCE_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_SOURCE_MAX_DURATION_SECONDS = 30;
export const VIDEO_SOURCE_MAX_DIMENSION = 1920;

const ACCEPTED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

export type VideoValidationResult =
    | { ok: true }
    | { ok: false; code: 'unsupported-type' | 'too-large' | 'too-long' | 'too-large-dimensions' | 'unreadable'; message: string };

export function validateVideoFile(file: Pick<File, 'name' | 'size' | 'type'>): VideoValidationResult {
    if (!ACCEPTED_VIDEO_TYPES.has(file.type.toLowerCase())) {
        return {
            ok: false,
            code: 'unsupported-type',
            message: 'Use an MP4, WebM, or MOV video that your browser can play.',
        };
    }
    if (file.size <= 0 || file.size > VIDEO_SOURCE_MAX_BYTES) {
        return {
            ok: false,
            code: 'too-large',
            message: 'Videos must be 100 MB or smaller.',
        };
    }
    return { ok: true };
}

export function validateVideoMetadata(metadata: {
    duration: number;
    width: number;
    height: number;
}): VideoValidationResult {
    if (
        !Number.isFinite(metadata.duration) ||
        metadata.duration <= 0 ||
        !Number.isFinite(metadata.width) ||
        !Number.isFinite(metadata.height) ||
        metadata.width <= 0 ||
        metadata.height <= 0
    ) {
        return { ok: false, code: 'unreadable', message: 'This video could not be read by your browser.' };
    }
    if (metadata.duration > VIDEO_SOURCE_MAX_DURATION_SECONDS) {
        return { ok: false, code: 'too-long', message: 'Videos must be 30 seconds or shorter.' };
    }
    if (Math.max(metadata.width, metadata.height) > VIDEO_SOURCE_MAX_DIMENSION) {
        return {
            ok: false,
            code: 'too-large-dimensions',
            message: 'Videos must be 1080p or smaller.',
        };
    }
    return { ok: true };
}
