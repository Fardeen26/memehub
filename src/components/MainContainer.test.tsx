// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelectedProvider from '@/context/SelectedContext';
import { createEditorDraft, type MemeEditorDraftState } from '@/lib/editorDraft';
import {
    deleteActiveMemeDraft,
    deleteActiveMemeDraftIfCurrent,
    inspectActiveMemeDraft,
    loadActiveMemeDraft,
    saveActiveMemeDraft,
} from '@/lib/memeDraft';
import MainContainer from './MainContainer';

vi.mock('./DynamicMemeEditor', () => ({
    default: ({
        onReset,
        template,
    }: {
        onReset: () => void;
        template: { displayName?: string };
    }) => (
        <div>
            <p>Editor open</p>
            <p>{template.displayName}</p>
            <button type="button" onClick={onReset}>
                Leave editor
            </button>
        </div>
    ),
}));

vi.mock('./TemplateSelector', () => ({
    default: ({ onSelect }: { onSelect: (key: string) => void }) => (
        <div>
            <p>Template gallery</p>
            <button type="button" onClick={() => onSelect('fresh-template')}>
                Use fresh template
            </button>
        </div>
    ),
}));

const savedState: MemeEditorDraftState = {
    template: {
        image: 'data:image/png;base64,cmVzdW1l',
        displayName: 'Resume me',
        textBoxes: [],
    },
    texts: [],
    textBoxes: [],
    textBoxRotations: [],
    textSettings: [],
    imageOverlays: [],
    shapeOverlays: [],
    strokes: [],
};

