import { describe, expect, it } from 'vitest';
import {
    CREATOR_EXPORT_PROFILES,
    STILL_IMAGE_FORMATS,
    buildCreatorExportFilename,
    calculateImagePlacement,
    resolveCreatorExportDimensions,
} from './creatorExport';

describe('creator export profiles', () => {
    it('defines creator-friendly still-image targets without default cropping', () => {
        expect(CREATOR_EXPORT_PROFILES).toMatchObject({
            original: {
                id: 'original',
                size: { mode: 'original' },
                defaultFormat: 'png',
                defaultPlacement: 'fit',
            },
            'instagram-square': {
                id: 'instagram-square',
                size: { mode: 'fixed', width: 1080, height: 1080 },
                defaultFormat: 'png',
                defaultPlacement: 'fit',
            },
            'instagram-portrait': {
                id: 'instagram-portrait',
                size: { mode: 'fixed', width: 1080, height: 1350 },
                defaultFormat: 'png',
                defaultPlacement: 'fit',
            },
            'instagram-story': {
                id: 'instagram-story',
                size: { mode: 'fixed', width: 1080, height: 1920 },
                defaultFormat: 'png',
                defaultPlacement: 'fit',
            },
            'whatsapp-compressed': {
                id: 'whatsapp-compressed',
                size: { mode: 'max-width', width: 1080, upscale: false },
                defaultFormat: 'jpeg',
                defaultQuality: 0.82,
                defaultPlacement: 'fit',
            },
        });
    });

    it('keeps original dimensions and resolves fixed-size profiles', () => {
        expect(
            resolveCreatorExportDimensions('original', {
                width: 1600,
                height: 900,
            })
        ).toEqual({ width: 1600, height: 900 });

        expect(
            resolveCreatorExportDimensions('instagram-portrait', {
                width: 1600,
                height: 900,
            })
        ).toEqual({ width: 1080, height: 1350 });
    });

    it('compresses wide WhatsApp exports to 1080px without upscaling smaller work', () => {
        expect(
            resolveCreatorExportDimensions('whatsapp-compressed', {
                width: 2160,
                height: 1080,
            })
        ).toEqual({ width: 1080, height: 540 });

        expect(
            resolveCreatorExportDimensions('whatsapp-compressed', {
                width: 720,
                height: 1280,
            })
        ).toEqual({ width: 720, height: 1280 });
    });

    it('rejects invalid source dimensions', () => {
        expect(() =>
            resolveCreatorExportDimensions('original', {
                width: 0,
                height: 900,
            })
        ).toThrow('Source dimensions must be positive finite numbers.');
    });
});

describe('still-image format metadata', () => {
    it('describes browser export formats and their quality/transparency behavior', () => {
        expect(STILL_IMAGE_FORMATS).toEqual({
            png: {
                id: 'png',
                label: 'PNG',
                mimeType: 'image/png',
                extension: 'png',
                supportsTransparency: true,
                supportsQuality: false,
            },
            jpeg: {
                id: 'jpeg',
                label: 'JPEG',
                mimeType: 'image/jpeg',
                extension: 'jpg',
                supportsTransparency: false,
                supportsQuality: true,
                defaultQuality: 0.9,
            },
            webp: {
                id: 'webp',
                label: 'WebP',
                mimeType: 'image/webp',
                extension: 'webp',
                supportsTransparency: true,
                supportsQuality: true,
                defaultQuality: 0.9,
            },
        });
    });
});

describe('image placement', () => {
    it('fits by default so changing profile never silently crops the meme', () => {
        expect(
            calculateImagePlacement({
                sourceWidth: 1600,
                sourceHeight: 900,
                targetWidth: 1080,
                targetHeight: 1080,
            })
        ).toEqual({
            mode: 'fit',
            x: 0,
            y: 236.25,
            width: 1080,
            height: 607.5,
            scale: 0.675,
            cropped: false,
        });
    });

    it('crops only when cover is explicitly requested', () => {
        expect(
            calculateImagePlacement({
                sourceWidth: 1600,
                sourceHeight: 900,
                targetWidth: 1080,
                targetHeight: 1080,
                mode: 'cover',
            })
        ).toEqual({
            mode: 'cover',
            x: -420,
            y: 0,
            width: 1920,
            height: 1080,
            scale: 1.2,
            cropped: true,
        });
    });

    it('rejects invalid placement dimensions instead of producing invalid canvas values', () => {
        expect(() =>
            calculateImagePlacement({
                sourceWidth: Number.NaN,
                sourceHeight: 900,
                targetWidth: 1080,
                targetHeight: 1080,
            })
        ).toThrow('Placement dimensions must be positive finite numbers.');
    });
});

describe('creator export filenames', () => {
    it('creates a predictable filename and uses the conventional JPEG extension', () => {
        expect(
            buildCreatorExportFilename({
                baseName: 'Election Reaction.png',
                profileId: 'instagram-portrait',
                format: 'jpeg',
            })
        ).toBe('election-reaction-instagram-portrait.jpg');
    });

    it('keeps meaningful Indic characters in downloaded filenames', () => {
        expect(
            buildCreatorExportFilename({
                baseName: 'भारत वाला मीम',
                profileId: 'instagram-story',
                format: 'webp',
            })
        ).toBe('भारत-वाला-मीम-instagram-story.webp');
    });

    it('falls back to a safe name when the title has no usable characters', () => {
        expect(
            buildCreatorExportFilename({
                baseName: ' /..! ',
                profileId: 'original',
                format: 'png',
            })
        ).toBe('meme-original.png');
    });
});
