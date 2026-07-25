import { decompressFrames, parseGIF, type ParsedFrame, type ParsedGif } from 'gifuct-js';

export const GIF_MAX_BYTES = 10 * 1024 * 1024;
export const GIF_MAX_DECODED_FRAMES = 150;
export const GIF_MAX_DIMENSION = 2048;
export const GIF_MAX_CANVAS_PIXELS = 1920 * 1080;
export const GIF_MIN_FRAME_DELAY_MS = 20;
export const ANIMATED_EXPORT_MIN_DURATION_MS = 5000;
export const ANIMATED_EXPORT_MAX_DURATION_MS = 5000;
export const GIPHY_GIF_FETCH_TIMEOUT_MS = 5000;
export const GIPHY_GIF_MAX_BYTES = 4 * 1024 * 1024;
export const GIPHY_GIF_MAX_DECODED_FRAMES = 80;
export const GIPHY_GIF_MAX_DIMENSION = 640;
export const GIPHY_GIF_MAX_CANVAS_PIXELS = 640 * 640;

export function getAnimatedOverlayIdsToRehydrate(
    overlays: ReadonlyArray<{
        id: string;
        animated?: boolean;
        animatedSrc?: string;
        animationDecodePending?: boolean;
    }>,
    decodedOverlayIds: ReadonlySet<string>,
    pendingOverlayIds: ReadonlySet<string>
): string[] {
    return overlays
        .filter(
            ({ animated, animatedSrc, animationDecodePending, id }) =>
                (animated || animationDecodePending || Boolean(animatedSrc)) &&
                !decodedOverlayIds.has(id) &&
                !pendingOverlayIds.has(id)
        )
        .map(({ id }) => id);
}

export function copyGifPatchToOwnedPixels(
    patch: Uint8ClampedArray<ArrayBufferLike>
): Uint8ClampedArray<ArrayBuffer> {
    const ownedPixels = new Uint8ClampedArray(patch.length);
    ownedPixels.set(patch);
    return ownedPixels;
}

export type GifDecodeLimits = {
    maxBytes?: number;
    maxCanvasPixels?: number;
    maxFramePixels?: number;
    maxFrames?: number;
    maxHeight?: number;
    maxWidth?: number;
};

export type GifDecodePolicy = 'giphy';

export const GIPHY_GIF_DECODE_LIMITS: GifDecodeLimits = {
    maxBytes: GIPHY_GIF_MAX_BYTES,
    maxCanvasPixels: GIPHY_GIF_MAX_CANVAS_PIXELS,
    maxFramePixels: GIPHY_GIF_MAX_CANVAS_PIXELS,
    maxFrames: GIPHY_GIF_MAX_DECODED_FRAMES,
    maxHeight: GIPHY_GIF_MAX_DIMENSION,
    maxWidth: GIPHY_GIF_MAX_DIMENSION,
};

export function getGifDecodeLimitsForPolicy(
    policy: GifDecodePolicy | undefined
): GifDecodeLimits | undefined {
    return policy === 'giphy' ? GIPHY_GIF_DECODE_LIMITS : undefined;
}

export type DecodedGifFrame = {
    canvas: HTMLCanvasElement;
    delayMs: number;
    startMs: number;
    endMs: number;
    index: number;
};

export type DecodedGif = {
    frames: DecodedGifFrame[];
    width: number;
    height: number;
    durationMs: number;
    frameCount: number;
    byteLength: number;
};

type CanvasFactory = () => HTMLCanvasElement;
type GifFrameDimensions = { height: number; left: number; top: number; width: number };

export class GifDecodeLimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GifDecodeLimitError';
    }
}

export function normalizeGifDelay(delayMs: number | undefined): number {
    if (!Number.isFinite(delayMs) || delayMs === undefined) return 100;
    return Math.max(GIF_MIN_FRAME_DELAY_MS, delayMs);
}

export function getGifImageFrameCount(parsedGif: ParsedGif): number {
    return parsedGif.frames.filter((frame) => 'image' in frame && frame.image).length;
}

function getGifFrameDimensions(parsedGif: ParsedGif): GifFrameDimensions[] {
    return parsedGif.frames.flatMap((frame) => {
        if (!('image' in frame) || !frame.image) return [];
        const { descriptor } = frame.image;

        return [{
            height: descriptor.height,
            left: descriptor.left,
            top: descriptor.top,
            width: descriptor.width,
        }];
    });
}

