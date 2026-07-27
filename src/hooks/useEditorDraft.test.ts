// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import {
    act,
    cleanup,
    fireEvent,
    renderHook,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createEditorDraft,
    MAX_DRAFT_LOCAL_MEDIA_BYTES,
    type MemeEditorDraftState,
} from '@/lib/editorDraft';
import {
    deleteActiveMemeDraft,
    loadActiveMemeDraft,
    saveActiveMemeDraft,
} from '@/lib/memeDraft';
import { useEditorDraft } from './useEditorDraft';

function makeState(text: string): MemeEditorDraftState {
    const textBox = {
        x: 10,
        y: 20,
        width: 300,
        height: 80,
        fontSize: 42,
        minFont: 10,
        align: 'center' as const,
    };

    return {
        template: {
            image: 'data:image/png;base64,dGVtcGxhdGU=',
            displayName: 'Recovery test',
            textBoxes: [textBox],
        },
        texts: [text],
        textBoxes: [textBox],
        textBoxRotations: [0],
        textSettings: [
            {
                fontSize: 42,
                color: '#ffffff',
                fontFamily: 'Impact',
                fontWeight: '900',
                letterSpacing: 0,
                textCase: 'normal',
                backgroundColor: 'transparent',
                backgroundRadius: 0,
                outline: { width: 1, color: '#000000' },
                shadow: {
                    blur: 5,
                    offsetX: 1,
                    offsetY: 1,
                    color: '#000000',
                },
            },
        ],
        imageOverlays: [],
        shapeOverlays: [],
        strokes: [],
    };
}

