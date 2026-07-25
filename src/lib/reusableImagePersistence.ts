import type { ReusableImageAsset } from '@/types/creatorDiscovery';

export const REUSABLE_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const REUSABLE_IMAGE_FETCH_TIMEOUT_MS = 12_000;

const FILE_EXTENSIONS: Record<ReusableImageAsset['mimeType'], string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

function trustedAssetUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error('This image is not from a trusted Wikimedia source.');
    }
    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'upload.wikimedia.org'
    ) {
        throw new Error('This image is not from a trusted Wikimedia source.');
    }
    return url.toString();
}

function safeFileName(asset: ReusableImageAsset): string {
    const baseName =
        asset.title
            .normalize('NFKC')
            .replace(/[^\p{L}\p{N}]+/gu, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'wikimedia-image';
    return `${baseName}.${FILE_EXTENSIONS[asset.mimeType]}`;
}

async function readBoundedImageBlob(
    response: Response,
    mimeType: ReusableImageAsset['mimeType'],
    declaredLength: number | null
): Promise<Blob> {
    if (!response.body) {
        if (declaredLength === null) {
            throw new Error(
                'This reusable image could not be downloaded safely.'
            );
        }
        const blob = await response.blob();
        if (blob.size > REUSABLE_IMAGE_MAX_BYTES) {
            throw new Error('This reusable image is too large to save safely.');
        }
        return blob;
    }

    const reader = response.body.getReader();
    const chunks: ArrayBuffer[] = [];
    let receivedBytes = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        receivedBytes += value.byteLength;
        if (receivedBytes > REUSABLE_IMAGE_MAX_BYTES) {
            try {
                await reader.cancel();
            } catch {
                // The size guard has already stopped local buffering.
            }
            throw new Error('This reusable image is too large to save safely.');
        }
        const chunk = new Uint8Array(value.byteLength);
        chunk.set(value);
        chunks.push(chunk.buffer);
    }

    return new Blob(chunks, { type: mimeType });
}

export async function materializeReusableImage(
    asset: ReusableImageAsset,
    fetcher: typeof fetch = fetch
): Promise<File> {
    const assetUrl = trustedAssetUrl(asset.assetUrl);
    const response = await fetcher(assetUrl, {
        cache: 'force-cache',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(REUSABLE_IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error('The licensed image could not be downloaded.');
    }

    const declaredLengthValue = response.headers.get('content-length');
    const parsedDeclaredLength =
        declaredLengthValue === null
            ? null
            : Number(declaredLengthValue);
    const declaredLength =
        parsedDeclaredLength !== null &&
        Number.isSafeInteger(parsedDeclaredLength) &&
        parsedDeclaredLength >= 0
            ? parsedDeclaredLength
            : null;
    if (
        declaredLength !== null &&
        declaredLength > REUSABLE_IMAGE_MAX_BYTES
    ) {
        throw new Error('This reusable image is too large to save safely.');
    }

    const contentType = (response.headers.get('content-type') ?? '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase();
    if (contentType !== asset.mimeType) {
        throw new Error('The source returned an unexpected image format.');
    }

    const blob = await readBoundedImageBlob(
        response,
        asset.mimeType,
        declaredLength
    );
    if (blob.type && blob.type.toLowerCase() !== asset.mimeType) {
        throw new Error('The source returned an unexpected image format.');
    }

    return new File([blob], safeFileName(asset), {
        type: asset.mimeType,
        lastModified: Date.now(),
    });
}
