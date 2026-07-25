import { describe, expect, it } from 'vitest';
import {
    fitWatermarkFontSize,
    getWatermarkCoordinates,
    type WatermarkPosition,
} from './creatorBranding';

describe('creator watermark placement', () => {
    it.each([
        ['top-left', { x: 10, y: 10, textAlign: 'left', textBaseline: 'top' }],
        ['top-right', { x: 990, y: 10, textAlign: 'right', textBaseline: 'top' }],
        [
            'bottom-left',
            { x: 10, y: 790, textAlign: 'left', textBaseline: 'bottom' },
        ],
        [
            'bottom-right',
            { x: 990, y: 790, textAlign: 'right', textBaseline: 'bottom' },
        ],
    ] as const)(
        'places the watermark at %s inside the canvas safe edge',
        (position, expected) => {
            expect(
                getWatermarkCoordinates(
                    position as WatermarkPosition,
                    1000,
                    800,
                    10
                )
            ).toEqual(expected);
        }
    );

    it('shrinks a long handle to the available safe width', () => {
        expect(
            fitWatermarkFontSize({
                initialFontSize: 24,
                maxWidth: 120,
                measureWidth: () => 240,
                minFontSize: 8,
            })
        ).toBe(12);
    });

    it('keeps branding inside the safe width even on a tiny canvas', () => {
        expect(
            fitWatermarkFontSize({
                initialFontSize: 20,
                maxWidth: 20,
                measureWidth: () => 200,
                minFontSize: 8,
            })
        ).toBe(2);
    });
});
