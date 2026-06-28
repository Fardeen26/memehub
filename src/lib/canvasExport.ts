import { applyPalette, GIFEncoder, quantize } from 'gifenc';
import { PNG_EXPORT_MIME_TYPE, type AnimatedExportCapability } from '@/lib/exportCapabilities';
import { ANIMATED_EXPORT_MIN_DURATION_MS } from '@/lib/gifAnimation';

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
    type = PNG_EXPORT_MIME_TYPE,
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

export async function recordSceneToWebmBlob(
    renderScene: SceneRenderer,
    capability: Extract<AnimatedExportCapability, { format: 'webm' }>,
    options: { durationMs?: number; fps?: number } = {}
): Promise<Blob> {
    const durationMs = options.durationMs ?? ANIMATED_EXPORT_MIN_DURATION_MS;
    const fps = options.fps ?? 30;
    const frameDurationMs = 1000 / fps;
    const totalFrames = Math.ceil(durationMs / frameDurationMs);
    const canvas = document.createElement('canvas');

    await renderScene(canvas, {
        timeMs: 0,
        includeEditorControls: false,
        resetAnimations: true,
    });

    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        throw new Error('WebM recording is not supported in this browser.');
    }

    let stream = canvas.captureStream(0);
    let videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
        requestFrame?: () => void;
    };

    if (typeof videoTrack?.requestFrame !== 'function') {
        stream.getTracks().forEach((track) => track.stop());
        stream = canvas.captureStream(fps);
        videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
            requestFrame?: () => void;
        };
    }

    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: capability.mimeType });

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
            const blob = new Blob(chunks, { type: capability.mimeType });
            if (blob.size === 0) reject(new Error('WebM export produced an empty file.'));
            else resolve(blob);
        };
    });

    recorder.start(100);
    const startedAt = performance.now();

    for (let frame = 0; frame < totalFrames; frame += 1) {
        await renderScene(canvas, {
            timeMs: frame * frameDurationMs,
            includeEditorControls: false,
            resetAnimations: true,
        });
        videoTrack?.requestFrame?.();

        const nextFrameAt = startedAt + (frame + 1) * frameDurationMs;
        const waitMs = Math.max(0, nextFrameAt - performance.now());
        if (waitMs > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, waitMs));
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
    const blob = new Blob([encoder.bytesView()], { type: 'image/gif' });
    if (blob.size === 0) throw new Error('GIF export produced an empty file.');
    return blob;
}
