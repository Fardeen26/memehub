import { describe, expect, it } from 'vitest';
import { createFrameCoalescer } from './frameCoalescer';

describe('createFrameCoalescer', () => {
    it('commits only the latest update in a single animation frame', () => {
        let scheduledFrame: FrameRequestCallback | undefined;
        const committed: string[] = [];
        const coalescer = createFrameCoalescer(
            (value: string) => committed.push(value),
            (callback) => {
                scheduledFrame = callback;
                return 1;
            },
            () => undefined
        );

        coalescer.schedule('first');
        coalescer.schedule('latest');

        expect(committed).toEqual([]);
        expect(scheduledFrame).toBeTypeOf('function');

        scheduledFrame?.(0);

        expect(committed).toEqual(['latest']);
    });

    it('cancels a pending animation-frame update', () => {
        let scheduledFrame: FrameRequestCallback | undefined;
        let cancelledFrame: number | undefined;
        const coalescer = createFrameCoalescer(
            () => undefined,
            (callback) => {
                scheduledFrame = callback;
                return 7;
            },
            (frame) => {
                cancelledFrame = frame;
            }
        );

        coalescer.schedule('pending');
        coalescer.cancel();

        expect(scheduledFrame).toBeTypeOf('function');
        expect(cancelledFrame).toBe(7);
    });
});
