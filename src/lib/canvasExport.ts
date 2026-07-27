import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { PNG_EXPORT_MIME_TYPE, type AnimatedExportCapability } from '@/lib/exportCapabilities';
import { ANIMATED_EXPORT_MIN_DURATION_MS } from '@/lib/gifAnimation';
import {
    calculateImagePlacement,
    type ImagePlacementMode,
} from '@/lib/creatorExport';

export const ANIMATED_VIDEO_EXPORT_MAX_DIMENSION = 1080;

export function copyBytesToArrayBuffer(
    bytes: Uint8Array<ArrayBufferLike>
): ArrayBuffer {
    const ownedBytes = new Uint8Array(bytes.byteLength);
    ownedBytes.set(bytes);
    return ownedBytes.buffer;
}

export type SceneRenderOptions = {
    timeMs: number;
    includeEditorControls: boolean;
    resetAnimations?: boolean;
};

export type SceneRenderer = (
    canvas: HTMLCanvasElement,
    options: SceneRenderOptions
) => Promise<void>;

export async function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string = PNG_EXPORT_MIME_TYPE,
    quality?: number
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        try {
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas export failed. The image may be blocked by CORS.'));
                },
                type,
                quality
            );
        } catch (error) {
            reject(error);
        }
    });
}

export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function renderSceneToPngBlob(
    renderScene: SceneRenderer,
    timeMs: number
): Promise<Blob> {
    const canvas = document.createElement('canvas');
    await renderScene(canvas, {
        timeMs,
        includeEditorControls: false,
        resetAnimations: false,
    });
    return canvasToBlob(canvas, PNG_EXPORT_MIME_TYPE);
}

export type StillSceneExportOptions = {
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
    width?: number;
    height?: number;
    mode?: ImagePlacementMode;
    backgroundColor?: string;
};

async function encodeStillCanvas(
    canvas: HTMLCanvasElement,
    mimeType: StillSceneExportOptions['mimeType'],
    quality?: number
): Promise<Blob> {
    const blob = await canvasToBlob(canvas, mimeType, quality);
    const actualMimeType = blob.type.split(';', 1)[0].trim().toLowerCase();

    if (!actualMimeType) {
        throw new Error(
            `This browser could not verify ${mimeType} encoding.`
        );
    }

    if (actualMimeType !== mimeType.toLowerCase()) {
        throw new Error(
            `This browser could not encode ${mimeType}; it returned ${actualMimeType} instead.`
        );
    }

    return blob;
}

