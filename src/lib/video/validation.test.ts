import { describe, expect, it } from 'vitest';
import { validateVideoFile, validateVideoMetadata } from '@/lib/video/validation';

describe('video validation', () => {
    it('accepts a short H.264 MP4-sized file', () => {
        expect(
            validateVideoFile({ name: 'meme.mp4', type: 'video/mp4', size: 100 * 1024 * 1024 })
        ).toEqual({ ok: true });
    });

    it('rejects files over the browser-safe source limit', () => {
        expect(
            validateVideoFile({ name: 'large.mp4', type: 'video/mp4', size: 100 * 1024 * 1024 + 1 })
        ).toMatchObject({ ok: false, code: 'too-large' });
    });

    it('rejects clips longer than thirty seconds', () => {
        expect(validateVideoMetadata({ duration: 30.01, width: 720, height: 1280 })).toMatchObject({
            ok: false,
            code: 'too-long',
        });
    });

    it('rejects empty or unplayable metadata', () => {
        expect(validateVideoMetadata({ duration: Number.NaN, width: 0, height: 720 })).toMatchObject({
            ok: false,
            code: 'unreadable',
        });
    });
});
