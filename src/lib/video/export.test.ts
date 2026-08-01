import { describe, expect, it } from 'vitest';
import { getVideoExportDimensions, getVideoRecorderMimeType, transformVideoText } from '@/lib/video/export';

describe('video export helpers', () => {
    it('contains export dimensions within 1080 and makes them even', () => {
        expect(getVideoExportDimensions(1920, 1080)).toEqual({ width: 1080, height: 606 });
        expect(getVideoExportDimensions(1080, 1920)).toEqual({ width: 606, height: 1080 });
    });

    it('prefers a browser-supported MP4 recorder and otherwise accepts WebM for cloud conversion', () => {
        expect(getVideoRecorderMimeType((type) => type === 'video/mp4;codecs=avc1,mp4a.40.2')).toBe(
            'video/mp4;codecs=avc1,mp4a.40.2'
        );
        expect(getVideoRecorderMimeType((type) => type === 'video/webm;codecs=vp9,opus')).toBe(
            'video/webm;codecs=vp9,opus'
        );
    });

    it('uses the selected text case before rendering a caption', () => {
        expect(transformVideoText('Hello Video', 'uppercase')).toBe('HELLO VIDEO');
        expect(transformVideoText('Hello Video', 'lowercase')).toBe('hello video');
        expect(transformVideoText('Hello Video', 'normal')).toBe('Hello Video');
    });
});
