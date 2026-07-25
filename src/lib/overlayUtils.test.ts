import { describe, expect, it } from 'vitest';
import { getTransformableAtPosition } from './overlayUtils';

describe('getTransformableAtPosition', () => {
    it('ignores hidden layers while preserving the original layer index', () => {
        const result = getTransformableAtPosition(50, 50, [
            {
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                rotation: 0,
            },
            {
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                rotation: 0,
                visible: false,
            },
        ]);

        expect(result).toEqual({ index: 0, handle: 'move' });
    });
});
