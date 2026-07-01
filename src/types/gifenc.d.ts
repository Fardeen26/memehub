declare module 'gifenc' {
    export type GifPalette = number[][];

    export type GifEncoder = {
        writeFrame: (
            index: Uint8Array,
            width: number,
            height: number,
            options?: {
                palette?: GifPalette;
                delay?: number;
                repeat?: number;
                transparent?: boolean;
                transparentIndex?: number;
                dispose?: number;
            }
        ) => void;
        finish: () => void;
        bytesView: () => Uint8Array;
    };

    export function GIFEncoder(options?: Record<string, unknown>): GifEncoder;
    export function quantize(
        rgba: Uint8Array | Uint8ClampedArray,
        maxColors: number,
        options?: Record<string, unknown>
    ): GifPalette;
    export function applyPalette(
        rgba: Uint8Array | Uint8ClampedArray,
        palette: GifPalette,
        format?: string
    ): Uint8Array;
}
