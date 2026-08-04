import { describe, expect, it, vi } from 'vitest';
import {
    getVideoExportDimensions,
    getVideoRecorderMimeType,
    renderVideoProjectFrame,
    transformVideoText,
} from '@/lib/video/export';
import { createVideoProject } from '@/lib/video/project';

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

    it('renders the Rio de Janeiro cool-to-warm split tone into exported frames', () => {
        const addColorStop = vi.fn();
        const gradient = { addColorStop } as unknown as CanvasGradient;
        const context = {
            clearRect: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            drawImage: vi.fn(),
            createLinearGradient: vi.fn(() => gradient),
            fillRect: vi.fn(),
            filter: 'none',
            fillStyle: '',
            globalCompositeOperation: 'source-over',
        } as unknown as CanvasRenderingContext2D;
        const canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => context),
        } as unknown as HTMLCanvasElement;
        const project = createVideoProject({
            name: 'rio.mp4',
            size: 1,
            lastModified: 1,
            mimeType: 'video/mp4',
            durationMs: 1_000,
            width: 1280,
            height: 720,
            rotation: 0,
        });
        project.layers = [];
        project.effects = [{ kind: 'filter', preset: 'rio-de-janeiro' }];

        renderVideoProjectFrame(canvas, {} as HTMLVideoElement, project, 0);

        expect(context.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 606);
        expect(addColorStop.mock.calls).toEqual([
            [0, 'rgba(35, 76, 255, 0.32)'],
            [0.5, 'rgba(232, 35, 255, 0.3)'],
            [1, 'rgba(255, 91, 35, 0.34)'],
        ]);
        expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1080, 606);
    });
});
