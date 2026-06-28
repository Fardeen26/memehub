import { describe, expect, it } from 'vitest';
import {
    PNG_EXPORT_MIME_TYPE,
    getAnimatedExportCapability,
    getStillExportMimeType,
} from '@/lib/exportCapabilities';

describe('exportCapabilities', () => {
    it('uses WebM when canvas capture and MediaRecorder support it', () => {
        const capability = getAnimatedExportCapability({
            hasCaptureStream: true,
            hasMediaRecorder: true,
            isTypeSupported: (mimeType) => mimeType === 'video/webm;codecs=vp8',
        });

        expect(capability).toEqual({
            format: 'webm',
            mimeType: 'video/webm;codecs=vp8',
        });
    });

    it('falls back to GIF when WebM recording is unavailable', () => {
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
