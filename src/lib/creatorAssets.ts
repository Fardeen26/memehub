export const CREATOR_ASSET_DATABASE_NAME = 'memehub-creator-assets';
export const CREATOR_ASSET_MAX_BYTES = 5 * 1024 * 1024;
export const CREATOR_ASSET_MAX_PIXELS = 16_000_000;
export const CREATOR_ASSET_MAX_DIMENSION = 8_192;
export const CREATOR_ASSET_TOTAL_BYTES_LIMIT = 40 * 1024 * 1024;
export const CREATOR_ASSET_LIMIT = 30;

const CREATOR_ASSET_DATABASE_VERSION = 2;
const CREATOR_ASSET_METADATA_STORE_NAME = 'assets';
const CREATOR_ASSET_BLOB_STORE_NAME = 'asset-blobs';
const SUPPORTED_CREATOR_ASSET_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
]);

export type CreatorAssetErrorCode =
    | 'unsupported-type'
    | 'too-large'
    | 'dimensions-too-large'
    | 'quota-exceeded'
    | 'asset-limit-reached'
    | 'library-size-reached';

const CREATOR_ASSET_ERROR_MESSAGES: Record<
    CreatorAssetErrorCode,
    string
> = {
    'unsupported-type': 'Only PNG, JPEG, and WebP images can be saved.',
    'too-large': 'Creator assets must be 5 MB or smaller.',
    'dimensions-too-large':
        'Creator assets must be 16 megapixels or smaller, with no side longer than 8192 pixels.',
    'quota-exceeded':
        'Browser storage is full. Delete an asset or free some space and try again.',
    'asset-limit-reached':
        'Your creator asset library is full. Delete an asset before adding another.',
    'library-size-reached':
        'Your creator asset library has reached 40 MB. Delete an asset before adding another.',
};

export class CreatorAssetError extends Error {
    readonly code: CreatorAssetErrorCode;

    constructor(code: CreatorAssetErrorCode) {
        super(CREATOR_ASSET_ERROR_MESSAGES[code]);
        this.name = 'CreatorAssetError';
        this.code = code;
    }
}

export type CreatorAssetMetadata = {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: number;
    lastUsedAt: number;
};

export type CreatorAsset = CreatorAssetMetadata & {
    blob: Blob;
};

export type SaveCreatorAssetInput = {
    blob: Blob;
    name: string;
};

type StoredCreatorAssetBlob = {
    id: string;
    bytes: ArrayBuffer;
};

type LegacyStoredCreatorAsset = CreatorAssetMetadata & {
    bytes: ArrayBuffer;
};

let fallbackIdSequence = 0;

function createAssetId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    fallbackIdSequence += 1;
    return [
        'creator-asset',
        Date.now().toString(36),
        fallbackIdSequence.toString(36),
        Math.random().toString(36).slice(2),
    ].join('-');
}

function mapStorageError(error: unknown): unknown {
    if (error instanceof CreatorAssetError) return error;
    if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'QuotaExceededError'
    ) {
        return new CreatorAssetError('quota-exceeded');
    }
    return error;
}

function validateAsset(blob: Blob): void {
    if (!SUPPORTED_CREATOR_ASSET_TYPES.has(blob.type.toLowerCase())) {
        throw new CreatorAssetError('unsupported-type');
    }
    if (blob.size > CREATOR_ASSET_MAX_BYTES) {
        throw new CreatorAssetError('too-large');
    }
}

async function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
    if (typeof blob.arrayBuffer === 'function') {
        return blob.arrayBuffer();
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(reader.result);
            } else {
                reject(new Error('Creator asset could not be read.'));
            }
        };
        reader.onerror = () =>
            reject(reader.error ?? new Error('Creator asset could not be read.'));
        reader.readAsArrayBuffer(blob);
    });
}

type ImageDimensions = {
    width: number;
    height: number;
};

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
    if (
        bytes.length < 24 ||
        bytes[0] !== 137 ||
        bytes[1] !== 80 ||
        bytes[2] !== 78 ||
        bytes[3] !== 71 ||
        bytes[12] !== 73 ||
        bytes[13] !== 72 ||
        bytes[14] !== 68 ||
        bytes[15] !== 82
    ) {
        return null;
    }

    const view = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
    );
    return {
        width: view.getUint32(16),
        height: view.getUint32(20),
    };
}

