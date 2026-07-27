// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderSceneToImageBlob } from './canvasExport';

describe('renderSceneToImageBlob', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('fits the rendered meme into a platform canvas without silently cropping it', async () => {
        const fillRect = vi.fn();
        const drawImage = vi.fn();
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillStyle: '',
            fillRect,
            drawImage,
        } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback, type) => callback(new Blob(['image'], { type: type || 'image/png' }))
        );
        const renderScene = vi.fn(async (canvas: HTMLCanvasElement) => {
            canvas.width = 800;
            canvas.height = 400;
        });

        const blob = await renderSceneToImageBlob(renderScene, 100, {
            width: 1080,
            height: 1080,
            mode: 'fit',
            mimeType: 'image/jpeg',
            quality: 0.82,
            backgroundColor: '#111111',
        });

        expect(renderScene).toHaveBeenCalledWith(
            expect.any(HTMLCanvasElement),
            {
                timeMs: 100,
                includeEditorControls: false,
                resetAnimations: false,
            }
        );
        expect(fillRect).toHaveBeenCalledWith(0, 0, 1080, 1080);
        expect(drawImage).toHaveBeenCalledWith(
            expect.any(HTMLCanvasElement),
            0,
            270,
            1080,
            540
        );
        expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
            expect.any(Function),
            'image/jpeg',
            0.82
        );
        expect(blob.type).toBe('image/jpeg');
    });

    it('uses the original rendered dimensions when no target is supplied', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
            fillStyle: '',
            fillRect: vi.fn(),
            drawImage: vi.fn(),
        } as unknown as CanvasRenderingContext2D);
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback, type) => callback(new Blob(['image'], { type: type || 'image/png' }))
        );
        const renderScene = vi.fn(async (canvas: HTMLCanvasElement) => {
            canvas.width = 640;
            canvas.height = 480;
        });

        await renderSceneToImageBlob(renderScene, 0, {
            mimeType: 'image/webp',
            quality: 0.9,
        });

        const encodedCanvas = (
            HTMLCanvasElement.prototype.toBlob as unknown as ReturnType<typeof vi.fn>
        ).mock.instances[0] as HTMLCanvasElement;
        expect(encodedCanvas.width).toBe(640);
        expect(encodedCanvas.height).toBe(480);
    });

    it('rejects a browser format fallback instead of mislabeling PNG bytes', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback) =>
                callback(new Blob(['image'], { type: 'image/png' }))
        );
        const renderScene = vi.fn(async (canvas: HTMLCanvasElement) => {
            canvas.width = 640;
            canvas.height = 480;
        });

        await expect(
            renderSceneToImageBlob(renderScene, 0, {
                mimeType: 'image/webp',
                quality: 0.9,
            })
        ).rejects.toThrow('could not encode image/webp');
    });

    it('rejects an encoded blob whose browser omits the requested MIME type', async () => {
        vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
            (callback) => callback(new Blob(['image']))
        );
        const renderScene = vi.fn(async (canvas: HTMLCanvasElement) => {
            canvas.width = 640;
            canvas.height = 480;
        });

        await expect(
            renderSceneToImageBlob(renderScene, 0, {
                mimeType: 'image/jpeg',
                quality: 0.9,
            })
        ).rejects.toThrow('could not verify image/jpeg encoding');
    });
});
