import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import packageJson from '../../package.json';

describe('Next image configuration', () => {
    it('uses remote patterns and explicitly allows the gallery image quality', () => {
        expect(nextConfig.images?.domains).toBeUndefined();
        expect(nextConfig.images?.qualities).toContain(85);
        expect(
            nextConfig.images?.remotePatterns?.map((pattern) => pattern.hostname)
        ).toEqual(
            expect.arrayContaining([
                'cloudinary.com',
                'res.cloudinary.com',
                'i.imgflip.com',
                'media.giphy.com',
                'i.giphy.com',
            ])
        );
    });

    it('declares the Node versions supported by the build and test toolchain', () => {
        expect(packageJson.engines.node).toBe(
            '^20.19.0 || ^22.13.0 || >=24.0.0'
        );
    });
});