const JPEG_START_OF_FRAME_MARKERS = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
    0xcf,
]);

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
        return null;
    }

    let offset = 2;
    while (offset + 8 < bytes.length) {
        if (bytes[offset] !== 0xff) {
            offset += 1;
            continue;
        }
        while (offset < bytes.length && bytes[offset] === 0xff) {
            offset += 1;
        }
        const marker = bytes[offset];
        offset += 1;
        if (marker === 0xd8 || marker === 0x01) continue;
        if (marker === 0xd9 || marker === 0xda || offset + 1 >= bytes.length) {
            break;
        }

        const segmentLength = (bytes[offset] << 8) | bytes[offset + 1];
        if (segmentLength < 2 || offset + segmentLength > bytes.length) {
            return null;
        }
        if (
            JPEG_START_OF_FRAME_MARKERS.has(marker) &&
            segmentLength >= 7
        ) {
            return {
                height: (bytes[offset + 3] << 8) | bytes[offset + 4],
                width: (bytes[offset + 5] << 8) | bytes[offset + 6],
            };
        }
        offset += segmentLength;
    }

    return null;
}

function matchesAscii(
    bytes: Uint8Array,
    offset: number,
    text: string
): boolean {
    if (offset + text.length > bytes.length) return false;
    return Array.from(text).every(
        (character, index) =>
            bytes[offset + index] === character.charCodeAt(0)
    );
}

function readWebpDimensions(bytes: Uint8Array): ImageDimensions | null {
    if (
        bytes.length < 30 ||
        !matchesAscii(bytes, 0, 'RIFF') ||
        !matchesAscii(bytes, 8, 'WEBP')
    ) {
        return null;
    }

    if (matchesAscii(bytes, 12, 'VP8X')) {
        return {
            width:
                1 +
                bytes[24] +
                (bytes[25] << 8) +
                (bytes[26] << 16),
            height:
                1 +
                bytes[27] +
                (bytes[28] << 8) +
                (bytes[29] << 16),
        };
    }

    if (
        matchesAscii(bytes, 12, 'VP8 ') &&
        bytes[23] === 0x9d &&
        bytes[24] === 0x01 &&
        bytes[25] === 0x2a
    ) {
        return {
            width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
            height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
        };
    }

    if (matchesAscii(bytes, 12, 'VP8L') && bytes[20] === 0x2f) {
        return {
            width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
            height:
                1 +
                ((bytes[22] & 0xc0) >> 6) +
                (bytes[23] << 2) +
                ((bytes[24] & 0x0f) << 10),
        };
    }

    return null;
}

function validateAssetDimensions(
    bytes: ArrayBuffer,
    mimeType: string
): void {
    const view = new Uint8Array(bytes);
    const dimensions =
        mimeType === 'image/png'
            ? readPngDimensions(view)
            : mimeType === 'image/jpeg'
              ? readJpegDimensions(view)
              : mimeType === 'image/webp'
                ? readWebpDimensions(view)
                : null;
    if (!dimensions) return;

    const { width, height } = dimensions;
    if (
        width <= 0 ||
        height <= 0 ||
        width > CREATOR_ASSET_MAX_DIMENSION ||
        height > CREATOR_ASSET_MAX_DIMENSION ||
        width > CREATOR_ASSET_MAX_PIXELS / height
    ) {
        throw new CreatorAssetError('dimensions-too-large');
    }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function abortTransaction(transaction: IDBTransaction): void {
    try {
        transaction.abort();
    } catch {
        // A transaction that already completed has nothing left to roll back.
    }
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
            reject(
                transaction.error ??
                    new Error('Creator asset transaction was aborted.')
            );
    });
}

function isLegacyStoredCreatorAsset(
    value: unknown
): value is LegacyStoredCreatorAsset {
    return (
        typeof value === 'object' &&
        value !== null &&
        'id' in value &&
        typeof value.id === 'string' &&
        'bytes' in value &&
        typeof value.bytes === 'object' &&
        value.bytes !== null &&
        'byteLength' in value.bytes &&
        typeof value.bytes.byteLength === 'number'
    );
}