function assertValidGifDimensions(
    label: string,
    dimensions: { height: number; width: number },
    limits: { maxHeight: number; maxPixels: number; maxWidth: number }
): void {
    const { height, width } = dimensions;

    if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw new GifDecodeLimitError(`${label} has invalid dimensions.`);
    }

    if (width > limits.maxWidth || height > limits.maxHeight) {
        throw new GifDecodeLimitError(
            `${label} is too large for browser export. Max dimensions are ${limits.maxWidth}x${limits.maxHeight}.`
        );
    }

    if (width * height > limits.maxPixels) {
        throw new GifDecodeLimitError(
            `${label} has too many pixels for browser export. Max is ${limits.maxPixels.toLocaleString()} pixels.`
        );
    }
}

export function assertGifDimensionLimits(
    input: { frameDimensions?: GifFrameDimensions[]; height: number; width: number },
    limits: GifDecodeLimits = {}
): void {
    const maxWidth = limits.maxWidth ?? GIF_MAX_DIMENSION;
    const maxHeight = limits.maxHeight ?? GIF_MAX_DIMENSION;
    const maxCanvasPixels = limits.maxCanvasPixels ?? GIF_MAX_CANVAS_PIXELS;
    const maxFramePixels = limits.maxFramePixels ?? maxCanvasPixels;

    assertValidGifDimensions('Animated GIF', input, {
        maxHeight,
        maxPixels: maxCanvasPixels,
        maxWidth,
    });

    for (const frame of input.frameDimensions || []) {
        assertValidGifDimensions('Animated GIF frame', frame, {
            maxHeight,
            maxPixels: maxFramePixels,
            maxWidth,
        });

        if (
            !Number.isFinite(frame.left) ||
            !Number.isFinite(frame.top) ||
            frame.left < 0 ||
            frame.top < 0 ||
            frame.left + frame.width > input.width ||
            frame.top + frame.height > input.height
        ) {
            throw new GifDecodeLimitError('Animated GIF frame exceeds the GIF canvas bounds.');
        }
    }
}

export function assertGifDecodeLimits(
    input: { byteLength: number; frameCount: number },
    limits: GifDecodeLimits = {}
): void {
    const maxBytes = limits.maxBytes ?? GIF_MAX_BYTES;
    const maxFrames = limits.maxFrames ?? GIF_MAX_DECODED_FRAMES;

    if (input.byteLength > maxBytes) {
        throw new GifDecodeLimitError('Animated GIF is too large for browser export. Max size is 10MB.');
    }

    if (input.frameCount > maxFrames) {
        throw new GifDecodeLimitError(
            `Animated GIF has too many frames for browser export. Max is ${maxFrames} frames.`
        );
    }
}

export function selectGifFrameIndex(
    frames: Array<{ startMs: number; endMs: number }>,
    timeMs: number,
    durationMs?: number
): number {
    if (frames.length === 0) return -1;
    const duration = durationMs ?? frames[frames.length - 1]?.endMs ?? 0;
    if (duration <= 0) return 0;

    const loopTime = ((timeMs % duration) + duration) % duration;
    const index = frames.findIndex((frame) => loopTime >= frame.startMs && loopTime < frame.endMs);
    return index === -1 ? frames.length - 1 : index;
}

export function getGifFrameCanvas(decodedGif: DecodedGif, timeMs: number): HTMLCanvasElement | null {
    const index = selectGifFrameIndex(decodedGif.frames, timeMs, decodedGif.durationMs);
    return index >= 0 ? decodedGif.frames[index].canvas : null;
}

export function getAnimatedExportDurationMs(
    durationsMs: Array<number | null | undefined>,
    minDurationMs = ANIMATED_EXPORT_MIN_DURATION_MS,
    maxDurationMs = ANIMATED_EXPORT_MAX_DURATION_MS
): number {
    const longestDurationMs = durationsMs.reduce<number>((longest, durationMs) => {
        const duration = typeof durationMs === 'number' ? durationMs : 0;
        if (!Number.isFinite(duration) || duration <= 0) {
            return longest;
        }
        return Math.max(longest, duration);
    }, 0);

    return Math.min(maxDurationMs, Math.max(minDurationMs, longestDurationMs));
}