describe('MainContainer saved draft navigation', () => {
    afterEach(cleanup);

    beforeEach(async () => {
        await deleteActiveMemeDraft();
        await saveActiveMemeDraft(createEditorDraft(savedState, 100));
    });

    it('keeps saved content private until the creator explicitly resumes it', async () => {
        render(
            <SelectedProvider>
                <MainContainer templates={{}} />
            </SelectedProvider>
        );

        expect(screen.queryByText('Template gallery')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent(
            'Checking for a saved draft'
        );

        await screen.findByRole('button', { name: 'Resume saved draft' });
        expect(screen.getByText('Template gallery')).toBeInTheDocument();
        expect(screen.queryByText('Resume me')).not.toBeInTheDocument();
        expect(screen.queryByText('Editor open')).not.toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', { name: 'Resume saved draft' })
        );
        await screen.findByText('Editor open');
        expect(screen.getByText('Resume me')).toBeInTheDocument();
    });

    it('lets a creator leave, resume, or intentionally discard the saved draft', async () => {
        render(
            <SelectedProvider>
                <MainContainer templates={{}} />
            </SelectedProvider>
        );

        fireEvent.click(
            await screen.findByRole('button', { name: 'Resume saved draft' })
        );
        await screen.findByText('Editor open');
        fireEvent.click(screen.getByRole('button', { name: 'Leave editor' }));

        const resumeButton = await screen.findByRole('button', {
            name: 'Resume saved draft',
        });
        expect(screen.getByText('Template gallery')).toBeInTheDocument();

        fireEvent.click(resumeButton);
        await screen.findByText('Editor open');
        fireEvent.click(screen.getByRole('button', { name: 'Leave editor' }));

        fireEvent.click(
            await screen.findByRole('button', { name: 'Discard saved draft' })
        );

        await waitFor(() => {
            expect(
                screen.queryByRole('button', { name: 'Resume saved draft' })
            ).not.toBeInTheDocument();
        });
        await expect(loadActiveMemeDraft()).resolves.toBeNull();
    });

    it('requires confirmation before a new template replaces a saved draft', async () => {
        const confirmReplacement = vi
            .spyOn(window, 'confirm')
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);

        render(
            <SelectedProvider>
                <MainContainer
                    templates={{
                        'fresh-template': {
                            image: 'data:image/png;base64,ZnJlc2g=',
                            displayName: 'Fresh template',
                            textBoxes: [],
                        },
                    }}
                />
            </SelectedProvider>
        );

        await screen.findByRole('button', { name: 'Resume saved draft' });

        fireEvent.click(
            screen.getByRole('button', { name: 'Use fresh template' })
        );

        await waitFor(() => expect(confirmReplacement).toHaveBeenCalledOnce());
        expect(
            screen.getByRole('button', { name: 'Resume saved draft' })
        ).toBeInTheDocument();
        await expect(loadActiveMemeDraft()).resolves.not.toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Use fresh template' })
        );

        await screen.findByText('Fresh template');
        expect(confirmReplacement).toHaveBeenCalledTimes(2);
        await expect(loadActiveMemeDraft()).resolves.toBeNull();

        confirmReplacement.mockRestore();
    });

    it('protects a future-version draft from implicit replacement', async () => {
        await deleteActiveMemeDraft();
        const databaseRequest = indexedDB.open('memehub-meme-drafts', 1);
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            databaseRequest.onsuccess = () => resolve(databaseRequest.result);
            databaseRequest.onerror = () => reject(databaseRequest.error);
        });
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction('drafts', 'readwrite');
            transaction.objectStore('drafts').put(
                {
                    schemaVersion: 2,
                    updatedAt: 200,
                    state: { futureOnlyField: true },
                },
                'active'
            );
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
        database.close();

        render(
            <SelectedProvider>
                <MainContainer
                    templates={{
                        'fresh-template': {
                            image: 'data:image/png;base64,ZnJlc2g=',
                            displayName: 'Fresh template',
                            textBoxes: [],
                        },
                    }}
                />
            </SelectedProvider>
        );

        await screen.findByText('Saved draft needs attention');
        expect(
            screen.queryByRole('button', { name: 'Resume saved draft' })
        ).not.toBeInTheDocument();

        vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
        fireEvent.click(
            screen.getByRole('button', { name: 'Use fresh template' })
        );

        expect(await inspectActiveMemeDraft()).toMatchObject({
            status: 'unsupported',
        });
        expect(screen.queryByText('Editor open')).not.toBeInTheDocument();
        vi.restoreAllMocks();
    });

    it('does not let a stale gallery discard a newer revision from another tab', async () => {
        render(
            <SelectedProvider>
                <MainContainer templates={{}} />
            </SelectedProvider>
        );

        await screen.findByRole('button', { name: 'Discard saved draft' });
        await saveActiveMemeDraft(createEditorDraft(savedState, 101));

        fireEvent.click(
            screen.getByRole('button', { name: 'Discard saved draft' })
        );

        await waitFor(async () => {
            expect(await loadActiveMemeDraft()).toMatchObject({
                updatedAt: 101,
            });
        });
        expect(
            await deleteActiveMemeDraftIfCurrent({
                schemaVersion: 1,
                updatedAt: 100,
            })
        ).toBe('conflict');
    });

    it('rechecks storage before selection when another tab creates a draft', async () => {
        await deleteActiveMemeDraft();
        render(
            <SelectedProvider>
                <MainContainer
                    templates={{
                        'fresh-template': {
                            image: 'data:image/png;base64,ZnJlc2g=',
                            displayName: 'Fresh template',
                            textBoxes: [],
                        },
                    }}
                />
            </SelectedProvider>
        );
        await screen.findByText('Template gallery');

        await saveActiveMemeDraft(createEditorDraft(savedState, 500));
        const confirmReplacement = vi
            .spyOn(window, 'confirm')
            .mockReturnValueOnce(false);

        fireEvent.click(
            screen.getByRole('button', { name: 'Use fresh template' })
        );

        await waitFor(() => expect(confirmReplacement).toHaveBeenCalledOnce());
        expect(screen.queryByText('Editor open')).not.toBeInTheDocument();
        await expect(loadActiveMemeDraft()).resolves.toMatchObject({
            updatedAt: 500,
        });
    });
});
