import { describe, expect, it } from 'vitest';
import type { ImageOverlay, ShapeOverlay } from '@/types/editor';
import {
    canMoveTextLayerWithinGroup,
    duplicateImageLayer,
    duplicateShapeLayer,
    duplicateTextLayer,
    fitImageLayerToCanvas,
    constrainLayerPosition,
    moveLayer,
    moveTextLayer,
    toggleLayerVisibility,
} from './layerOperations';

const image = (id: string, animated = false): ImageOverlay => ({
    id,
    src: `data:image/png;base64,${id}`,
    label: id,
    animated,
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    originalWidth: 100,
    originalHeight: 80,
    opacity: 1,
    rotation: 0,
    eraseStrokes: [],
});

const shape = (id: string): ShapeOverlay => ({
    id,
    type: 'rectangle',
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    rotation: 0,
    strokeColor: '#fff',
    fillColor: '#000',
    strokeWidth: 2,
    filled: true,
    opacity: 1,
});

describe('creator layer operations', () => {
    it('moves a layer forward and returns its new selected index', () => {
        const result = moveLayer([image('back'), image('middle'), image('front')], 1, 'forward');

        expect(result.items.map((item) => item.id)).toEqual([
            'back',
            'front',
            'middle',
        ]);
        expect(result.selectedIndex).toBe(2);
    });

    it('does not move a layer beyond the stack edge', () => {
        const items = [image('back'), image('front')];

        expect(moveLayer(items, 1, 'forward')).toEqual({
            items,
            selectedIndex: 1,
        });
        expect(moveLayer(items, 0, 'backward')).toEqual({
            items,
            selectedIndex: 0,
        });
    });

    it('toggles legacy-visible layers without mutating the original', () => {
        const original = image('photo');

        const hidden = toggleLayerVisibility([original], 0);
        const visibleAgain = toggleLayerVisibility(hidden, 0);

        expect(hidden[0].visible).toBe(false);
        expect(visibleAgain[0].visible).toBe(true);
        expect(original.visible).toBeUndefined();
    });

    it('duplicates a static image with a unique id and visible offset', () => {
        const copy = duplicateImageLayer(image('photo'), 'photo-copy');

        expect(copy).toMatchObject({
            id: 'photo-copy',
            label: 'photo copy',
            x: 26,
            y: 36,
            visible: true,
        });
        expect(copy.eraseStrokes).toEqual([]);
    });

    it('preserves an independent copy of the visible erase mask', () => {
        const original = {
            ...image('masked-photo'),
            eraseStrokes: [
                {
                    points: [
                        { x: 8, y: 12 },
                        { x: 16, y: 20 },
                    ],
                    size: 24,
                    opacity: 0.75,
                },
            ],
        };

        const copy = duplicateImageLayer(original, 'masked-photo-copy');

        expect(copy.eraseStrokes).toEqual(original.eraseStrokes);
        expect(copy.eraseStrokes).not.toBe(original.eraseStrokes);
        expect(copy.eraseStrokes[0]).not.toBe(original.eraseStrokes[0]);
        expect(copy.eraseStrokes[0].points).not.toBe(
            original.eraseStrokes[0].points
        );
    });

    it('refuses to duplicate animated media whose decoded cache cannot be cloned', () => {
        expect(() => duplicateImageLayer(image('gif', true), 'gif-copy')).toThrow(
            'Animated GIF layers cannot be duplicated yet.'
        );
    });

    it('duplicates a shape with a unique id and visible offset', () => {
        const copy = duplicateShapeLayer(shape('arrow'), 'arrow-copy');

        expect(copy).toMatchObject({
            id: 'arrow-copy',
            x: 26,
            y: 36,
            visible: true,
        });
    });

    it('duplicates every part of an index-coupled text layer atomically', () => {
        const result = duplicateTextLayer(
            {
                texts: ['News just broke'],
                textBoxes: [
                    {
                        x: 10,
                        y: 20,
                        width: 200,
                        height: 80,
                        fontSize: 42,
                        minFont: 10,
                        align: 'center',
                    },
                ],
                rotations: [12],
                settings: [
                    {
                        visible: false,
                        fontSize: 42,
                        color: '#fff',
                        fontFamily: 'Impact',
                        fontWeight: '900',
                        letterSpacing: 0,
                        textCase: 'uppercase',
                        outline: { width: 2, color: '#000' },
                        shadow: {
                            blur: 4,
                            offsetX: 1,
                            offsetY: 1,
                            color: '#000',
                        },
                    },
                ],
            },
            0
        );

        expect(result.selectedIndex).toBe(1);
        expect(result.texts).toEqual(['News just broke', 'News just broke']);
        expect(result.textBoxes[1]).toMatchObject({ x: 26, y: 36 });
        expect(result.rotations).toEqual([12, 12]);
        expect(result.settings[1]).toMatchObject({
            visible: true,
            fontFamily: 'Impact',
        });
        expect(result.settings[1]).not.toBe(result.settings[0]);
    });

    it('moves every part of an index-coupled text layer atomically', () => {
        const firstBox = {
            x: 10,
            y: 20,
            width: 200,
            height: 80,
            fontSize: 42,
            minFont: 10,
            align: 'center' as const,
        };
        const secondBox = { ...firstBox, x: 40 };
        const setting = {
            fontSize: 42,
            color: '#fff',
            fontFamily: 'Impact',
            fontWeight: '900',
            letterSpacing: 0,
            textCase: 'uppercase' as const,
            outline: { width: 2, color: '#000' },
            shadow: {
                blur: 4,
                offsetX: 1,
                offsetY: 1,
                color: '#000',
            },
        };

        const moved = moveTextLayer(
            {
                texts: ['back', 'front'],
                textBoxes: [firstBox, secondBox],
                rotations: [0, 15],
                settings: [
                    { ...setting, color: '#fff' },
                    { ...setting, color: '#ffd400' },
                ],
            },
            0,
            'forward'
        );

        expect(moved.selectedIndex).toBe(1);
        expect(moved.texts).toEqual(['front', 'back']);
        expect(moved.textBoxes).toEqual([secondBox, firstBox]);
        expect(moved.rotations).toEqual([15, 0]);
        expect(moved.settings.map(({ color }) => color)).toEqual([
            '#ffd400',
            '#fff',
        ]);
    });

    it('prevents text reordering from crossing template and custom groups', () => {
        expect(
            canMoveTextLayerWithinGroup(0, 'forward', 2, 1)
        ).toBe(false);
        expect(
            canMoveTextLayerWithinGroup(1, 'backward', 2, 1)
        ).toBe(false);
        expect(
            canMoveTextLayerWithinGroup(0, 'forward', 3, 2)
        ).toBe(true);
        expect(
            canMoveTextLayerWithinGroup(2, 'forward', 3, 2)
        ).toBe(false);
    });

    it('fits or fills an image layer while preserving its source aspect ratio', () => {
        const wideImage = {
            ...image('wide'),
            originalWidth: 200,
            originalHeight: 100,
        };

        expect(
            fitImageLayerToCanvas(wideImage, 100, 100, 'fit')
        ).toMatchObject({
            x: 0,
            y: 25,
            width: 100,
            height: 50,
        });
        expect(
            fitImageLayerToCanvas(wideImage, 100, 100, 'fill')
        ).toMatchObject({
            x: -50,
            y: 0,
            width: 200,
            height: 100,
        });
    });

    it('fits against the visible rotated bounds instead of the unrotated box', () => {
        const rotatedWideImage = {
            ...image('rotated-wide'),
            originalWidth: 200,
            originalHeight: 100,
            rotation: 90,
        };

        expect(
            fitImageLayerToCanvas(rotatedWideImage, 100, 200, 'fit')
        ).toMatchObject({
            x: -50,
            y: 50,
            width: 200,
            height: 100,
            rotation: 90,
        });
    });

    it('fills the full canvas at arbitrary rotations without exposing corners', () => {
        const diagonalSquare = {
            ...image('diagonal-square'),
            originalWidth: 100,
            originalHeight: 100,
            rotation: 45,
        };

        const filled = fitImageLayerToCanvas(
            diagonalSquare,
            100,
            100,
            'fill'
        );

        expect(filled.width).toBeCloseTo(Math.SQRT2 * 100);
        expect(filled.height).toBeCloseTo(Math.SQRT2 * 100);
        expect(filled.x).toBeCloseTo((100 - Math.SQRT2 * 100) / 2);
        expect(filled.y).toBeCloseTo((100 - Math.SQRT2 * 100) / 2);
    });

    it('scales the erase mask with the resized image', () => {
        const maskedImage = {
            ...image('masked-resize'),
            width: 100,
            height: 50,
            originalWidth: 200,
            originalHeight: 100,
            eraseStrokes: [
                {
                    points: [{ x: 25, y: 10 }],
                    size: 20,
                    opacity: 1,
                },
            ],
        };

        const fitted = fitImageLayerToCanvas(
            maskedImage,
            400,
            200,
            'fit'
        );

        expect(fitted.eraseStrokes[0]).toMatchObject({
            points: [{ x: 100, y: 40 }],
            size: 80,
        });
    });

    it('keeps oversized fill layers movable across the cropped canvas area', () => {
        expect(
            constrainLayerPosition(
                { width: 200, height: 100 },
                { width: 100, height: 100 },
                { x: -40, y: 20 }
            )
        ).toEqual({ x: -40, y: 0 });

        expect(
            constrainLayerPosition(
                { width: 200, height: 100 },
                { width: 100, height: 100 },
                { x: -500, y: -20 }
            )
        ).toEqual({ x: -100, y: 0 });
    });

    it('keeps a minimum-size diagonal fill centered so no corner is exposed', () => {
        const filled = fitImageLayerToCanvas(
            {
                ...image('diagonal-fill'),
                originalWidth: 100,
                originalHeight: 100,
                rotation: 45,
            },
            100,
            100,
            'fill'
        );

        expect(
            constrainLayerPosition(
                filled,
                { width: 100, height: 100 },
                { x: filled.x + 1, y: filled.y }
            )
        ).toMatchObject({
            x: expect.closeTo(filled.x),
            y: expect.closeTo(filled.y),
        });
    });

    it.each([
        [45, -71.42135623730951, -0.710678118654755],
        [-45, -71.42135623730951, -40.710678118654755],
    ])(
        'preserves the safe local pan axis for a %s degree fill',
        (rotation, expectedX, expectedY) => {
            const filled = fitImageLayerToCanvas(
                {
                    ...image('wide-diagonal-fill'),
                    originalWidth: 200,
                    originalHeight: 100,
                    rotation,
                },
                100,
                100,
                'fill'
            );

            const constrained = constrainLayerPosition(
                filled,
                { width: 100, height: 100 },
                { x: filled.x + 40, y: filled.y }
            );

            expect(constrained.x).toBeCloseTo(expectedX);
            expect(constrained.y).toBeCloseTo(expectedY);
        }
    );
});
