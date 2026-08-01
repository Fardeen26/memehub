import { describe, expect, it } from 'vitest';
import {
    createVideoProject,
    createVideoTextLayer,
    isTextLayerVisibleAt,
    normalizeVideoProject,
} from '@/lib/video/project';

describe('video project', () => {
    const source = {
        name: 'clip.mp4',
        size: 1_024,
        lastModified: 123,
        mimeType: 'video/mp4',
        durationMs: 8_000,
        width: 1280,
        height: 720,
        rotation: 0,
    };

    it('creates whole-clip text layers with future-ready timing', () => {
        const project = createVideoProject(source);

        expect(project.schemaVersion).toBe(1);
        expect(project.audio.enabled).toBe(true);
        expect(project.effects).toEqual([{ kind: 'filter', preset: 'original' }]);

        const layer = project.layers[0];
        expect(layer.timing).toEqual({ startMs: 0, endMs: null });
        expect(isTextLayerVisibleAt(layer, 7_999)).toBe(true);
    });

    it('normalizes out-of-range transforms and unsupported filter values', () => {
        const project = createVideoProject(source);
        project.layers[0].transform = { x: -3, y: 4, width: 2, height: 0, rotation: 45 };
        project.effects = [{ kind: 'filter', preset: 'unknown' as never }];

        const normalized = normalizeVideoProject(project);

        expect(normalized.layers[0].transform).toEqual({
            x: 0,
            y: 1,
            width: 1,
            height: 0.01,
            rotation: 45,
        });
        expect(normalized.effects).toEqual([{ kind: 'filter', preset: 'original' }]);
    });

    it('creates a new text layer without sharing the initial layer identity', () => {
        const project = createVideoProject(source);
        const added = createVideoTextLayer(project.layers.length);

        expect(added.id).not.toBe(project.layers[0].id);
        expect(added.text).toBe('Your text');
        expect(added.transform.y).toBeGreaterThan(project.layers[0].transform.y);
    });
});
