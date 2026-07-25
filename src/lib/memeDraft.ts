export const MEME_DRAFT_SCHEMA_VERSION = 1 as const;

export type MemeDraftV1<TState extends object = Record<string, unknown>> = {
    schemaVersion: typeof MEME_DRAFT_SCHEMA_VERSION;
    updatedAt: number;
    state: TState;
};

export type MemeDraftRevision = {
    schemaVersion: number;
    updatedAt: number | null;
    /** Exact fallback snapshot when a future schema has no trustworthy timestamp. */
    opaqueRecord?: unknown;
};

export type ActiveMemeDraftInspection<
    TState extends object = Record<string, unknown>,
> =
    | {
          status: 'ready';
          draft: MemeDraftV1<TState>;
          revision: MemeDraftRevision;
      }
    | {
          status: 'unsupported';
          revision: MemeDraftRevision;
      }
    | {
          status: 'empty';
      };

const DATABASE_NAME = 'memehub-meme-drafts';
const DATABASE_VERSION = 1;
const DRAFT_STORE_NAME = 'drafts';
const ACTIVE_DRAFT_KEY = 'active';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMemeDraftV1(value: unknown): value is MemeDraftV1 {
    if (!isObjectRecord(value)) return false;

    return (
        value.schemaVersion === MEME_DRAFT_SCHEMA_VERSION &&
        typeof value.updatedAt === 'number' &&
        Number.isFinite(value.updatedAt) &&
        value.updatedAt >= 0 &&
        isObjectRecord(value.state)
    );
}

function hasFutureMemeDraftSchemaVersion(
    value: unknown
): value is Record<string, unknown> & { schemaVersion: number } {
    if (!isObjectRecord(value)) return false;

    return (
        typeof value.schemaVersion === 'number' &&
        Number.isFinite(value.schemaVersion) &&
        Number.isInteger(value.schemaVersion) &&
        value.schemaVersion > MEME_DRAFT_SCHEMA_VERSION
    );
}

function getMemeDraftRevision(value: unknown): MemeDraftRevision | null {
    if (!isObjectRecord(value)) return null;
    if (
        typeof value.schemaVersion !== 'number' ||
        !Number.isInteger(value.schemaVersion) ||
        value.schemaVersion < MEME_DRAFT_SCHEMA_VERSION
    ) {
        return null;
    }

    const updatedAt =
        typeof value.updatedAt === 'number' &&
        Number.isFinite(value.updatedAt) &&
        value.updatedAt >= 0
            ? value.updatedAt
            : null;

    return {
        schemaVersion: value.schemaVersion,
        updatedAt,
        ...(updatedAt === null ? { opaqueRecord: value } : {}),
    };
}