export async function renderSceneToImageBlob(
    renderScene: SceneRenderer,
    timeMs: number,
    options: StillSceneExportOptions
): Promise<Blob> {
    const sourceCanvas = document.createElement('canvas');
    await renderScene(sourceCanvas, {
        timeMs,
        includeEditorControls: false,
        resetAnimations: false,
    });

    if (options.width === undefined && options.height === undefined) {
        return encodeStillCanvas(
            sourceCanvas,
            options.mimeType,
            options.quality
        );
    }
    if (options.width === undefined || options.height === undefined) {
        throw new RangeError(
            'Still export requires both target width and target height.'
        );
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = options.width;
    outputCanvas.height = options.height;
    const outputContext = outputCanvas.getContext('2d');
    if (!outputContext) {
        throw new Error('Still image export is not supported in this browser.');
    }

    if (options.backgroundColor) {
        outputContext.fillStyle = options.backgroundColor;
        outputContext.fillRect(
            0,
            0,
            outputCanvas.width,
            outputCanvas.height
        );
    }

    const placement = calculateImagePlacement({
        sourceWidth: sourceCanvas.width,
        sourceHeight: sourceCanvas.height,
        targetWidth: outputCanvas.width,
        targetHeight: outputCanvas.height,
        mode: options.mode,
    });
    outputContext.drawImage(
        sourceCanvas,
        placement.x,
        placement.y,
        placement.width,
        placement.height
    );

    return encodeStillCanvas(
        outputCanvas,
        options.mimeType,
        options.quality
    );
}

export function getContainedEvenDimensions(
    width: number,
    height: number,
    maxDimension = ANIMATED_VIDEO_EXPORT_MAX_DIMENSION
): { width: number; height: number } {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return { width: 2, height: 2 };
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const makeEven = (value: number) => Math.max(2, Math.floor(value / 2) * 2);

    return {
        width: makeEven(width * scale),
        height: makeEven(height * scale),
    };
}

function copyFrameToCaptureCanvas(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
    const ctx = target.getContext('2d');
    if (!ctx) throw new Error('Video export failed.');

    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(source, 0, 0, target.width, target.height);
}

export async function recordSceneToVideoBlob(
    renderScene: SceneRenderer,
    capability: Extract<AnimatedExportCapability, { format: 'mp4' }>,
    options: {
        durationMs?: number;
        fps?: number;
        maxDimension?: number;
        onProgress?: (progress: { completedFrames: number; totalFrames: number }) => void;
    } = {}
): Promise<Blob> {
    const durationMs = options.durationMs ?? ANIMATED_EXPORT_MIN_DURATION_MS;
    const fps = options.fps ?? 30;
    const frameDurationMs = 1000 / fps;
    const totalFrames = Math.ceil(durationMs / frameDurationMs);
    const renderCanvas = document.createElement('canvas');
    const captureCanvas = document.createElement('canvas');

    await renderScene(renderCanvas, {
        timeMs: 0,
        includeEditorControls: false,
        resetAnimations: true,
    });

    const targetDimensions = getContainedEvenDimensions(
        renderCanvas.width,
        renderCanvas.height,
        options.maxDimension
    );
    captureCanvas.width = targetDimensions.width;
    captureCanvas.height = targetDimensions.height;
    copyFrameToCaptureCanvas(renderCanvas, captureCanvas);

    if (typeof captureCanvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        throw new Error('Video recording is not supported in this browser.');
    }

    let stream = captureCanvas.captureStream(0);
    let videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
        requestFrame?: () => void;
    };

    if (typeof videoTrack?.requestFrame !== 'function') {
        stream.getTracks().forEach((track) => track.stop());
        stream = captureCanvas.captureStream(fps);
        videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
            requestFrame?: () => void;
        };
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: capability.captureMimeType });

    const done = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
            stream.getTracks().forEach((track) => track.stop());
            reject(new Error('WebM recording failed.'));
        };
        recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            const blob = new Blob(chunks, { type: capability.captureMimeType });
            if (blob.size === 0) reject(new Error('Video export produced an empty file.'));
            else resolve(blob);
        };
    });

    recorder.start(100);
    const startedAt = performance.now();

    for (let frame = 0; frame < totalFrames; frame += 1) {
        await renderScene(renderCanvas, {
            timeMs: frame * frameDurationMs,
            includeEditorControls: false,
            resetAnimations: true,
        });
        copyFrameToCaptureCanvas(renderCanvas, captureCanvas);
        videoTrack?.requestFrame?.();
        options.onProgress?.({ completedFrames: frame + 1, totalFrames });

        const nextFrameAt = startedAt + (frame + 1) * frameDurationMs;
        const waitMs = Math.max(0, nextFrameAt - performance.now());
        if (waitMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, waitMs));
        } else if (frame % 5 === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 0));
        }
    }

    recorder.stop();
    return done;
}

export async function encodeSceneToGifBlob(
    renderScene: SceneRenderer,
    options: { durationMs?: number; fps?: number } = {}
): Promise<Blob> {
    const durationMs = options.durationMs ?? ANIMATED_EXPORT_MIN_DURATION_MS;
    const fps = options.fps ?? 15;
    const frameDurationMs = 1000 / fps;
    const totalFrames = Math.ceil(durationMs / frameDurationMs);
    const canvas = document.createElement('canvas');
    const encoder = GIFEncoder();

    for (let frame = 0; frame < totalFrames; frame += 1) {
        await renderScene(canvas, {
            timeMs: frame * frameDurationMs,
            includeEditorControls: false,
            resetAnimations: true,
        });

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('GIF export failed.');

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const palette = quantize(imageData.data, 256, { format: 'rgb565' });
        const index = applyPalette(imageData.data, palette, 'rgb565');

        encoder.writeFrame(index, canvas.width, canvas.height, {
            palette,
            delay: frameDurationMs,
            repeat: 0,
        });
    }

    encoder.finish();
    const blob = new Blob([copyBytesToArrayBuffer(encoder.bytesView())], {
        type: 'image/gif',
    });
    if (blob.size === 0) throw new Error('GIF export produced an empty file.');
    return blob;
}
