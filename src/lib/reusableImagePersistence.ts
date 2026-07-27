import type {
    DiscoveryImageAsset,
    ReusableImageAsset,
} from '@/types/creatorDiscovery';

export const REUSABLE_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
const REUSABLE_IMAGE_FETCH_TIMEOUT_MS = 12_000;

type SupportedStaticImageMime = ReusableImageAsset['mimeType'];

const FILE_EXTENSIONS: Record<SupportedStaticImageMime, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

function trustedAssetUrl(asset: DiscoveryImageAsset): string {
    if (asset.provider === 'SearXNG') {
        const relativeUrl = asset.assetUrl;
        if (
            relativeUrl.startsWith('/api/creator-discovery/image?') &&
            new URLSearchParams(relativeUrl.split('?', 2)[1]).has('url')
        ) {
            return relativeUrl;
        }
        throw new Error('This image is not from the trusted SearXNG relay.');
    }

    let url: URL;
    try {
        url = new URL(asset.assetUrl);
    } catch {
        throw new Error('This image is not from a trusted Wikimedia source.');
    }

    if (
        url.protocol !== 'https:' ||
        url.hostname !== 'upload.wikimedia.org' ||
        url.port ||
        url.username ||
        url.password
    ) {
        throw new Error('This image is not from a trusted Wikimedia source.');
    }

    return url.toString();
}

function safeFileName(
    asset: DiscoveryImageAsset,
    mimeType: SupportedStaticImageMime
): string {
    const baseName =
        asset.title
            .normalize('NFKC')
            .replace(/[^\p{L}\p{N}]+/gu, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'meme-image';
    return `${baseName}.${FILE_EXTENSIONS[mimeType]}`;
}

async function readBoundedImageBlob(
    response: Response,
    mimeType: string,
    declaredLength: number | null
): Promise<Blob> {
    if (!response.body) {
        if (declaredLength === null) {
            throw new Error('This image could not be downloaded safely.');
        }
        const blob = await response.blob();
        if (blob.size > REUSABLE_IMAGE_MAX_BYTES) {
            throw new Error('This image is too large to save safely.');
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
            throw new Error('This image is too large to save safely.');
        }
        const chunk = new Uint8Array(value.byteLength);
        chunk.set(value);
        chunks.push(chunk.buffer);
    }

    return new Blob(chunks, { type: mimeType });
}

async function sniffStaticImageMime(
    blob: Blob
): Promise<SupportedStaticImageMime | null> {
    const bytes = new Uint8Array(
        await blob.slice(0, 12).arrayBuffer()
    );
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    ) {
        return 'image/jpeg';
    }
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        return 'image/png';
    }
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return 'image/webp';
    }
    return null;
}

export async function materializeReusableImage(
    asset: DiscoveryImageAsset,
    fetcher: typeof fetch = fetch
): Promise<File> {
    const assetUrl = trustedAssetUrl(asset);
    const response = await fetcher(assetUrl, {
        cache: 'force-cache',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(REUSABLE_IMAGE_FETCH_TIMEOUT_MS),
    });
    if (response.redirected) {
        throw new Error('The image download was redirected and blocked.');
    }
    if (!response.ok) {
        throw new Error('The image could not be downloaded.');
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
        throw new Error('This image is too large to save safely.');
    }

    const contentType = (response.headers.get('content-type') ?? '')
        .split(';', 1)[0]
        .trim()
        .toLowerCase();

    if (asset.provider === 'Wikimedia Commons') {
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

        return new File([blob], safeFileName(asset, asset.mimeType), {
            type: asset.mimeType,
            lastModified: Date.now(),
        });
    }

    if (
        contentType !== 'application/octet-stream' &&
        !Object.hasOwn(FILE_EXTENSIONS, contentType)
    ) {
        throw new Error('The source returned an unexpected image format.');
    }

    const blob = await readBoundedImageBlob(
        response,
        contentType,
        declaredLength
    );
    const detectedMimeType = await sniffStaticImageMime(blob);
    if (!detectedMimeType) {
        throw new Error('The source returned an unexpected image format.');
    }

    return new File([blob], safeFileName(asset, detectedMimeType), {
        type: detectedMimeType,
        lastModified: Date.now(),
    });
}