describe('useEditorDraft', () => {
    afterEach(cleanup);

    beforeEach(async () => {
        await deleteActiveMemeDraft();
    });

    it('restores the matching editor scene before autosaving current defaults', async () => {
        const savedState = makeState('Recovered punchline');
        const currentState = makeState('');
        const onRestore = vi.fn();
        await saveActiveMemeDraft(createEditorDraft(savedState, 100));

        const { result } = renderHook(() =>
            useEditorDraft({
                state: currentState,
                onRestore,
                restoreSavedDraft: true,
                expectedDraftUpdatedAt: 100,
                debounceMs: 5,
            })
        );

        await waitFor(() => {
            expect(onRestore).toHaveBeenCalledWith(savedState);
            expect(result.current.status).toBe('saved');
        });

        expect((await loadActiveMemeDraft<MemeEditorDraftState>())?.state).toEqual(
            savedState
        );
    });

    it('rejects an immediate flush during restore without overwriting the saved draft', async () => {
        const savedState = makeState('Keep this recovered punchline');
        const currentState = makeState('');
        await saveActiveMemeDraft(createEditorDraft(savedState, 100));

        const { result } = renderHook(() =>
            useEditorDraft({
                state: currentState,
                onRestore: vi.fn(),
                restoreSavedDraft: true,
                expectedDraftUpdatedAt: 100,
                debounceMs: 5,
            })
        );

        await expect(result.current.saveNow()).rejects.toThrow(
            'still being restored'
        );
        await waitFor(() => expect(result.current.isReady).toBe(true));

        expect((await loadActiveMemeDraft<MemeEditorDraftState>())?.state).toEqual(
            savedState
        );
    });

    it('debounces and persists the latest complete editor scene', async () => {
        const onRestore = vi.fn();
        const initialState = makeState('');
        const updatedState = makeState('Latest punchline');
        const { result, rerender } = renderHook(
            ({ state }) =>
                useEditorDraft({
                    state,
                    onRestore,
                    debounceMs: 5,
                }),
            { initialProps: { state: initialState } }
        );

        await waitFor(() => expect(result.current.isReady).toBe(true));
        rerender({ state: updatedState });

        await waitFor(() => expect(result.current.status).toBe('saved'));
        expect((await loadActiveMemeDraft<MemeEditorDraftState>())?.state).toEqual(
            updatedState
        );
    });

    it('can flush the latest scene immediately before leaving the editor', async () => {
        const initialState = makeState('');
        const updatedState = makeState('Saved before back');
        const { result, rerender } = renderHook(
            ({ state }) =>
                useEditorDraft({
                    state,
                    onRestore: vi.fn(),
                    debounceMs: 60_000,
                }),
            { initialProps: { state: initialState } }
        );

        await waitFor(() => expect(result.current.isReady).toBe(true));
        rerender({ state: updatedState });

        expect(typeof (result.current as Record<string, unknown>).saveNow).toBe(
            'function'
        );
        await act(async () => {
            await (
                result.current as typeof result.current & {
                    saveNow: () => Promise<void>;
                }
            ).saveNow();
        });

        expect((await loadActiveMemeDraft<MemeEditorDraftState>())?.state).toEqual(
            updatedState
        );
    });

    it('never writes a scene that is too large to restore safely', async () => {
        const unsafeState = makeState('Keep the recoverable version');
        const bytesPerOverlay = Math.ceil(
            MAX_DRAFT_LOCAL_MEDIA_BYTES / 100
        );
        const sharedSource = `data:image/png;base64,${'A'.repeat(
            Math.ceil((bytesPerOverlay * 4) / 3)
        )}`;
        unsafeState.imageOverlays = Array.from(
            { length: 101 },
            (_, index) => ({
                id: `oversized-overlay-${index}`,
                src: sharedSource,
                label: `Large image ${index + 1}`,
                animated: false,
                mimeType: 'image/png',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                originalWidth: 100,
                originalHeight: 100,
                opacity: 1,
                rotation: 0,
                eraseStrokes: [],
            })
        );

        const { result } = renderHook(() =>
            useEditorDraft({
                state: unsafeState,
                onRestore: vi.fn(),
                debounceMs: 60_000,
            })
        );

        await waitFor(() => expect(result.current.isReady).toBe(true));
        await expect(result.current.saveNow()).rejects.toThrow(
            'saved-image limit'
        );
        await expect(loadActiveMemeDraft()).resolves.toBeNull();
    });

    it('locks editing while an explicit leave flush is in flight', async () => {
        const { result } = renderHook(() =>
            useEditorDraft({
                state: makeState('Do not edit during the leave flush'),
                onRestore: vi.fn(),
                debounceMs: 60_000,
            })
        );

        await waitFor(() => expect(result.current.isReady).toBe(true));

        let savePromise!: Promise<void>;
        act(() => {
            savePromise = result.current.saveNow();
        });

        expect(result.current.canEdit).toBe(false);

        await act(async () => {
            await savePromise;
        });
        expect(result.current.canEdit).toBe(true);
    });

    it('flushes pending changes when the page is being hidden', async () => {
        const initialState = makeState('');
        const updatedState = makeState('Saved on page hide');
        const { result, rerender } = renderHook(
            ({ state }) =>
                useEditorDraft({
                    state,
                    onRestore: vi.fn(),
                    debounceMs: 60_000,
                }),
            { initialProps: { state: initialState } }
        );

        await waitFor(() => expect(result.current.isReady).toBe(true));
        rerender({ state: updatedState });
        fireEvent(window, new Event('pagehide'));

        await waitFor(async () => {
            expect(
                (await loadActiveMemeDraft<MemeEditorDraftState>())?.state
            ).toEqual(updatedState);
        });
    });

    it('waits for pending editor work before a page-hide flush', async () => {
        let releasePendingWork:
            | ((state: MemeEditorDraftState) => void)
            | undefined;
        const beforeSave = vi.fn(
            () =>
                new Promise<MemeEditorDraftState>((resolve) => {
                    releasePendingWork = resolve;
                })
        );
        const { result } = renderHook(() =>
            useEditorDraft({
                state: makeState('Saved after pending image'),
                onRestore: vi.fn(),
                beforeSave,
                debounceMs: 60_000,
            })
        );

        await waitFor(() => expect(result.current.isReady).toBe(true));
        fireEvent(window, new Event('pagehide'));
        await waitFor(() => expect(beforeSave).toHaveBeenCalledOnce());
        await expect(loadActiveMemeDraft()).resolves.toBeNull();

        releasePendingWork?.(makeState('Snapshot after pending image'));

        await waitFor(async () => {
            expect(
                (await loadActiveMemeDraft<MemeEditorDraftState>())?.state
                    .texts[0]
            ).toBe('Snapshot after pending image');
        });
    });

    it('does not let a stale tab overwrite a newer saved revision', async () => {
        const baseState = makeState('Base revision');
        const newerState = makeState('Saved by another tab');
        const staleState = makeState('Stale tab edit');
        await saveActiveMemeDraft(createEditorDraft(baseState, 100));

        const { result, rerender } = renderHook(
            ({ state }) =>
                useEditorDraft({
                    state,
                    onRestore: vi.fn(),
                    restoreSavedDraft: true,
                    expectedDraftUpdatedAt: 100,
                    debounceMs: 60_000,
                }),
            { initialProps: { state: baseState } }
        );
        await waitFor(() => expect(result.current.isReady).toBe(true));

        await saveActiveMemeDraft(createEditorDraft(newerState, 200));
        rerender({ state: staleState });

        await expect(result.current.saveNow()).rejects.toThrow(
            'A newer draft revision exists in another tab'
        );
        expect((await loadActiveMemeDraft<MemeEditorDraftState>())?.state).toEqual(
            newerState
        );
    });

    it('does not adopt and overwrite a draft for a different template', async () => {
        const otherTemplateState = {
            ...makeState('Do not replace me'),
            template: {
                ...makeState('').template,
                image: 'data:image/png;base64,b3RoZXI=',
            },
        };
        await saveActiveMemeDraft(createEditorDraft(otherTemplateState, 300));

        const { result } = renderHook(() =>
            useEditorDraft({
                state: makeState('New template edit'),
                onRestore: vi.fn(),
                debounceMs: 60_000,
            })
        );
        await waitFor(() => expect(result.current.isReady).toBe(true));

        await expect(result.current.saveNow()).rejects.toThrow(
            'A newer draft revision exists in another tab'
        );
        expect((await loadActiveMemeDraft<MemeEditorDraftState>())?.state).toEqual(
            otherTemplateState
        );
    });

    it('blocks editing when an explicitly resumed draft was deleted before hydration', async () => {
        const savedState = makeState('Deleted in another tab');
        await saveActiveMemeDraft(createEditorDraft(savedState, 400));
        await deleteActiveMemeDraft();

        const { result } = renderHook(() =>
            useEditorDraft({
                state: makeState('Blank defaults'),
                onRestore: vi.fn(),
                restoreSavedDraft: true,
                expectedDraftUpdatedAt: 400,
                debounceMs: 5,
            })
        );

        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current.canEdit).toBe(false);
        await expect(result.current.saveNow()).rejects.toThrow(
            'changed in another tab'
        );
        await expect(loadActiveMemeDraft()).resolves.toBeNull();
    });
});
