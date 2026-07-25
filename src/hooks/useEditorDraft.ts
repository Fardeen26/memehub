'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    assertMemeEditorDraftLocalMediaCapacity,
    createEditorDraft,
    isMemeEditorDraftState,
    type MemeEditorDraftState,
} from '@/lib/editorDraft';
import {
    loadActiveMemeDraft,
    saveActiveMemeDraftIfCurrent,
} from '@/lib/memeDraft';

export type EditorDraftStatus = 'restoring' | 'saving' | 'saved' | 'error';

type UseEditorDraftOptions = {
    state: MemeEditorDraftState;
    onRestore: (state: MemeEditorDraftState) => void;
    beforeSave?: () =>
        | void
        | MemeEditorDraftState
        | Promise<void | MemeEditorDraftState>;
    restoreSavedDraft?: boolean;
    expectedDraftUpdatedAt?: number;
    debounceMs?: number;
};

export function useEditorDraft({
    state,
    onRestore,
    beforeSave,
    restoreSavedDraft = false,
    expectedDraftUpdatedAt,
    debounceMs = 350,
}: UseEditorDraftOptions) {
    const [status, setStatus] = useState<EditorDraftStatus>('restoring');
    const [isReady, setIsReady] = useState(false);
    const [restoreError, setRestoreError] = useState<string | null>(null);
    const [explicitSaveCount, setExplicitSaveCount] = useState(0);
    const skipNextAutosave = useRef(false);
    const lastKnownUpdatedAt = useRef<number | null>(null);
    const saveQueue = useRef<Promise<void>>(Promise.resolve());
    const latestState = useRef(state);
    latestState.current = state;

    useEffect(() => {
        let cancelled = false;

        void loadActiveMemeDraft()
            .then((draft) => {
                if (cancelled) return;

                if (restoreSavedDraft) {
                    if (
                        !draft ||
                        draft.updatedAt !== expectedDraftUpdatedAt ||
                        !isMemeEditorDraftState(draft.state) ||
                        draft.state.template.image !== state.template.image
                    ) {
                        lastKnownUpdatedAt.current = null;
                        setRestoreError(
                            'This saved draft changed in another tab. Return to the gallery to review the latest version.'
                        );
                        setStatus('error');
                        setIsReady(true);
                        return;
                    }

                    lastKnownUpdatedAt.current = draft.updatedAt;
                    skipNextAutosave.current = true;
                    onRestore(draft.state);
                } else {
                    // A draft not explicitly opened by this editor belongs to
                    // another gallery/tab transition. Expecting an empty slot
                    // makes the first save conflict instead of overwriting it.
                    lastKnownUpdatedAt.current = null;
                }

                setStatus('saved');
                setIsReady(true);
            })
            .catch(() => {
                if (cancelled) return;
                if (restoreSavedDraft) {
                    setRestoreError(
                        'This saved draft could not be verified. Return to the gallery and try again.'
                    );
                }
                setStatus('error');
                setIsReady(true);
            });

        return () => {
            cancelled = true;
        };
    }, [
        expectedDraftUpdatedAt,
        onRestore,
        restoreSavedDraft,
        state.template.image,
    ]);

    const persistState = useCallback((snapshot: MemeEditorDraftState) => {
        const write = async () => {
            assertMemeEditorDraftLocalMediaCapacity(snapshot);
            const expectedUpdatedAt = lastKnownUpdatedAt.current;
            const updatedAt = Math.max(
                Date.now(),
                (expectedUpdatedAt ?? -1) + 1
            );
            const result = await saveActiveMemeDraftIfCurrent(
                createEditorDraft(snapshot, updatedAt),
                expectedUpdatedAt
            );

            if (result === 'conflict') {
                throw new Error(
                    'A newer draft revision exists in another tab. Reload before saving again.'
                );
            }
            lastKnownUpdatedAt.current = updatedAt;
        };

        const queuedWrite = saveQueue.current.then(write, write);
        saveQueue.current = queuedWrite.catch(() => undefined);
        return queuedWrite;
    }, []);

    useEffect(() => {
        if (!isReady || restoreError) return;
        if (skipNextAutosave.current) {
            skipNextAutosave.current = false;
            return;
        }

        setStatus('saving');
        let cancelled = false;
        const timeoutId = window.setTimeout(() => {
            void persistState(state)
                .then(() => {
                    if (!cancelled) setStatus('saved');
                })
                .catch(() => {
                    if (!cancelled) setStatus('error');
                });
        }, debounceMs);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [debounceMs, isReady, persistState, restoreError, state]);

    const saveNow = useCallback(async () => {
        if (restoreError) {
            throw new Error(restoreError);
        }

        // The editor state still contains template defaults until the async
        // IndexedDB restore finishes. Flushing during that window would erase
        // the creator's valid saved scene with a blank one.
        if (!isReady) {
            throw new Error('The draft is still being restored. Please wait.');
        }

        setExplicitSaveCount((count) => count + 1);
        setStatus('saving');
        try {
            const preparedState = await beforeSave?.();
            await persistState(preparedState ?? latestState.current);
            setStatus('saved');
        } catch (error) {
            setStatus('error');
            throw error;
        } finally {
            setExplicitSaveCount((count) => Math.max(0, count - 1));
        }
    }, [beforeSave, isReady, persistState, restoreError]);

    useEffect(() => {
        const flush = () => {
            void saveNow().catch(() => undefined);
        };
        const flushWhenHidden = () => {
            if (document.visibilityState === 'hidden') flush();
        };

        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', flushWhenHidden);
        return () => {
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', flushWhenHidden);
        };
    }, [saveNow]);

    return {
        canEdit: isReady && !restoreError && explicitSaveCount === 0,
        isReady,
        restoreError,
        saveNow,
        status,
    };
}
