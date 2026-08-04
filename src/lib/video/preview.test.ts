import { describe, expect, it } from 'vitest';
import {
    VIDEO_PREVIEW_CANVAS_CLASS,
    VIDEO_PREVIEW_FRAME_CLASS,
    VIDEO_PREVIEW_PLAYER_CLASS,
    VIDEO_PREVIEW_SURFACE_CLASS,
} from '@/lib/video/preview';

describe('video preview layout', () => {
    it('keeps portrait clips contained by height instead of stretching them to stage width', () => {
        expect(VIDEO_PREVIEW_CANVAS_CLASS).toContain('w-auto');
        expect(VIDEO_PREVIEW_CANVAS_CLASS).toContain('max-w-full');
        expect(VIDEO_PREVIEW_CANVAS_CLASS).toContain('max-h-[min(52dvh,32rem)]');
        expect(VIDEO_PREVIEW_CANVAS_CLASS).not.toMatch(/(?:^|\s)w-full(?:\s|$)/);
    });

    it('uses a compact, shrink-wrapped frame instead of a full-width black stage', () => {
        expect(VIDEO_PREVIEW_FRAME_CLASS).toContain('w-fit');
        expect(VIDEO_PREVIEW_FRAME_CLASS).toContain('max-w-full');
        expect(VIDEO_PREVIEW_FRAME_CLASS).not.toMatch(/(?:^|\s)w-full(?:\s|$)/);
        expect(VIDEO_PREVIEW_FRAME_CLASS).not.toContain('bg-black');
        expect(VIDEO_PREVIEW_FRAME_CLASS).not.toMatch(/(?:^|\s)rounded(?:-|\s|$)/);
        expect(VIDEO_PREVIEW_CANVAS_CLASS).toContain('max-h-[min(52dvh,32rem)]');
    });

    it('keeps playback controls constrained to the video preview surface', () => {
        expect(VIDEO_PREVIEW_SURFACE_CLASS).toContain('inline-grid');
        expect(VIDEO_PREVIEW_SURFACE_CLASS).toContain('max-w-full');
        expect(VIDEO_PREVIEW_PLAYER_CLASS).toContain('min-w-0');
        expect(VIDEO_PREVIEW_PLAYER_CLASS).not.toMatch(/(?:^|\s)w-full(?:\s|$)/);
    });
});
