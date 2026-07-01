import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    buildCloudinaryMp4Url,
    uploadVideoCaptureToCloudinary,
    waitForCloudinaryMp4,
} from '@/lib/cloudinaryVideoExport';

describe('cloudinaryVideoExport', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds a forced H.264 MP4 download URL', () => {
        const url = buildCloudinaryMp4Url(
            {
                cloudName: 'demo',
                deliveryBaseUrl: 'https://res.cloudinary.com/',
                publicId: 'memehub/generated-exports/meme-123',
            },
            { attachment: true, filename: 'meme' }
        );

        expect(url).toBe(
            'https://res.cloudinary.com/demo/video/upload/c_limit,w_1080,h_1080/q_auto:good/vc_h264/fl_attachment:meme/memehub/generated-exports/meme-123.mp4'
        );
    });

    it('waits until Cloudinary returns a ready MP4 response', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 423 })
            .mockResolvedValueOnce({ ok: true, status: 200 });
        vi.stubGlobal('fetch', fetchMock);

        await expect(
            waitForCloudinaryMp4('https://example.test/video.mp4', {
                pollIntervalMs: 1,
                timeoutMs: 100,
            })
        ).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('rejects captures larger than the signed upload limit before uploading', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                allowedFormats: 'mp4,webm,mov',
                apiKey: 'key',
                cloudName: 'demo',
                deliveryBaseUrl: 'https://res.cloudinary.com',
                folder: 'memehub/generated-exports',
                maxFileSize: '1',
                overwrite: 'false',
                publicId: 'meme-123',
                signature: 'signature',
                tags: 'memehub-export,temp-export',
                timestamp: 1,
                uploadUrl: 'https://api.cloudinary.com/v1_1/demo/video/upload',
            }),
        });
        vi.stubGlobal('fetch', fetchMock);

        await expect(uploadVideoCaptureToCloudinary(new Blob(['too-large']))).rejects.toThrow(
            'Video export is too large to upload.'
        );

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
