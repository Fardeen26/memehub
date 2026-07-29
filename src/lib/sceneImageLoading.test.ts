import { describe, expect, it } from 'vitest';
import {
    collectCachedSceneImages,
    SCENE_IMAGE_UNAVAILABLE_MESSAGE,
    settleSceneImageLoads,
} from './sceneImageLoading';

describe('scene image loading', () => {
    it('uses only already-cached visible scene images for an interaction frame', () => {
        const templateImage = {} as HTMLImageElement;
        const visibleOverlay = {} as HTMLImageElement;
        const hiddenOverlay = {} as HTMLImageElement;
        const cache = new Map([
            ['template.png', templateImage],
            ['visible.png', visibleOverlay],
            ['hidden.png', hiddenOverlay],
        ]);

        const result = collectCachedSceneImages(cache, 'template.png', [
            { id: 'visible', src: 'visible.png' },
            { id: 'hidden', src: 'hidden.png', visible: false },
            { id: 'missing', src: 'missing.png' },
        ]);

        expect(result.templateImage).toBe(templateImage);
        expect(result.overlayImages).toEqual(
            new Map([['visible', visibleOverlay]])
        );
    });

    it('allows the editor preview to keep working while a remote layer is unavailable', async () => {
        const results = await settleSceneImageLoads(
            [
                Promise.resolve('loaded'),
                Promise.reject(new Error('network unavailable')),
            ],
            { strict: false }
        );

        expect(results.map((result) => result.status)).toEqual([
            'fulfilled',
            'rejected',
        ]);
    });

    it('stops an export instead of silently omitting a visible image layer', async () => {
        await expect(
            settleSceneImageLoads(
                [Promise.reject(new Error('network unavailable'))],
                { strict: true }
            )
        ).rejects.toThrow(SCENE_IMAGE_UNAVAILABLE_MESSAGE);
    });
});
