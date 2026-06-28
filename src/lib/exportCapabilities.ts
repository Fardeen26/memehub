export const PNG_EXPORT_MIME_TYPE = 'image/png' as const;

export type WebmExportCapability = {
    format: 'webm';
    mimeType: 'video/webm;codecs=vp9' | 'video/webm;codecs=vp8' | 'video/webm';
};

export type GifExportCapability = {
    format: 'gif';
    mimeType: 'image/gif';
};

export type AnimatedExportCapability = WebmExportCapability | GifExportCapability;

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
        const webmTypes = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
        ] as const;

        const supportedType =
            webmTypes.find((mimeType) => !env.isTypeSupported || env.isTypeSupported(mimeType)) ??
            null;

        if (supportedType) {
            return { format: 'webm', mimeType: supportedType };
        }
    }

    return { format: 'gif', mimeType: 'image/gif' };
}
