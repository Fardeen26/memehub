import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import * as memeDraftStorage from '@/lib/memeDraft';

const TEST_DATABASE_NAME = 'memehub-meme-drafts';
const TEST_STORE_NAME = 'drafts';
const TEST_ACTIVE_KEY = 'active';

function deleteTestDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(TEST_DATABASE_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Test database deletion was blocked.'));
    });
}

function openTestDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(TEST_DATABASE_NAME, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function putRawActiveRecord(record: unknown): Promise<void> {
    const database = await openTestDatabase();

    try {
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(TEST_STORE_NAME, 'readwrite');
            transaction.objectStore(TEST_STORE_NAME).put(record, TEST_ACTIVE_KEY);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        database.close();
    }
}

async function getRawActiveRecord(): Promise<unknown> {
    const database = await openTestDatabase();

    try {
        return await new Promise((resolve, reject) => {
            const transaction = database.transaction(TEST_STORE_NAME, 'readonly');
            const request = transaction.objectStore(TEST_STORE_NAME).get(TEST_ACTIVE_KEY);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally {
        database.close();
    }
}

describe('memeDraft storage', () => {
    beforeEach(async () => {
        await deleteTestDatabase();
    });

    it('round-trips only the latest active v1 draft through IndexedDB structured cloning', async () => {
        const firstDraft = {
            schemaVersion: 1 as const,
            updatedAt: 1,
            state: {
                templateImage: 'data:image/png;base64,Zmlyc3Q=',
                imageOverlays: [],
            },
        };
        const latestDraft = {
            schemaVersion: 1 as const,
            updatedAt: 2,
            state: {
                templateImage: 'data:image/png;base64,bGF0ZXN0',
                imageOverlays: [
                    {
                        id: 'reaction-face',
                        src: 'data:image/webp;base64,b3ZlcmxheQ==',
                        x: 24,
                        y: 36,
                        width: 160,
                        height: 120,
                        originalWidth: 320,
                        originalHeight: 240,
                        opacity: 0.85,
                        rotation: 12,
                        eraseStrokes: [
                            {
                                points: [
                                    { x: 4, y: 8 },
                                    { x: 12, y: 16 },
                                ],
                                size: 18,
                                opacity: 0.5,
                            },
                        ],
                    },
                ],
            },
        };

        await memeDraftStorage.saveActiveMemeDraft(firstDraft);
        await memeDraftStorage.saveActiveMemeDraft(latestDraft);

        const loaded = await memeDraftStorage.loadActiveMemeDraft();

        expect(loaded).toEqual(latestDraft);
        expect(loaded).not.toBe(latestDraft);
        expect(loaded?.state.imageOverlays).not.toBe(latestDraft.state.imageOverlays);
    });

    it('deletes the active draft', async () => {
        await memeDraftStorage.saveActiveMemeDraft({
            schemaVersion: 1,
            updatedAt: 1,
            state: { templateImage: 'data:image/png;base64,ZHJhZnQ=' },
        });

        await memeDraftStorage.deleteActiveMemeDraft();

        await expect(memeDraftStorage.loadActiveMemeDraft()).resolves.toBeNull();
    });

    it('returns null and clears a truly malformed stored record', async () => {
        await memeDraftStorage.loadActiveMemeDraft();
        await putRawActiveRecord(null);

        await expect(memeDraftStorage.loadActiveMemeDraft()).resolves.toBeNull();
        await expect(getRawActiveRecord()).resolves.toBeUndefined();
    });

    it('reports and preserves a structurally object-like future-version draft', async () => {
        const futureDraft = {
            schemaVersion: 2,
            updatedAt: 1,
            state: {
                templateImage: 'data:image/png;base64,djI=',
                futureOnlyField: { renderingMode: 'v2' },
            },
        };

        await memeDraftStorage.loadActiveMemeDraft();
        await putRawActiveRecord(futureDraft);

        await expect(
            memeDraftStorage.inspectActiveMemeDraft()
        ).resolves.toEqual({
            status: 'unsupported',
            revision: {
                schemaVersion: 2,
                updatedAt: 1,
            },
        });
        await expect(memeDraftStorage.loadActiveMemeDraft()).resolves.toBeNull();
        await expect(getRawActiveRecord()).resolves.toEqual(futureDraft);
    });

    it.each([
        ['zero', 0],
        ['negative', -1],
        ['fractional', 1.5],
        ['not finite', Number.NaN],
        ['not numeric', '2'],
    ])(
        'clears an invalid %s schema version',
        async (_label, schemaVersion) => {
            await memeDraftStorage.loadActiveMemeDraft();
            await putRawActiveRecord({
                schemaVersion,
                updatedAt: 1,
                state: {},
            });

            await expect(
                memeDraftStorage.loadActiveMemeDraft()
            ).resolves.toBeNull();
            await expect(getRawActiveRecord()).resolves.toBeUndefined();
        }
    );

    it('rejects an unsupported draft before persistence', async () => {
        const unsupportedDraft = {
            schemaVersion: 2,
            updatedAt: 1,
            state: { templateImage: 'data:image/png;base64,djI=' },
        };

        await expect(
            (
                memeDraftStorage.saveActiveMemeDraft as unknown as (
                    draft: unknown
                ) => Promise<void>
            )(unsupportedDraft)
        ).rejects.toThrow(TypeError);
        await expect(memeDraftStorage.loadActiveMemeDraft()).resolves.toBeNull();
    });

    it('rejects a stale tab write instead of overwriting a newer draft', async () => {
        const firstDraft = {
            schemaVersion: 1 as const,
            updatedAt: 10,
            state: { text: 'first tab' },
        };
        const newerDraft = {
            schemaVersion: 1 as const,
            updatedAt: 11,
            state: { text: 'newer tab' },
        };
        const staleDraft = {
            schemaVersion: 1 as const,
            updatedAt: 12,
            state: { text: 'stale tab' },
        };
        await memeDraftStorage.saveActiveMemeDraft(firstDraft);

        await expect(
            memeDraftStorage.saveActiveMemeDraftIfCurrent(newerDraft, 10)
        ).resolves.toBe('saved');
        await expect(
            memeDraftStorage.saveActiveMemeDraftIfCurrent(staleDraft, 10)
        ).resolves.toBe('conflict');
        await expect(memeDraftStorage.loadActiveMemeDraft()).resolves.toEqual(
            newerDraft
        );
    });

    it('does not resurrect a draft that another tab discarded', async () => {
        await memeDraftStorage.saveActiveMemeDraft({
            schemaVersion: 1,
            updatedAt: 20,
            state: { text: 'discard me' },
        });
        await memeDraftStorage.deleteActiveMemeDraft();

        await expect(
            memeDraftStorage.saveActiveMemeDraftIfCurrent(
                {
                    schemaVersion: 1,
                    updatedAt: 21,
                    state: { text: 'stale resurrection' },
                },
                20
            )
        ).resolves.toBe('conflict');
        await expect(memeDraftStorage.loadActiveMemeDraft()).resolves.toBeNull();
    });

    it('does not let a stale tab delete a newer saved revision', async () => {
        await memeDraftStorage.saveActiveMemeDraft({
            schemaVersion: 1,
            updatedAt: 30,
            state: { text: 'first revision' },
        });

        await memeDraftStorage.saveActiveMemeDraft({
            schemaVersion: 1,
            updatedAt: 31,
            state: { text: 'newer revision' },
        });

        await expect(
            memeDraftStorage.deleteActiveMemeDraftIfCurrent({
                schemaVersion: 1,
                updatedAt: 30,
            })
        ).resolves.toBe('conflict');
        await expect(memeDraftStorage.loadActiveMemeDraft()).resolves.toMatchObject({
            updatedAt: 31,
        });
    });

    it('conditionally deletes the exact inspected future-version record', async () => {
        const futureDraft = {
            schemaVersion: 3,
            updatedAt: 40,
            state: { futureOnlyField: true },
        };
        await memeDraftStorage.loadActiveMemeDraft();
        await putRawActiveRecord(futureDraft);

        const inspection = await memeDraftStorage.inspectActiveMemeDraft();
        expect(inspection.status).toBe('unsupported');
        if (inspection.status !== 'unsupported') return;

        await expect(
            memeDraftStorage.deleteActiveMemeDraftIfCurrent(
                inspection.revision
            )
        ).resolves.toBe('deleted');
        await expect(getRawActiveRecord()).resolves.toBeUndefined();
    });

    it('does not delete a changed future record that has no reliable timestamp', async () => {
        await memeDraftStorage.loadActiveMemeDraft();
        await putRawActiveRecord({
            schemaVersion: 2,
            state: { futureOnlyField: 'first payload' },
        });
        const firstInspection =
            await memeDraftStorage.inspectActiveMemeDraft();
        expect(firstInspection.status).toBe('unsupported');
        if (firstInspection.status !== 'unsupported') return;

        const newerFutureDraft = {
            schemaVersion: 2,
            state: { futureOnlyField: 'newer payload' },
        };
        await putRawActiveRecord(newerFutureDraft);

        await expect(
            memeDraftStorage.deleteActiveMemeDraftIfCurrent(
                firstInspection.revision
            )
        ).resolves.toBe('conflict');
        await expect(getRawActiveRecord()).resolves.toEqual(newerFutureDraft);
    });

    it('can safely discard an unchanged future record without a timestamp', async () => {
        await memeDraftStorage.loadActiveMemeDraft();
        await putRawActiveRecord({
            schemaVersion: 2,
            state: { futureOnlyField: 'unchanged payload' },
        });
        const inspection = await memeDraftStorage.inspectActiveMemeDraft();
        expect(inspection.status).toBe('unsupported');
        if (inspection.status !== 'unsupported') return;

        await expect(
            memeDraftStorage.deleteActiveMemeDraftIfCurrent(
                inspection.revision
            )
        ).resolves.toBe('deleted');
        await expect(getRawActiveRecord()).resolves.toBeUndefined();
    });

    it('treats filled and sparse future arrays as different opaque revisions', async () => {
        const sparseValues = new Array(3);
        sparseValues[0] = 'first';
        sparseValues[2] = 'third';
        await memeDraftStorage.loadActiveMemeDraft();
        await putRawActiveRecord({
            schemaVersion: 2,
            state: { values: sparseValues },
        });
        const inspection = await memeDraftStorage.inspectActiveMemeDraft();
        expect(inspection.status).toBe('unsupported');
        if (inspection.status !== 'unsupported') return;

        const filledFutureDraft = {
            schemaVersion: 2,
            state: { values: ['first', 'second', 'third'] },
        };
        await putRawActiveRecord(filledFutureDraft);

        await expect(
            memeDraftStorage.deleteActiveMemeDraftIfCurrent(
                inspection.revision
            )
        ).resolves.toBe('conflict');
        await expect(getRawActiveRecord()).resolves.toEqual(filledFutureDraft);
    });

    it('detects changed object aliasing in an opaque future revision', async () => {
        const sharedValue = { label: 'shared' };
        await memeDraftStorage.loadActiveMemeDraft();
        await putRawActiveRecord({
            schemaVersion: 2,
            state: { first: sharedValue, second: sharedValue },
        });
        const inspection = await memeDraftStorage.inspectActiveMemeDraft();
        expect(inspection.status).toBe('unsupported');
        if (inspection.status !== 'unsupported') return;

        const changedAliasing = {
            schemaVersion: 2,
            state: {
                first: { label: 'shared' },
                second: { label: 'shared' },
            },
        };
        await putRawActiveRecord(changedAliasing);

        await expect(
            memeDraftStorage.deleteActiveMemeDraftIfCurrent(
                inspection.revision
            )
        ).resolves.toBe('conflict');
        await expect(getRawActiveRecord()).resolves.toEqual(changedAliasing);
    });
});
