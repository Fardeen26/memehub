import type { VideoProjectV1 } from '@/types/videoProject';
import { getVideoFilterCss, isTextLayerVisibleAt } from './project';

export const VIDEO_EXPORT_MAX_DIMENSION = 1080;
export const VIDEO_EXPORT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const RECORDER_TYPES = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
] as const;

export function getVideoExportDimensions(width: number, height: number): { width: number; height: number } {
    const scale = Math.min(1, VIDEO_EXPORT_MAX_DIMENSION / Math.max(width, height));
    const even = (value: number) => Math.max(2, Math.floor((value * scale) / 2) * 2);
    return { width: even(width), height: even(height) };
}

export function getVideoRecorderMimeType(
    isTypeSupported: (type: string) => boolean = MediaRecorder.isTypeSupported.bind(MediaRecorder)
): string | null {
    return RECORDER_TYPES.find((type) => isTypeSupported(type)) ?? null;
}

function drawMultilineText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    align: CanvasTextAlign
): void {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(candidate).width > width) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    const lineHeight = fontSize * 1.1;
    const startY = y + Math.max(fontSize, (height - lines.length * lineHeight) / 2 + fontSize * 0.75);
    const textX = align === 'left' ? x : align === 'right' ? x + width : x + width / 2;
    lines.forEach((lineValue, index) => ctx.strokeText(lineValue, textX, startY + index * lineHeight));
    lines.forEach((lineValue, index) => ctx.fillText(lineValue, textX, startY + index * lineHeight));
}

export function renderVideoProjectFrame(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    project: VideoProjectV1,
    timeMs = video.currentTime * 1000
): void {
    const { width, height } = getVideoExportDimensions(project.source.width, project.source.height);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas video rendering is not supported in this browser.');

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.filter = getVideoFilterCss(project);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    for (const layer of project.layers) {
        if (!isTextLayerVisibleAt(layer, timeMs) || !layer.text.trim()) continue;
        const { transform, style } = layer;
        const x = transform.x * width;
        const y = transform.y * height;
        const layerWidth = transform.width * width;
        const layerHeight = transform.height * height;
        const fontSize = Math.max(18, style.fontSize * Math.min(width, height));
        ctx.save();
        ctx.translate(x + layerWidth / 2, y + layerHeight / 2);
        ctx.rotate((transform.rotation * Math.PI) / 180);
        ctx.translate(-layerWidth / 2, -layerHeight / 2);
        ctx.font = `${Math.round(fontSize)}px ${style.fontFamily}, sans-serif`;
        ctx.textAlign = style.textAlign;
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, style.outlineWidth * Math.min(width, height));
        ctx.strokeStyle = style.outlineColor;
        ctx.fillStyle = style.color;
        if (style.backgroundColor !== 'transparent') {
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(0, 0, layerWidth, layerHeight);
            ctx.fillStyle = style.color;
        }
        drawMultilineText(ctx, layer.text, 0, 0, layerWidth, layerHeight, fontSize, style.textAlign);
        ctx.restore();
    }
}

type AudioCapture = {
    context: AudioContext;
    destination: MediaStreamAudioDestinationNode;
};

const audioCaptures = new WeakMap<HTMLVideoElement, AudioCapture>();

async function getAudioCapture(video: HTMLVideoElement): Promise<AudioCapture> {
    const current = audioCaptures.get(video);
    if (current) {
        await current.context.resume();
        return current;
    }
    const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error('Audio export is not supported in this browser.');
    const context = new AudioContextConstructor();
    const source = context.createMediaElementSource(video);
    const destination = context.createMediaStreamDestination();
    source.connect(context.destination);
    source.connect(destination);
    await context.resume();
    const capture = { context, destination };
    audioCaptures.set(video, capture);
    return capture;
}

export async function recordVideoProject(
    video: HTMLVideoElement,
    project: VideoProjectV1,
    options: { onProgress?: (progress: number) => void; signal?: AbortSignal } = {}
): Promise<Blob> {
    const canvas = document.createElement('canvas');
    renderVideoProjectFrame(canvas, video, project, 0);
    if (typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        throw new Error('Video recording is not supported in this browser.');
    }
    const mimeType = getVideoRecorderMimeType();
    if (!mimeType) throw new Error('This browser cannot record an MP4 or WebM video.');

    const stream = canvas.captureStream(30);
    let audioCapture: AudioCapture | null = null;
    if (project.audio.enabled && !video.muted) {
        try {
            audioCapture = await getAudioCapture(video);
            const audioTrack = audioCapture.destination.stream.getAudioTracks()[0];
            if (audioTrack) stream.addTrack(audioTrack);
        } catch {
            // The rendered file remains useful when a browser blocks element audio capture.
        }
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: BlobPart[] = [];
    let frameCallbackId: number | null = null;
    let animationFrameId: number | null = null;
    let stopped = false;
    const stop = () => {
        if (stopped) return;
        stopped = true;
        if (frameCallbackId !== null) video.cancelVideoFrameCallback?.(frameCallbackId);
        if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
        if (recorder.state !== 'inactive') recorder.stop();
    };

    const complete = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
            if (event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => reject(new Error('The browser could not encode this video.'));
        recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            const blob = new Blob(chunks, { type: mimeType });
            if (!blob.size) reject(new Error('Video export produced an empty file.'));
            else resolve(blob);
        };
    });

    const paint = () => {
        renderVideoProjectFrame(canvas, video, project);
        options.onProgress?.(Math.min(1, video.currentTime / Math.max(video.duration, 0.001)));
    };
    const schedulePaint = () => {
        if (typeof video.requestVideoFrameCallback === 'function') {
            frameCallbackId = video.requestVideoFrameCallback(() => {
                paint();
                if (!video.ended && !stopped) schedulePaint();
            });
        } else {
            const tick = () => {
                paint();
                if (!video.ended && !stopped) animationFrameId = requestAnimationFrame(tick);
            };
            animationFrameId = requestAnimationFrame(tick);
        }
    };

    const abort = () => stop();
    options.signal?.addEventListener('abort', abort, { once: true });
    video.onended = stop;
    video.currentTime = 0;
    recorder.start(250);
    schedulePaint();
    try {
        await video.play();
        return await complete;
    } finally {
        options.signal?.removeEventListener('abort', abort);
        video.onended = null;
        stop();
        if (audioCapture && audioCapture.context.state !== 'closed') void audioCapture.context.suspend();
    }
}
