import type { VideoProjectV1 } from '@/types/videoProject';
import { getVideoFilterCss, getVideoFilterOverlay, isTextLayerVisibleAt } from './project';

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

export function transformVideoText(
    text: string,
    textCase: 'uppercase' | 'lowercase' | 'normal'
): string {
    if (textCase === 'uppercase') return text.toUpperCase();
    if (textCase === 'lowercase') return text.toLowerCase();
    return text;
}

function getSpacedTextWidth(ctx: CanvasRenderingContext2D, text: string, letterSpacing: number): number {
    return ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
}

function drawSpacedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    letterSpacing: number,
    stroke: boolean
): void {
    if (!letterSpacing) {
        if (stroke) ctx.strokeText(text, x, y);
        else ctx.fillText(text, x, y);
        return;
    }
    const width = getSpacedTextWidth(ctx, text, letterSpacing);
    let cursor = ctx.textAlign === 'center' ? x - width / 2 : ctx.textAlign === 'right' ? x - width : x;
    for (const character of text) {
        if (stroke) ctx.strokeText(character, cursor, y);
        else ctx.fillText(character, cursor, y);
        cursor += ctx.measureText(character).width + letterSpacing;
    }
}

function drawMultilineText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
    align: CanvasTextAlign,
    letterSpacing: number
): void {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (line && getSpacedTextWidth(ctx, candidate, letterSpacing) > width) {
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
    lines.forEach((lineValue, index) => drawSpacedText(ctx, lineValue, textX, startY + index * lineHeight, letterSpacing, true));
    lines.forEach((lineValue, index) => drawSpacedText(ctx, lineValue, textX, startY + index * lineHeight, letterSpacing, false));
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

    const overlay = getVideoFilterOverlay(project);
    if (overlay) {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, overlay.colors[0]);
        gradient.addColorStop(0.5, overlay.colors[1]);
        gradient.addColorStop(1, overlay.colors[2]);
        ctx.save();
        ctx.globalCompositeOperation = overlay.blendMode;
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }

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
        ctx.font = `${style.fontWeight} ${Math.round(fontSize)}px ${style.fontFamily}, sans-serif`;
        ctx.textAlign = style.textAlign;
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1, style.outlineWidth * Math.min(width, height));
        ctx.strokeStyle = style.outlineColor;
        ctx.fillStyle = style.color;
        ctx.shadowColor = style.shadow.color;
        ctx.shadowBlur = style.shadow.blur * Math.min(width, height);
        ctx.shadowOffsetX = style.shadow.offsetX * Math.min(width, height);
        ctx.shadowOffsetY = style.shadow.offsetY * Math.min(width, height);
        if (style.backgroundColor !== 'transparent') {
            ctx.fillStyle = style.backgroundColor;
            const radius = Math.min(layerWidth / 2, layerHeight / 2, style.backgroundRadius * Math.min(width, height));
            if (radius > 0 && typeof ctx.roundRect === 'function') {
                ctx.beginPath();
                ctx.roundRect(0, 0, layerWidth, layerHeight, radius);
                ctx.fill();
            } else {
                ctx.fillRect(0, 0, layerWidth, layerHeight);
            }
            ctx.fillStyle = style.color;
        }
        drawMultilineText(
            ctx,
            transformVideoText(layer.text, style.textCase),
            0,
            0,
            layerWidth,
            layerHeight,
            fontSize,
            style.textAlign,
            style.letterSpacing * fontSize
        );
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
