// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    CREATOR_ASSET_DATABASE_NAME,
    saveCreatorAsset,
} from '@/lib/creatorAssets';
import CreatorAssetShelf from './CreatorAssetShelf';

function deleteAssetDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(CREATOR_ASSET_DATABASE_NAME);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Asset DB deletion blocked'));
    });
}

describe('CreatorAssetShelf', () => {
    beforeEach(async () => {
        await deleteAssetDatabase();
        vi.stubGlobal(
            'URL',
            Object.assign(URL, {
                createObjectURL: vi.fn(() => 'blob:creator-asset'),
                revokeObjectURL: vi.fn(),
            })
        );
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('saves a reusable image and adds it back to the current canvas', async () => {
        const onAddAsset = vi.fn().mockResolvedValue(undefined);
        render(<CreatorAssetShelf onAddAsset={onAddAsset} />);

        expect(
            await screen.findByText('Your reusable cutouts, logos, and reaction images live here.')
        ).toBeInTheDocument();

        const file = new File(['image'], 'reaction-face.png', {
            type: 'image/png',
        });
        fireEvent.change(screen.getByLabelText('Save reusable image'), {
            target: { files: [file] },
        });

        const addButton = await screen.findByRole('button', {
            name: 'Add reaction-face.png to canvas',
        });
        fireEvent.click(addButton);

        await waitFor(() => expect(onAddAsset).toHaveBeenCalledOnce());
        expect(onAddAsset).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'reaction-face.png',
                mimeType: 'image/png',
            })
        );
        await waitFor(() => expect(addButton).not.toBeDisabled());
    });

    it('deletes an asset without changing the current canvas', async () => {
        render(<CreatorAssetShelf onAddAsset={vi.fn()} />);
        const file = new File(['logo'], 'page-logo.webp', {
            type: 'image/webp',
        });
        fireEvent.change(screen.getByLabelText('Save reusable image'), {
            target: { files: [file] },
        });

        const deleteButton = await screen.findByRole('button', {
            name: 'Delete page-logo.webp',
        });
        fireEvent.click(deleteButton);

        await waitFor(() =>
            expect(
                screen.queryByRole('button', {
                    name: 'Delete page-logo.webp',
                })
            ).not.toBeInTheDocument()
        );
    });

    it('does not report canvas insertion as failed when recency refresh fails', async () => {
        const onAddAsset = vi.fn().mockResolvedValue(undefined);
        render(<CreatorAssetShelf onAddAsset={onAddAsset} />);
        const file = new File(['logo'], 'safe-logo.png', {
            type: 'image/png',
        });
        fireEvent.change(screen.getByLabelText('Save reusable image'), {
            target: { files: [file] },
        });

        const addButton = await screen.findByRole('button', {
            name: 'Add safe-logo.png to canvas',
        });
        vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementationOnce(() => {
            throw new Error('Recency write failed');
        });
        fireEvent.click(addButton);

        await waitFor(() => expect(onAddAsset).toHaveBeenCalledOnce());
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Added to the canvas, but the shelf order could not be refreshed.'
        );
        expect(screen.getByRole('alert')).not.toHaveTextContent(
            'Could not add this asset to the canvas.'
        );
    });

    it('reports an upload as saved when only the shelf refresh fails', async () => {
        const originalGetAll = IDBObjectStore.prototype.getAll;
        let getAllCalls = 0;
        vi.spyOn(IDBObjectStore.prototype, 'getAll').mockImplementation(
            function (this: IDBObjectStore, query, count) {
                getAllCalls += 1;
                if (getAllCalls === 3) {
                    throw new Error('Refresh unavailable');
                }
                return originalGetAll.call(this, query, count);
            }
        );
        render(<CreatorAssetShelf onAddAsset={vi.fn()} />);
        await screen.findByText('Save your first reusable asset');

        fireEvent.change(screen.getByLabelText('Save reusable image'), {
            target: {
                files: [
                    new File(['logo'], 'saved-logo.png', {
                        type: 'image/png',
                    }),
                ],
            },
        });

        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Saved locally, but the shelf could not be refreshed.'
        );
        expect(screen.getByRole('alert')).not.toHaveTextContent(
            'Could not save this image.'
        );
    });

    it('loads thumbnails near the viewport and releases them offscreen', async () => {
        let observerCallback:
            | ((entries: IntersectionObserverEntry[]) => void)
            | undefined;
        let observedElement: Element | undefined;
        class TestIntersectionObserver {
            constructor(
                callback: (entries: IntersectionObserverEntry[]) => void
            ) {
                observerCallback = callback;
            }

            observe(element: Element) {
                observedElement = element;
            }

            disconnect() {}
            unobserve() {}
            takeRecords() {
                return [];
            }
            root = null;
            rootMargin = '';
            thresholds = [];
        }
        vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
        await saveCreatorAsset({
            blob: new Blob(['thumbnail'], { type: 'image/webp' }),
            name: 'thumbnail.webp',
        });

        render(<CreatorAssetShelf onAddAsset={vi.fn()} />);
        await screen.findByRole('button', {
            name: 'Add thumbnail.webp to canvas',
        });
        expect(URL.createObjectURL).not.toHaveBeenCalled();

        act(() => {
            observerCallback?.([
                {
                    target: observedElement,
                    isIntersecting: true,
                } as IntersectionObserverEntry,
            ]);
        });
        await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce());

        act(() => {
            observerCallback?.([
                {
                    target: observedElement,
                    isIntersecting: false,
                } as IntersectionObserverEntry,
            ]);
        });
        await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledOnce());
    });
});
