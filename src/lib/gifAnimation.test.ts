import { describe, expect, it } from 'vitest';
import {
    GIF_MAX_BYTES,
    GIF_MAX_DECODED_FRAMES,
    GifDecodeLimitError,
    assertGifDecodeLimits,
    getAnimatedExportDurationMs,
    normalizeGifDelay,
    selectGifFrameIndex,
} from '@/lib/gifAnimation';

describe('gifAnimation', () => {
    it('clamps tiny GIF frame delays', () => {
        expect(normalizeGifDelay(10)).toBe(20);
        expect(normalizeGifDelay(33)).toBe(33);
        expect(normalizeGifDelay(undefined)).toBe(100);
    });

    it('chooses the expected frame for a looped time', () => {
        const frames = [
            { startMs: 0, endMs: 100 },
            { startMs: 100, endMs: 250 },
            { startMs: 250, endMs: 300 },
        ];

        expect(selectGifFrameIndex(frames, 0, 300)).toBe(0);
        expect(selectGifFrameIndex(frames, 100, 300)).toBe(1);
        expect(selectGifFrameIndex(frames, 249, 300)).toBe(1);
        expect(selectGifFrameIndex(frames, 250, 300)).toBe(2);
        expect(selectGifFrameIndex(frames, 310, 300)).toBe(0);
    });

    it('rejects oversized GIF byte input', () => {
        expect(() =>
            assertGifDecodeLimits({ byteLength: GIF_MAX_BYTES + 1, frameCount: 1 })
        ).toThrow(GifDecodeLimitError);
    });

    it('rejects too many decoded GIF frames', () => {
        expect(() =>
            assertGifDecodeLimits({ byteLength: 1024, frameCount: GIF_MAX_DECODED_FRAMES + 1 })
        ).toThrow(GifDecodeLimitError);
    });

    it('uses a 5 second animated export loop', () => {
        expect(getAnimatedExportDurationMs([1200, 2500])).toBe(5000);
        expect(getAnimatedExportDurationMs([1200, 6500, 3000])).toBe(5000);
    });
});
