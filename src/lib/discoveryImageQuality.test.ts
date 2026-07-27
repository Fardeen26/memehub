import { describe, expect, it } from 'vitest';
import {
    getTemplateImageTooSmallMessage,
    isTemplateImageTooSmall,
} from './discoveryImageQuality';

describe('discovery image quality', () => {
    it('rejects thumbnail-sized images for templates', () => {
        expect(isTemplateImageTooSmall(150, 150)).toBe(true);
        expect(isTemplateImageTooSmall(640, 360)).toBe(false);
    });

    it('formats a clear error message for small templates', () => {
        expect(getTemplateImageTooSmallMessage(150, 150)).toContain('150 × 150');
    });
});
