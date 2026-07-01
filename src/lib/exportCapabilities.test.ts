import { describe, expect, it } from 'vitest';
import {
    MP4_EXPORT_MIME_TYPE,
    PNG_EXPORT_MIME_TYPE,
    getAnimatedExportCapability,
    getStillExportMimeType,
} from '@/lib/exportCapabilities';

describe('exportCapabilities', () => {
    it('uses MP4 export when browser video capture is available', () => {
        const capability = getAnimatedExportCapability({
            hasCaptureStream: true,
            hasMediaRecorder: true,
            isTypeSupported: (mimeType) => mimeType === 'video/webm;codecs=vp8',
        });

        expect(capability).toEqual({
            format: 'mp4',
            mimeType: MP4_EXPORT_MIME_TYPE,
            captureMimeType: 'video/webm;codecs=vp8',
        });
    });

    it('prefers native MP4 capture when the browser supports it', () => {
        const capability = getAnimatedExportCapability({
            hasCaptureStream: true,
            hasMediaRecorder: true,
            isTypeSupported: (mimeType) => mimeType === 'video/mp4',
        });

        expect(capability).toEqual({
            format: 'mp4',
            mimeType: MP4_EXPORT_MIME_TYPE,
            captureMimeType: 'video/mp4',
        });
    });

    it('falls back to GIF when video recording is unavailable', () => {
        expect(
            getAnimatedExportCapability({
                hasCaptureStream: false,
                hasMediaRecorder: true,
            })
        ).toEqual({ format: 'gif', mimeType: 'image/gif' });
    });

    it('always uses PNG for still exports and copy', () => {
        expect(getStillExportMimeType()).toBe(PNG_EXPORT_MIME_TYPE);
    });
});
