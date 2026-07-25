import { describe, expect, it } from 'vitest';
import {
    SCENE_IMAGE_UNAVAILABLE_MESSAGE,
    settleSceneImageLoads,
} from './sceneImageLoading';

describe('scene image loading', () => {
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
