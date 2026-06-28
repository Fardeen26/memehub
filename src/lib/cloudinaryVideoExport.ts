export const CLOUDINARY_MP4_READY_TIMEOUT_MS = 30_000;
export const CLOUDINARY_MP4_POLL_INTERVAL_MS = 1_500;
export const CLOUDINARY_MP4_MAX_DIMENSION = 1080;

export type CloudinaryVideoUploadSignature = {
    apiKey: string;
    cloudName: string;
    deliveryBaseUrl: string;
    folder: string;
    overwrite: string;
    publicId: string;
    signature: string;
    tags: string;
    timestamp: number;
    uploadUrl: string;
};

export type CloudinaryVideoUploadResult = {
    cloudName: string;
    deliveryBaseUrl: string;
    publicId: string;
    secureUrl: string;
};

type CloudinaryUploadApiResponse = {
    public_id?: string;
    secure_url?: string;
    error?: { message?: string };
};

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodePublicId(publicId: string): string {
    return publicId.split('/').map(encodeURIComponent).join('/');
}

function getCaptureFilename(blob: Blob): string {
    if (/mp4/i.test(blob.type)) return 'meme-capture.mp4';
    return 'meme-capture.webm';
}

export function buildCloudinaryMp4Url(
    input: { cloudName: string; publicId: string; deliveryBaseUrl?: string },
    options: { attachment?: boolean; filename?: string } = {}
): string {
    const baseUrl = (input.deliveryBaseUrl || 'https://res.cloudinary.com').replace(/\/$/, '');
    const transformations = [
        `c_limit,w_${CLOUDINARY_MP4_MAX_DIMENSION},h_${CLOUDINARY_MP4_MAX_DIMENSION}`,
        'q_auto:good',
        'vc_h264',
    ];

    if (options.attachment) {
        transformations.push(`fl_attachment:${options.filename || 'meme'}`);
    }

    return `${baseUrl}/${input.cloudName}/video/upload/${transformations.join('/')}/${encodePublicId(input.publicId)}.mp4`;
}

export async function getCloudinaryVideoUploadSignature(): Promise<CloudinaryVideoUploadSignature> {
    const response = await fetch('/api/cloudinary/video-upload-signature', {
        method: 'POST',
        cache: 'no-store',
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.error || 'Cloudinary video export is not configured.');
    }

    return data as CloudinaryVideoUploadSignature;
}

export async function uploadVideoCaptureToCloudinary(
    blob: Blob
): Promise<CloudinaryVideoUploadResult> {
    const signature = await getCloudinaryVideoUploadSignature();
    const formData = new FormData();

    formData.append('file', blob, getCaptureFilename(blob));
    formData.append('api_key', signature.apiKey);
    formData.append('timestamp', String(signature.timestamp));
    formData.append('signature', signature.signature);
    formData.append('folder', signature.folder);
    formData.append('public_id', signature.publicId);
    formData.append('tags', signature.tags);
    formData.append('overwrite', signature.overwrite);

    const response = await fetch(signature.uploadUrl, {
        method: 'POST',
        body: formData,
    });
    const data = (await response.json().catch(() => null)) as CloudinaryUploadApiResponse | null;

    if (!response.ok || !data?.public_id || !data.secure_url) {
        throw new Error(data?.error?.message || 'Cloudinary video upload failed.');
    }

    return {
        cloudName: signature.cloudName,
        deliveryBaseUrl: signature.deliveryBaseUrl,
        publicId: data.public_id,
        secureUrl: data.secure_url,
    };
}

export async function waitForCloudinaryMp4(
    url: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<void> {
    const timeoutMs = options.timeoutMs ?? CLOUDINARY_MP4_READY_TIMEOUT_MS;
    const pollIntervalMs = options.pollIntervalMs ?? CLOUDINARY_MP4_POLL_INTERVAL_MS;
    const deadline = Date.now() + timeoutMs;
    let lastError: unknown = null;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, {
                method: 'HEAD',
                cache: 'no-store',
            });

            if (response.ok) return;

            if (![404, 420, 423].includes(response.status) && response.status >= 400) {
                throw new Error(`MP4 export is not available (${response.status}).`);
            }
        } catch (error) {
            lastError = error;
        }

        await delay(pollIntervalMs);
    }

    if (lastError instanceof Error) {
        throw new Error(`MP4 export did not finish in time. ${lastError.message}`);
    }

    throw new Error('MP4 export did not finish in time.');
}

export function downloadRemoteUrl(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
}
