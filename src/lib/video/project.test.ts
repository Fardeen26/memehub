import { describe, expect, it } from 'vitest';
import {
    VIDEO_FILTER_PRESETS,
    VIDEO_TEXT_STYLE_PRESETS,
    createVideoProject,
    createVideoTextLayer,
    applyVideoTextStylePreset,
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

    it('offers the Rio de Janeiro split-tone Instagram filter', () => {
        expect(VIDEO_FILTER_PRESETS).toContainEqual({
            id: 'rio-de-janeiro',
            label: 'Rio de Janeiro',
            cssFilter: 'saturate(1.75) contrast(1.12) brightness(1.04)',
            overlay: {
                colors: ['rgba(35, 76, 255, 0.32)', 'rgba(232, 35, 255, 0.3)', 'rgba(255, 91, 35, 0.34)'],
                blendMode: 'screen',
            },
        });

        const project = createVideoProject(source);
        project.effects = [{ kind: 'filter', preset: 'rio-de-janeiro' }];

        expect(normalizeVideoProject(project).effects).toEqual([
            { kind: 'filter', preset: 'rio-de-janeiro' },
        ]);
    });

    it('creates a new text layer without sharing the initial layer identity', () => {
        const project = createVideoProject(source);
        const added = createVideoTextLayer(project.layers.length);

        expect(added.id).not.toBe(project.layers[0].id);
        expect(added.text).toBe('Your text');
        expect(added.transform.y).toBeGreaterThan(project.layers[0].transform.y);
    });

    it('offers exactly the same text style presets as the image editor', () => {
        expect(VIDEO_TEXT_STYLE_PRESETS.map(({ id, label }) => ({ id, label }))).toEqual([
            { id: 'black-bar', label: 'Black Bar' },
            { id: 'meme-outline', label: 'Meme Outline' },
            { id: 'reaction', label: 'Reaction' },
        ]);
    });

    it('applies an image-editor text preset without discarding video font controls', () => {
        const layer = createVideoTextLayer();
        layer.style.fontSize = 0.12;
        layer.style.fontFamily = 'Inter';
        layer.style.fontWeight = '500';
        layer.style.textAlign = 'left';

        const styled = applyVideoTextStylePreset(layer, 'reaction');

        expect(styled.style.fontSize).toBe(0.12);
        expect(styled.style.fontFamily).toBe('Inter');
        expect(styled.style.fontWeight).toBe('500');
        expect(styled.style.textAlign).toBe('left');
        expect(styled.style.color).toBe('#ffd400');
        expect(styled.style.outlineWidth).toBe(0.005);
        expect(styled.style.shadow).toEqual({ blur: 0.006, offsetX: 0.003, offsetY: 0.003, color: '#000000' });
        expect(styled.style.textCase).toBe('uppercase');
    });
});
