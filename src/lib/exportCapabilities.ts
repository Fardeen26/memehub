export const PNG_EXPORT_MIME_TYPE = 'image/png' as const;
export const MP4_EXPORT_MIME_TYPE = 'video/mp4' as const;

const VIDEO_CAPTURE_MIME_TYPES = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
] as const;

export type VideoCaptureMimeType = (typeof VIDEO_CAPTURE_MIME_TYPES)[number];

export type Mp4ExportCapability = {
    format: 'mp4';
    mimeType: typeof MP4_EXPORT_MIME_TYPE;
    captureMimeType: VideoCaptureMimeType;
};

export type GifExportCapability = {
    format: 'gif';
    mimeType: 'image/gif';
};

export type AnimatedExportCapability = Mp4ExportCapability | GifExportCapability;

export type ExportCapabilityEnvironment = {
    hasCaptureStream: boolean;
    hasMediaRecorder: boolean;
    isTypeSupported?: (mimeType: string) => boolean;
};

export function getStillExportMimeType(): typeof PNG_EXPORT_MIME_TYPE {
    return PNG_EXPORT_MIME_TYPE;
}

export function getBrowserExportCapabilityEnvironment(): ExportCapabilityEnvironment {
    if (typeof window === 'undefined') {
        return { hasCaptureStream: false, hasMediaRecorder: false };
    }

    const canvasPrototype = HTMLCanvasElement.prototype as HTMLCanvasElement & {
        captureStream?: unknown;
    };
    const mediaRecorder = window.MediaRecorder;

    return {
        hasCaptureStream: typeof canvasPrototype.captureStream === 'function',
        hasMediaRecorder: typeof mediaRecorder !== 'undefined',
        isTypeSupported: mediaRecorder?.isTypeSupported?.bind(mediaRecorder),
    };
}

export function getAnimatedExportCapability(
    env: ExportCapabilityEnvironment = getBrowserExportCapabilityEnvironment()
): AnimatedExportCapability {
    if (env.hasCaptureStream && env.hasMediaRecorder) {
        const supportedType =
            VIDEO_CAPTURE_MIME_TYPES.find((mimeType) => env.isTypeSupported?.(mimeType)) ??
            (!env.isTypeSupported ? 'video/webm' : null);

        if (supportedType) {
            return {
                format: 'mp4',
                mimeType: MP4_EXPORT_MIME_TYPE,
                captureMimeType: supportedType,
            };
        }
    }

    return { format: 'gif', mimeType: 'image/gif' };
}