function structuredDraftValuesEqual(
    first: unknown,
    second: unknown,
    seenFirst = new Map<object, object>(),
    seenSecond = new Map<object, object>()
): boolean {
    if (Object.is(first, second)) return true;
    if (
        typeof first !== 'object' ||
        first === null ||
        typeof second !== 'object' ||
        second === null
    ) {
        return false;
    }

    const firstSeenMatch = seenFirst.get(first);
    const secondSeenMatch = seenSecond.get(second);
    if (firstSeenMatch || secondSeenMatch) {
        return firstSeenMatch === second && secondSeenMatch === first;
    }
    seenFirst.set(first, second);
    seenSecond.set(second, first);

    if (Array.isArray(first) || Array.isArray(second)) {
        if (!Array.isArray(first) || !Array.isArray(second)) return false;
        if (first.length !== second.length) return false;
        for (let index = 0; index < first.length; index += 1) {
            if ((index in first) !== (index in second)) return false;
            if (
                index in first &&
                !structuredDraftValuesEqual(
                    first[index],
                    second[index],
                    seenFirst,
                    seenSecond
                )
            ) {
                return false;
            }
        }
        return true;
    }

    if (first instanceof Date || second instanceof Date) {
        return (
            first instanceof Date &&
            second instanceof Date &&
            first.getTime() === second.getTime()
        );
    }

    if (first instanceof ArrayBuffer || second instanceof ArrayBuffer) {
        if (!(first instanceof ArrayBuffer) || !(second instanceof ArrayBuffer)) {
            return false;
        }
        const firstBytes = new Uint8Array(first);
        const secondBytes = new Uint8Array(second);
        return (
            firstBytes.length === secondBytes.length &&
            firstBytes.every((value, index) => value === secondBytes[index])
        );
    }

    if (ArrayBuffer.isView(first) || ArrayBuffer.isView(second)) {
        if (!ArrayBuffer.isView(first) || !ArrayBuffer.isView(second)) {
            return false;
        }
        const firstBytes = new Uint8Array(
            first.buffer,
            first.byteOffset,
            first.byteLength
        );
        const secondBytes = new Uint8Array(
            second.buffer,
            second.byteOffset,
            second.byteLength
        );
        return (
            first.constructor === second.constructor &&
            firstBytes.length === secondBytes.length &&
            firstBytes.every((value, index) => value === secondBytes[index])
        );
    }

    // Unknown future drafts may contain types whose contents cannot be
    // compared synchronously (Blob, Map, Set, File, etc.). Refuse deletion
    // rather than guess that two such records are the same revision.
    const firstPrototype = Object.getPrototypeOf(first);
    const secondPrototype = Object.getPrototypeOf(second);
    const firstIsPlain =
        firstPrototype === Object.prototype || firstPrototype === null;
    const secondIsPlain =
        secondPrototype === Object.prototype || secondPrototype === null;
    if (!firstIsPlain || !secondIsPlain) return false;

    const firstRecord = first as Record<string, unknown>;
    const secondRecord = second as Record<string, unknown>;
    const firstKeys = Object.keys(firstRecord).sort();
    const secondKeys = Object.keys(secondRecord).sort();
    if (
        firstKeys.length !== secondKeys.length ||
        firstKeys.some((key, index) => key !== secondKeys[index])
    ) {
        return false;
    }

    return firstKeys.every((key) =>
        structuredDraftValuesEqual(
            firstRecord[key],
            secondRecord[key],
            seenFirst,
            seenSecond
        )
    );
}

function revisionsMatch(
    currentRecord: unknown,
    second: MemeDraftRevision
): boolean {
    const first = getMemeDraftRevision(currentRecord);
    if (
        first?.schemaVersion !== second.schemaVersion ||
        first.updatedAt !== second.updatedAt
    ) {
        return false;
    }

    if (second.updatedAt !== null) return true;
    if (!('opaqueRecord' in second)) return false;
    return structuredDraftValuesEqual(currentRecord, second.opaqueRecord);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () =>
            reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    });
}

function openDraftDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(DRAFT_STORE_NAME)) {
                database.createObjectStore(DRAFT_STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function saveActiveMemeDraft<TState extends object>(
    draft: MemeDraftV1<TState>
): Promise<void> {
    if (!isMemeDraftV1(draft)) {
        throw new TypeError('Cannot save a malformed or unsupported meme draft.');
    }

    const database = await openDraftDatabase();

    try {
        const transaction = database.transaction(DRAFT_STORE_NAME, 'readwrite');
        const request = transaction.objectStore(DRAFT_STORE_NAME).put(draft, ACTIVE_DRAFT_KEY);

        await Promise.all([requestResult(request), transactionCompleted(transaction)]);
    } finally {
        database.close();
    }
}

export async function saveActiveMemeDraftIfCurrent<TState extends object>(
    draft: MemeDraftV1<TState>,
    expectedUpdatedAt: number | null
): Promise<'saved' | 'conflict'> {
    if (!isMemeDraftV1(draft)) {
        throw new TypeError('Cannot save a malformed or unsupported meme draft.');
    }

    const database = await openDraftDatabase();

    try {
        return await new Promise((resolve, reject) => {
            let result: 'saved' | 'conflict' = 'conflict';
            const transaction = database.transaction(DRAFT_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(DRAFT_STORE_NAME);
            const request = store.get(ACTIVE_DRAFT_KEY);

            request.onsuccess = () => {
                const currentRecord: unknown = request.result;
                const matchesExpectedRevision =
                    expectedUpdatedAt === null
                        ? currentRecord === undefined
                        : isMemeDraftV1(currentRecord) &&
                          currentRecord.updatedAt === expectedUpdatedAt;

                if (!matchesExpectedRevision) return;

                store.put(draft, ACTIVE_DRAFT_KEY);
                result = 'saved';
            };
            request.onerror = () => reject(request.error);
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () =>
                reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
        });
    } finally {
        database.close();
    }
}

export async function inspectActiveMemeDraft<
    TState extends object = Record<string, unknown>,
>(): Promise<ActiveMemeDraftInspection<TState>> {
    const database = await openDraftDatabase();

    try {
        return await new Promise((resolve, reject) => {
            let inspection: ActiveMemeDraftInspection<TState> = {
                status: 'empty',
            };
            const transaction = database.transaction(DRAFT_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(DRAFT_STORE_NAME);
            const request = store.get(ACTIVE_DRAFT_KEY);

            request.onsuccess = () => {
                const storedRecord: unknown = request.result;
                if (storedRecord === undefined) return;

                if (isMemeDraftV1(storedRecord)) {
                    const draft = storedRecord as MemeDraftV1<TState>;
                    inspection = {
                        status: 'ready',
                        draft,
                        revision: {
                            schemaVersion: draft.schemaVersion,
                            updatedAt: draft.updatedAt,
                        },
                    };
                    return;
                }

                if (hasFutureMemeDraftSchemaVersion(storedRecord)) {
                    inspection = {
                        status: 'unsupported',
                        revision: getMemeDraftRevision(storedRecord) ?? {
                            schemaVersion: storedRecord.schemaVersion,
                            updatedAt: null,
                        },
                    };
                    return;
                }

                store.delete(ACTIVE_DRAFT_KEY);
            };
            request.onerror = () => reject(request.error);
            transaction.oncomplete = () => resolve(inspection);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () =>
                reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
        });
    } finally {
        database.close();
    }
}

export async function loadActiveMemeDraft<
    TState extends object = Record<string, unknown>,
>(): Promise<MemeDraftV1<TState> | null> {
    const inspection = await inspectActiveMemeDraft<TState>();
    return inspection.status === 'ready' ? inspection.draft : null;
}

export async function deleteActiveMemeDraft(): Promise<void> {
    const database = await openDraftDatabase();

    try {
        const transaction = database.transaction(DRAFT_STORE_NAME, 'readwrite');
        const request = transaction
            .objectStore(DRAFT_STORE_NAME)
            .delete(ACTIVE_DRAFT_KEY);

        await Promise.all([requestResult(request), transactionCompleted(transaction)]);
    } finally {
        database.close();
    }
}

export async function deleteActiveMemeDraftIfCurrent(
    expectedRevision: MemeDraftRevision
): Promise<'deleted' | 'conflict'> {
    const database = await openDraftDatabase();

    try {
        return await new Promise((resolve, reject) => {
            let result: 'deleted' | 'conflict' = 'conflict';
            const transaction = database.transaction(DRAFT_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(DRAFT_STORE_NAME);
            const request = store.get(ACTIVE_DRAFT_KEY);

            request.onsuccess = () => {
                if (!revisionsMatch(request.result, expectedRevision)) return;

                store.delete(ACTIVE_DRAFT_KEY);
                result = 'deleted';
            };
            request.onerror = () => reject(request.error);
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () =>
                reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
        });
    } finally {
        database.close();
    }
}
