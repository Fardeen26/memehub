import { describe, expect, it } from 'vitest';
import {
    copyBytesToArrayBuffer,
    getContainedEvenDimensions,
} from '@/lib/canvasExport';

describe('canvasExport', () => {
    it('caps export dimensions to 1080 while preserving the aspect ratio closely', () => {
        expect(getContainedEvenDimensions(1920, 1080)).toEqual({ width: 1080, height: 606 });
    });

    it('returns even dimensions for H.264-friendly video export', () => {
        expect(getContainedEvenDimensions(501, 333)).toEqual({ width: 500, height: 332 });
    });

    it('copies encoder bytes into an owned ArrayBuffer for Blob export', () => {
        const sharedBytes = new Uint8Array(new SharedArrayBuffer(4));
        sharedBytes.set([71, 73, 70, 56]);

        const ownedBuffer = copyBytesToArrayBuffer(sharedBytes);

        expect(ownedBuffer).toBeInstanceOf(ArrayBuffer);
        expect(Array.from(new Uint8Array(ownedBuffer))).toEqual([71, 73, 70, 56]);
    });
});