function migrateLegacyAssetRecords(
    transaction: IDBTransaction,
    blobStore: IDBObjectStore
): void {
    const metadataStore = transaction.objectStore(
        CREATOR_ASSET_METADATA_STORE_NAME
    );
    const cursorRequest = metadataStore.openCursor();

    cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;

        const value: unknown = cursor.value;
        if (isLegacyStoredCreatorAsset(value)) {
            const { bytes, ...metadata } = value;
            blobStore.put({ id: metadata.id, bytes });
            cursor.update(metadata);
        }
        cursor.continue();
    };
}

function openCreatorAssetDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(
            CREATOR_ASSET_DATABASE_NAME,
            CREATOR_ASSET_DATABASE_VERSION
        );

        request.onupgradeneeded = (event) => {
            const database = request.result;
            const transaction = request.transaction;
            if (!transaction) return;

            if (
                !database.objectStoreNames.contains(
                    CREATOR_ASSET_METADATA_STORE_NAME
                )
            ) {
                database.createObjectStore(
                    CREATOR_ASSET_METADATA_STORE_NAME,
                    { keyPath: 'id' }
                );
            }

            const blobStore = database.objectStoreNames.contains(
                CREATOR_ASSET_BLOB_STORE_NAME
            )
                ? transaction.objectStore(CREATOR_ASSET_BLOB_STORE_NAME)
                : database.createObjectStore(
                      CREATOR_ASSET_BLOB_STORE_NAME,
                      { keyPath: 'id' }
                  );

            if ((event.oldVersion ?? 0) < 2) {
                migrateLegacyAssetRecords(transaction, blobStore);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function sortCreatorAssets(
    assets: CreatorAssetMetadata[]
): CreatorAssetMetadata[] {
    return assets.sort((left, right) => {
        const recentDifference = right.lastUsedAt - left.lastUsedAt;
        if (recentDifference !== 0) return recentDifference;

        const creationDifference = right.createdAt - left.createdAt;
        if (creationDifference !== 0) return creationDifference;

        return left.id.localeCompare(right.id);
    });
}

export async function saveCreatorAsset({
    blob,
    name,
}: SaveCreatorAssetInput): Promise<CreatorAsset> {
    validateAsset(blob);

    const bytes = await readBlobBytes(blob);
    const now = Date.now();
    const metadata: CreatorAssetMetadata = {
        id: createAssetId(),
        name,
        mimeType: blob.type.toLowerCase(),
        size: blob.size,
        createdAt: now,
        lastUsedAt: now,
    };
    validateAssetDimensions(bytes, metadata.mimeType);
    const storedBlob: StoredCreatorAssetBlob = {
        id: metadata.id,
        bytes,
    };
    let database: IDBDatabase | undefined;

    try {
        database = await openCreatorAssetDatabase();
        const transaction = database.transaction(
            [
                CREATOR_ASSET_METADATA_STORE_NAME,
                CREATOR_ASSET_BLOB_STORE_NAME,
            ],
            'readwrite'
        );
        try {
            const metadataStore = transaction.objectStore(
                CREATOR_ASSET_METADATA_STORE_NAME
            );
            const existingMetadata = (await requestResult(
                metadataStore.getAll()
            )) as CreatorAssetMetadata[];

            if (existingMetadata.length >= CREATOR_ASSET_LIMIT) {
                await transactionCompleted(transaction);
                throw new CreatorAssetError('asset-limit-reached');
            }

            const currentBytes = existingMetadata.reduce(
                (total, asset) => total + asset.size,
                0
            );
            if (
                currentBytes + metadata.size >
                CREATOR_ASSET_TOTAL_BYTES_LIMIT
            ) {
                await transactionCompleted(transaction);
                throw new CreatorAssetError('library-size-reached');
            }

            const metadataRequest = metadataStore.add(metadata);
            const blobRequest = transaction
                .objectStore(CREATOR_ASSET_BLOB_STORE_NAME)
                .add(storedBlob);
            await Promise.all([
                requestResult(metadataRequest),
                requestResult(blobRequest),
                transactionCompleted(transaction),
            ]);
            return { ...metadata, blob };
        } catch (error) {
            abortTransaction(transaction);
            throw error;
        }
    } catch (error) {
        throw mapStorageError(error);
    } finally {
        database?.close();
    }
}

export async function listCreatorAssets(): Promise<
    CreatorAssetMetadata[]
> {
    const database = await openCreatorAssetDatabase();

    try {
        const transaction = database.transaction(
            CREATOR_ASSET_METADATA_STORE_NAME,
            'readonly'
        );
        const request = transaction
            .objectStore(CREATOR_ASSET_METADATA_STORE_NAME)
            .getAll();
        const [metadata] = await Promise.all([
            requestResult(request) as Promise<CreatorAssetMetadata[]>,
            transactionCompleted(transaction),
        ]);

        return sortCreatorAssets(metadata);
    } catch (error) {
        throw mapStorageError(error);
    } finally {
        database.close();
    }
}

export async function loadCreatorAsset(
    id: string
): Promise<CreatorAsset | null> {
    const database = await openCreatorAssetDatabase();

    try {
        const transaction = database.transaction(
            [
                CREATOR_ASSET_METADATA_STORE_NAME,
                CREATOR_ASSET_BLOB_STORE_NAME,
            ],
            'readonly'
        );
        const metadataRequest = transaction
            .objectStore(CREATOR_ASSET_METADATA_STORE_NAME)
            .get(id);
        const blobRequest = transaction
            .objectStore(CREATOR_ASSET_BLOB_STORE_NAME)
            .get(id);
        const [metadata, storedBlob] = await Promise.all([
            requestResult(metadataRequest) as Promise<
                CreatorAssetMetadata | undefined
            >,
            requestResult(blobRequest) as Promise<
                StoredCreatorAssetBlob | undefined
            >,
            transactionCompleted(transaction),
        ]);

        if (!metadata || !storedBlob) return null;
        return {
            ...metadata,
            blob: new Blob([storedBlob.bytes], {
                type: metadata.mimeType,
            }),
        };
    } catch (error) {
        throw mapStorageError(error);
    } finally {
        database.close();
    }
}

export async function deleteCreatorAsset(id: string): Promise<void> {
    let database: IDBDatabase | undefined;

    try {
        database = await openCreatorAssetDatabase();
        const transaction = database.transaction(
            [
                CREATOR_ASSET_METADATA_STORE_NAME,
                CREATOR_ASSET_BLOB_STORE_NAME,
            ],
            'readwrite'
        );
        try {
            const metadataRequest = transaction
                .objectStore(CREATOR_ASSET_METADATA_STORE_NAME)
                .delete(id);
            const blobRequest = transaction
                .objectStore(CREATOR_ASSET_BLOB_STORE_NAME)
                .delete(id);
            await Promise.all([
                requestResult(metadataRequest),
                requestResult(blobRequest),
                transactionCompleted(transaction),
            ]);
        } catch (error) {
            abortTransaction(transaction);
            throw error;
        }
    } catch (error) {
        throw mapStorageError(error);
    } finally {
        database?.close();
    }
}

export async function touchCreatorAsset(
    id: string
): Promise<CreatorAssetMetadata | null> {
    const database = await openCreatorAssetDatabase();

    try {
        const transaction = database.transaction(
            CREATOR_ASSET_METADATA_STORE_NAME,
            'readwrite'
        );
        const store = transaction.objectStore(
            CREATOR_ASSET_METADATA_STORE_NAME
        );
        const current = (await requestResult(
            store.get(id)
        )) as CreatorAssetMetadata | undefined;

        if (!current) {
            await transactionCompleted(transaction);
            return null;
        }

        const updated: CreatorAssetMetadata = {
            ...current,
            lastUsedAt: Math.max(Date.now(), current.lastUsedAt + 1),
        };
        const putRequest = store.put(updated);
        await Promise.all([
            requestResult(putRequest),
            transactionCompleted(transaction),
        ]);
        return updated;
    } catch (error) {
        throw mapStorageError(error);
    } finally {
        database.close();
    }
}
