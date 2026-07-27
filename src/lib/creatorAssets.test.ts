// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CREATOR_ASSET_DATABASE_NAME,
    CREATOR_ASSET_LIMIT,
    CREATOR_ASSET_MAX_BYTES,
    CREATOR_ASSET_MAX_PIXELS,
    CREATOR_ASSET_TOTAL_BYTES_LIMIT,
    CreatorAssetError,
    deleteCreatorAsset,
    listCreatorAssets,
    loadCreatorAsset,
    saveCreatorAsset,
    touchCreatorAsset,
} from './creatorAssets';

function deleteAssetDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(CREATOR_ASSET_DATABASE_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
            reject(new Error('Creator asset test database deletion was blocked.'));
    });
}

function imageBlob(
    type: 'image/png' | 'image/jpeg' | 'image/webp',
    contents = 'creator asset'
): Blob {
    return new Blob([contents], { type });
}

async function seedLegacyAssetRecord(): Promise<void> {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(CREATOR_ASSET_DATABASE_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('assets', { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction('assets', 'readwrite');
            transaction.objectStore('assets').add({
                id: 'legacy-asset',
                name: 'legacy.png',
                mimeType: 'image/png',
                size: 3,
                createdAt: 10,
                lastUsedAt: 10,
                bytes: new Uint8Array([1, 2, 3]).buffer,
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}

describe('creator asset library', () => {
    beforeEach(async () => {
        await deleteAssetDatabase();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each([
        ['PNG', 'image/png'],
        ['JPEG', 'image/jpeg'],
        ['WebP', 'image/webp'],
    ] as const)('saves and lists a %s image with durable metadata', async (_label, mimeType) => {
        vi.spyOn(Date, 'now').mockReturnValue(1_000);
        const blob = imageBlob(mimeType);

        const saved = await saveCreatorAsset({
            blob,
            name: 'reaction-face',
        });
        const listed = await listCreatorAssets();

        expect(saved).toMatchObject({
            name: 'reaction-face',
            mimeType,
            size: blob.size,
            createdAt: 1_000,
            lastUsedAt: 1_000,
        });
        expect(saved.id).toEqual(expect.any(String));
        expect(saved.id.length).toBeGreaterThan(0);
        expect(listed).toHaveLength(1);
        expect(listed[0]).toMatchObject({
            id: saved.id,
            name: 'reaction-face',
            mimeType,
            size: blob.size,
        });
        expect(listed[0]).not.toHaveProperty('blob');

        const loaded = await loadCreatorAsset(saved.id);
        expect(loaded?.blob).toBeInstanceOf(Blob);
        expect(loaded?.blob.type).toBe(mimeType);
        expect(loaded?.blob.size).toBe(blob.size);
    });

    it('allows duplicate content and names while assigning unique IDs', async () => {
        const blob = imageBlob('image/png', 'same content');

        const first = await saveCreatorAsset({ blob, name: 'same-name' });
        const second = await saveCreatorAsset({ blob, name: 'same-name' });

        expect(second.id).not.toBe(first.id);
        expect(await listCreatorAssets()).toHaveLength(2);
    });

    it('migrates the original combined records without losing saved images', async () => {
        await seedLegacyAssetRecord();

        await expect(listCreatorAssets()).resolves.toEqual([
            {
                id: 'legacy-asset',
                name: 'legacy.png',
                mimeType: 'image/png',
                size: 3,
                createdAt: 10,
                lastUsedAt: 10,
            },
        ]);
        const loaded = await loadCreatorAsset('legacy-asset');
        expect(loaded?.blob.type).toBe('image/png');
        expect(loaded?.blob.size).toBe(3);
    });

    it('orders assets by most recent use, then newest creation, with a stable ID tie-breaker', async () => {
        const now = vi.spyOn(Date, 'now');
        now.mockReturnValue(100);
        const first = await saveCreatorAsset({
            blob: imageBlob('image/png', 'first'),
            name: 'first',
        });
        now.mockReturnValue(200);
        const second = await saveCreatorAsset({
            blob: imageBlob('image/png', 'second'),
            name: 'second',
        });

        expect((await listCreatorAssets()).map((asset) => asset.id)).toEqual([
            second.id,
            first.id,
        ]);

        now.mockReturnValue(300);
        const touched = await touchCreatorAsset(first.id);
        expect(touched?.lastUsedAt).toBe(300);
        expect((await listCreatorAssets()).map((asset) => asset.id)).toEqual([
            first.id,
            second.id,
        ]);

        await deleteAssetDatabase();
        now.mockReturnValue(400);
        const tiedFirst = await saveCreatorAsset({
            blob: imageBlob('image/png', 'tie one'),
            name: 'tie',
        });
        const tiedSecond = await saveCreatorAsset({
            blob: imageBlob('image/png', 'tie two'),
            name: 'tie',
        });
        const expectedIds = [tiedFirst.id, tiedSecond.id].sort((left, right) =>
            left.localeCompare(right)
        );
        expect((await listCreatorAssets()).map((asset) => asset.id)).toEqual(
            expectedIds
        );
    });

    it('deletes an asset and returns null when touching an unknown ID', async () => {
        const saved = await saveCreatorAsset({
            blob: imageBlob('image/webp'),
            name: 'temporary',
        });

        await deleteCreatorAsset(saved.id);

        await expect(listCreatorAssets()).resolves.toEqual([]);
        await expect(touchCreatorAsset(saved.id)).resolves.toBeNull();
    });

    it('rejects unsupported image types with a typed error', async () => {
        const operation = saveCreatorAsset({
            blob: new Blob(['animated'], { type: 'image/gif' }),
            name: 'animated',
        });

        await expect(operation).rejects.toEqual(
            expect.objectContaining({
                name: 'CreatorAssetError',
                code: 'unsupported-type',
                message: 'Only PNG, JPEG, and WebP images can be saved.',
            })
        );
        await expect(operation).rejects.toBeInstanceOf(CreatorAssetError);
    });

    it('accepts a 5 MB asset and rejects anything larger with a typed error', async () => {
        const maximum = new Blob([new Uint8Array(CREATOR_ASSET_MAX_BYTES)], {
            type: 'image/png',
        });
        const tooLarge = new Blob(
            [new Uint8Array(CREATOR_ASSET_MAX_BYTES + 1)],
            { type: 'image/png' }
        );

        await expect(
            saveCreatorAsset({ blob: maximum, name: 'maximum' })
        ).resolves.toMatchObject({ size: CREATOR_ASSET_MAX_BYTES });
        await expect(
            saveCreatorAsset({ blob: tooLarge, name: 'too-large' })
        ).rejects.toEqual(
            expect.objectContaining({
                name: 'CreatorAssetError',
                code: 'too-large',
                message: 'Creator assets must be 5 MB or smaller.',
            })
        );
    });

    it('rejects an image whose decoded pixel dimensions are unsafe for a mobile tab', async () => {
        const bytes = new Uint8Array(24);
        bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
        bytes.set([73, 72, 68, 82], 12);
        const view = new DataView(bytes.buffer);
        view.setUint32(16, CREATOR_ASSET_MAX_PIXELS + 1);
        view.setUint32(20, 1);

        await expect(
            saveCreatorAsset({
                blob: new Blob([bytes], { type: 'image/png' }),
                name: 'decompression-bomb.png',
            })
        ).rejects.toEqual(
            expect.objectContaining({
                name: 'CreatorAssetError',
                code: 'dimensions-too-large',
            })
        );
    });

    it('enforces the 30 asset limit with a typed error', async () => {
        for (let index = 0; index < CREATOR_ASSET_LIMIT; index += 1) {
            await saveCreatorAsset({
                blob: imageBlob('image/jpeg', String(index)),
                name: `asset-${index}`,
            });
        }

        await expect(
            saveCreatorAsset({
                blob: imageBlob('image/jpeg', 'one too many'),
                name: 'overflow',
            })
        ).rejects.toEqual(
            expect.objectContaining({
                name: 'CreatorAssetError',
                code: 'asset-limit-reached',
                message:
                    'Your creator asset library is full. Delete an asset before adding another.',
            })
        );
        await expect(listCreatorAssets()).resolves.toHaveLength(
            CREATOR_ASSET_LIMIT
        );
    });

    it('caps total original bytes so the local shelf stays mobile-safe', async () => {
        const assetSize = CREATOR_ASSET_MAX_BYTES;
        const fullAsset = new Blob([new Uint8Array(assetSize)], {
            type: 'image/webp',
        });
        const allowedCount = Math.floor(
            CREATOR_ASSET_TOTAL_BYTES_LIMIT / assetSize
        );

        for (let index = 0; index < allowedCount; index += 1) {
            await saveCreatorAsset({
                blob: fullAsset,
                name: `large-${index}`,
            });
        }

        await expect(
            saveCreatorAsset({
                blob: fullAsset,
                name: 'too-much-total-storage',
            })
        ).rejects.toEqual(
            expect.objectContaining({
                name: 'CreatorAssetError',
                code: 'library-size-reached',
            })
        );
    });

    it('maps browser quota failures to a clear typed error', async () => {
        vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementationOnce(() => {
            throw new DOMException('Storage quota reached', 'QuotaExceededError');
        });

        await expect(
            saveCreatorAsset({
                blob: imageBlob('image/png'),
                name: 'quota-trigger',
            })
        ).rejects.toEqual(
            expect.objectContaining({
                name: 'CreatorAssetError',
                code: 'quota-exceeded',
                message:
                    'Browser storage is full. Delete an asset or free some space and try again.',
            })
        );
    });

    it('aborts both stores when the binary write throws synchronously', async () => {
        const originalAdd = IDBObjectStore.prototype.add;
        vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(
            function (this: IDBObjectStore, value, key) {
                if (this.name === 'asset-blobs') {
                    throw new Error('Binary store unavailable');
                }
                return originalAdd.call(this, value, key);
            }
        );

        await expect(
            saveCreatorAsset({
                blob: imageBlob('image/png'),
                name: 'must-stay-atomic',
            })
        ).rejects.toThrow('Binary store unavailable');
        await expect(listCreatorAssets()).resolves.toEqual([]);
    });

    it('aborts deletion when either store cannot be updated', async () => {
        const saved = await saveCreatorAsset({
            blob: imageBlob('image/png'),
            name: 'keep-on-delete-failure',
        });
        const originalDelete = IDBObjectStore.prototype.delete;
        vi.spyOn(IDBObjectStore.prototype, 'delete').mockImplementation(
            function (this: IDBObjectStore, key) {
                if (this.name === 'asset-blobs') {
                    throw new Error('Binary delete unavailable');
                }
                return originalDelete.call(this, key);
            }
        );

        await expect(deleteCreatorAsset(saved.id)).rejects.toThrow(
            'Binary delete unavailable'
        );
        await expect(loadCreatorAsset(saved.id)).resolves.toMatchObject({
            id: saved.id,
        });
    });
});