export function isGifSource(src: string, mimeType?: string | null): boolean {
    return (
        mimeType === 'image/gif' ||
        /^data:image\/gif/i.test(src) ||
        /\.gif(?:[?#]|$)/i.test(src)
    );
}

export async function fetchGifArrayBuffer(
    src: string,
    limits: GifDecodeLimits = {},
    options: { signal?: AbortSignal } = {}
): Promise<ArrayBuffer> {
    const response = await fetch(src, {
        credentials: 'omit',
        mode: 'cors',
        signal: options.signal,
    });
    if (!response.ok) {
        throw new Error(`Failed to load GIF (${response.status})`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 0) {
        assertGifDecodeLimits({ byteLength: contentLength, frameCount: 1 }, limits);
    }

    const buffer = await response.arrayBuffer();
    assertGifDecodeLimits({ byteLength: buffer.byteLength, frameCount: 1 }, limits);
    return buffer;
}

export function decodeGifFromArrayBuffer(
    arrayBuffer: ArrayBuffer,
    limits: GifDecodeLimits = {},
    createCanvas?: CanvasFactory
): DecodedGif {
    const parsedGif = parseGIF(arrayBuffer);
    const sourceFrameCount = getGifImageFrameCount(parsedGif);
    assertGifDecodeLimits({ byteLength: arrayBuffer.byteLength, frameCount: sourceFrameCount }, limits);
    assertGifDimensionLimits(
        {
            frameDimensions: getGifFrameDimensions(parsedGif),
            height: parsedGif.lsd.height,
            width: parsedGif.lsd.width,
        },
        limits
    );

    const frames = decompressFrames(parsedGif, true).filter(Boolean) as ParsedFrame[];
    assertGifDecodeLimits({ byteLength: arrayBuffer.byteLength, frameCount: frames.length }, limits);

    if (frames.length === 0) {
        throw new Error('Animated GIF has no drawable frames.');
    }

    const width = parsedGif.lsd.width;
    const height = parsedGif.lsd.height;
    const makeCanvas = createCanvas ?? (() => document.createElement('canvas'));

    const composedCanvas = makeCanvas();
    composedCanvas.width = width;
    composedCanvas.height = height;
    const composedCtx = composedCanvas.getContext('2d', { willReadFrequently: true });
    if (!composedCtx) throw new Error('Unable to decode GIF frames.');

    const patchCanvas = makeCanvas();
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) throw new Error('Unable to decode GIF frames.');

    let previousFrame: ParsedFrame | null = null;
    let previousRestoreData: ImageData | null = null;
    let cursorMs = 0;

    const decodedFrames = frames.map((frame, index) => {
        if (previousFrame) {
            if (previousFrame.disposalType === 2) {
                composedCtx.clearRect(
                    previousFrame.dims.left,
                    previousFrame.dims.top,
                    previousFrame.dims.width,
                    previousFrame.dims.height
                );
            } else if (previousFrame.disposalType === 3 && previousRestoreData) {
                composedCtx.putImageData(previousRestoreData, 0, 0);
            }
        }

        const restoreData =
            frame.disposalType === 3 ? composedCtx.getImageData(0, 0, width, height) : null;

        patchCanvas.width = frame.dims.width;
        patchCanvas.height = frame.dims.height;
        patchCtx.clearRect(0, 0, patchCanvas.width, patchCanvas.height);
        patchCtx.putImageData(
            new ImageData(
                copyGifPatchToOwnedPixels(frame.patch),
                frame.dims.width,
                frame.dims.height
            ),
            0,
            0
        );
        composedCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);

        const frameCanvas = makeCanvas();
        frameCanvas.width = width;
        frameCanvas.height = height;
        const frameCtx = frameCanvas.getContext('2d');
        if (!frameCtx) throw new Error('Unable to decode GIF frames.');
        frameCtx.drawImage(composedCanvas, 0, 0);

        const delayMs = normalizeGifDelay(frame.delay);
        const decodedFrame: DecodedGifFrame = {
            canvas: frameCanvas,
            delayMs,
            startMs: cursorMs,
            endMs: cursorMs + delayMs,
            index,
        };

        cursorMs += delayMs;
        previousFrame = frame;
        previousRestoreData = restoreData;

        return decodedFrame;
    });

    return {
        frames: decodedFrames,
        width,
        height,
        durationMs: cursorMs,
        frameCount: decodedFrames.length,
        byteLength: arrayBuffer.byteLength,
    };
}
