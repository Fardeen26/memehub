// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import MemeEditor from './MemeEditor';
import * as editorDraftSchema from '@/lib/editorDraft';

const editorDraftMock = vi.hoisted(() => ({
    beforeSave: null as
        | (() => Promise<import('@/lib/editorDraft').MemeEditorDraftState>)
        | null,
    canEdit: true,
    isReady: true,
    restoreError: null as string | null,
    saveNow: vi.fn().mockResolvedValue(undefined),
    status: 'saved',
}));

const canvasExportMock = vi.hoisted(() => ({
    downloadBlob: vi.fn(),
    renderSceneToImageBlob: vi
        .fn()
        .mockResolvedValue(new Blob(['image'], { type: 'image/png' })),
}));
const reusableImagePersistenceMock = vi.hoisted(() => ({
    materializeReusableImage: vi.fn(
        async () =>
            new File(['test'], 'licensed-reaction.jpg', {
                type: 'image/jpeg',
            })
    ),
}));
const canvasShapeMock = vi.hoisted(() => ({
    hitExistingShape: false,
}));

vi.mock('@/hooks/useEditorDraft', () => ({
    useEditorDraft: (options: {
        beforeSave?: () => Promise<
            import('@/lib/editorDraft').MemeEditorDraftState
        >;
    }) => {
        editorDraftMock.beforeSave = options.beforeSave ?? null;
        return editorDraftMock;
    },
}));

vi.mock('@/lib/canvasExport', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/canvasExport')>()),
    downloadBlob: canvasExportMock.downloadBlob,
    renderSceneToImageBlob: canvasExportMock.renderSceneToImageBlob,
}));

vi.mock('@/lib/reusableImagePersistence', () => ({
    materializeReusableImage:
        reusableImagePersistenceMock.materializeReusableImage,
}));

vi.mock('@/hooks/useFontLoader', () => ({
    FONT_CONFIGS: {},
    getCanonicalFontFamily: (fontFamily: string) => fontFamily,
    useFontLoader: () => ({
        loadFont: vi.fn().mockResolvedValue(undefined),
        preloadFont: vi.fn(),
    }),
}));

vi.mock('@/hooks/useCanvasShapes', async () => {
    const { useState } = await import('react');

    return {
        useCanvasShapes: () => {
            const [shapeOverlays, setShapeOverlays] = useState<
                Array<{
                    id: string;
                    type: 'rectangle';
                    x: number;
                    y: number;
                    width: number;
                    height: number;
                    rotation: number;
                    strokeColor: string;
                    fillColor: string;
                    strokeWidth: number;
                    filled: boolean;
                    opacity: number;
                }>
            >([]);
            const [selectedShapeIndex, setSelectedShapeIndex] = useState(-1);

            return {
                shapeOverlays,
                replaceShapes: (
                    nextShapes: typeof shapeOverlays
                ) => {
                    setShapeOverlays(nextShapes);
                    setSelectedShapeIndex(-1);
                },
                selectedShapeIndex,
                setSelectedShapeIndex,
                addShape: () =>
                    setShapeOverlays((current) => {
                        setSelectedShapeIndex(current.length);
                        return [
                            ...current,
                            {
                                id: `shape-${current.length + 1}`,
                                type: 'rectangle',
                                x: 20,
                                y: 20,
                                width: 120,
                                height: 80,
                                rotation: 0,
                                strokeColor: '#ef4444',
                                fillColor: '#ef4444',
                                strokeWidth: 4,
                                filled: false,
                                opacity: 1,
                            },
                        ];
                    }),
                removeShape: (index: number) =>
                    setShapeOverlays((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index)
                    ),
                updateShape: vi.fn(),
                tryShapeMouseDown: vi.fn(() => {
                    if (
                        canvasShapeMock.hitExistingShape &&
                        shapeOverlays.length > 0
                    ) {
                        setSelectedShapeIndex(0);
                        return true;
                    }
                    return false;
                }),
                handleShapeMouseMove: vi.fn(),
                endShapeInteraction: vi.fn(),
                drawShapesLayer: vi.fn(),
                isShapeInteracting: false,
                getShapeAtPosition: vi.fn(() => ({ index: -1, handle: '' })),
            };
        },
    };
});

vi.mock('@/components/ElementsPanel', () => ({
    default: ({
        onAddMedia,
        onAddShape,
    }: {
        onAddMedia: (item: {
            id: string;
            title: string;
            url: string;
            previewUrl: string;
            stillUrl: string;
            animated: boolean;
            mimeHint: string;
        }) => void | Promise<void>;
        onAddShape: (type: 'rectangle') => void;
    }) => (
        <>
            <button
                type="button"
                onClick={() =>
                    onAddMedia({
                        id: 'test-sticker',
                        title: 'Test reaction sticker',
                        url: 'data:image/png;base64,dGVzdA==',
                        previewUrl: 'data:image/png;base64,dGVzdA==',
                        stillUrl: 'data:image/png;base64,dGVzdA==',
                        animated: false,
                        mimeHint: 'image/png',
                    })
                }
            >
                Add test reaction sticker
            </button>
            <button
                type="button"
                onClick={() => onAddShape('rectangle')}
            >
                Add test rectangle
            </button>
        </>
    ),
}));

vi.mock('@/components/CreatorDiscoveryPanel', () => ({
    default: ({
        onAddImage,
        onUseAsTemplate,
    }: {
        onAddImage: (asset: {
            id: string;
            title: string;
            assetUrl: string;
            previewUrl: string;
            sourceUrl: string;
            width: number;
            height: number;
            mimeType: 'image/jpeg';
            creator: string;
            licenseName: string;
            licenseUrl: string;
            provider: 'Wikimedia Commons';
            rights: 'share-alike';
        }) => void | Promise<void>;
        onUseAsTemplate?: (asset: {
            id: string;
            title: string;
            assetUrl: string;
            previewUrl: string;
            sourceUrl: string;
            width: number;
            height: number;
            mimeType: 'image/jpeg';
            creator: string;
            licenseName: string;
            licenseUrl: string;
            provider: 'Wikimedia Commons';
            rights: 'share-alike';
        }) => void | Promise<void>;
    }) => (
        <div>
            <p>Test India discovery</p>
            <button
                type="button"
                onClick={() => {
                    void Promise.resolve(
                        onAddImage({
                            id: 'commons-test',
                            title: 'Licensed reaction photo',
                            assetUrl: 'data:image/jpeg;base64,dGVzdA==',
                            previewUrl: 'data:image/jpeg;base64,dGVzdA==',
                            sourceUrl:
                                'https://commons.wikimedia.org/wiki/File:Reaction.jpg',
                            width: 240,
                            height: 180,
                            mimeType: 'image/jpeg',
                            creator: 'Example photographer',
                            licenseName: 'CC BY-SA 4.0',
                            licenseUrl:
                                'https://creativecommons.org/licenses/by-sa/4.0/',
                            provider: 'Wikimedia Commons',
                            rights: 'share-alike',
                        })
                    ).catch(() => undefined);
                }}
            >
                Add test discovered image
            </button>
            {onUseAsTemplate && (
                <button
                    type="button"
                    onClick={() => {
                        void Promise.resolve(
                            onUseAsTemplate({
                                id: 'commons-test',
                                title: 'Licensed reaction photo',
                                assetUrl: 'data:image/jpeg;base64,dGVzdA==',
                                previewUrl: 'data:image/jpeg;base64,dGVzdA==',
                                sourceUrl:
                                    'https://commons.wikimedia.org/wiki/File:Reaction.jpg',
                                width: 240,
                                height: 180,
                                mimeType: 'image/jpeg',
                                creator: 'Example photographer',
                                licenseName: 'CC BY-SA 4.0',
                                licenseUrl:
                                    'https://creativecommons.org/licenses/by-sa/4.0/',
                                provider: 'Wikimedia Commons',
                                rights: 'share-alike',
                            })
                        ).catch(() => undefined);
                    }}
                >
                    Use test discovered image as template
                </button>
            )}
        </div>
    ),
}));

beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
    editorDraftMock.isReady = true;
    editorDraftMock.canEdit = true;
    editorDraftMock.beforeSave = null;
    editorDraftMock.restoreError = null;
    editorDraftMock.status = 'saved';
    editorDraftMock.saveNow.mockReset();
    editorDraftMock.saveNow.mockResolvedValue(undefined);
    canvasExportMock.downloadBlob.mockReset();
    canvasExportMock.renderSceneToImageBlob.mockReset();
    canvasExportMock.renderSceneToImageBlob.mockResolvedValue(
        new Blob(['image'], { type: 'image/png' })
    );
    reusableImagePersistenceMock.materializeReusableImage.mockReset();
    reusableImagePersistenceMock.materializeReusableImage.mockImplementation(
        async () =>
            new File(['test'], 'licensed-reaction.jpg', {
                type: 'image/jpeg',
            })
    );
    canvasShapeMock.hitExistingShape = false;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('MemeEditor accessibility', () => {
    it('starts with the canvas tool panel open and switches to the chosen tool', async () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        expect(
            screen.getByRole('tablist', { name: 'Creator workspace' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('region', { name: 'Meme canvas' })
        ).not.toHaveClass('lg:h-[calc(100dvh-8.5rem)]');
        expect(
            screen.getByRole('complementary', {
                name: 'Properties inspector',
            })
        ).toHaveClass('lg:self-start');
        expect(
            within(
                screen.getByRole('toolbar', {
                    name: 'Canvas quick tools',
                })
            ).getByRole('button', { name: 'Add Text' })
        ).toBeInTheDocument();
        expect(
            within(
                screen.getByRole('complementary', {
                    name: 'Properties inspector',
                })
            ).queryByRole('button', { name: 'Add Text' })
        ).not.toBeInTheDocument();
        const quickUpload = within(
            screen.getByRole('toolbar', {
                name: 'Canvas quick tools',
            })
        ).getByRole('button', { name: 'Upload' });
        quickUpload.focus();
        fireEvent.click(quickUpload);
        expect(
            screen.getByRole('dialog', { name: 'Upload Image' })
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(quickUpload).toHaveFocus());
        const quickDraw = within(
            screen.getByRole('toolbar', {
                name: 'Canvas quick tools',
            })
        ).getByRole('button', { name: 'Draw' });
        fireEvent.click(quickDraw);
        expect(
            screen.getByTitle('Stroke Size').closest('div')
        ).toHaveClass('flex-wrap');
        fireEvent.click(quickDraw);
        expect(screen.getByRole('tab', { name: 'Images' })).toHaveAttribute(
            'aria-selected',
            'true'
        );
        expect(
            screen.getByRole('button', { name: 'Collapse tools' })
        ).toHaveAttribute('aria-expanded', 'true');
        expect(
            screen
                .getByText('Test India discovery')
                .closest('[role="tabpanel"]')
        ).not.toHaveAttribute('hidden');
        expect(screen.getByRole('tab', { name: 'Text' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'My assets' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Layers' })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Export' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
        expect(
            screen.getByRole('button', { name: 'Apply Classic Meme style' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Apply Hindi Bold style' })
        ).toBeInTheDocument();
    });

    it('applies a visible one-tap text style to the focused text layer', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
        fireEvent.focus(screen.getByRole('textbox', { name: 'text position 1' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Apply Hindi Bold style' })
        );

        expect(screen.getByText('Hindi Bold applied to Text 1')).toBeInTheDocument();
    });

    it('shows text in the layer workspace and lets creators hide it non-destructively', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));
        expect(screen.getByText('Text 1')).toBeInTheDocument();

        const hideButton = screen.getByRole('button', { name: 'Hide Text 1' });
        fireEvent.click(hideButton);

        expect(
            screen.getByRole('button', { name: 'Show Text 1' })
        ).toBeInTheDocument();
    });

    it('puts platform and image-format choices in the export workspace', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Export' }));

        expect(screen.getByRole('radio', { name: 'Original size' })).toBeChecked();
        expect(
            screen.getByRole('radio', { name: 'Instagram portrait' })
        ).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: 'Instagram story' })).toBeInTheDocument();
        expect(screen.getByRole('combobox', { name: 'Image format' })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'Export original PNG' })
        ).toBeInTheDocument();
    });

    it('preserves the original canvas and transparency for original-size export', async () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Export' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Export original PNG' })
        );

        await vi.waitFor(() =>
            expect(canvasExportMock.renderSceneToImageBlob).toHaveBeenCalledOnce()
        );
        const options =
            canvasExportMock.renderSceneToImageBlob.mock.calls[0][2];

        expect(options).toMatchObject({ mimeType: 'image/png' });
        expect(options).not.toHaveProperty('width');
        expect(options).not.toHaveProperty('height');
        expect(options).not.toHaveProperty('backgroundColor');
    });

    it('keeps exactly one layer selected after adding a reaction image', async () => {
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }

        vi.stubGlobal('Image', LoadedImage);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.focus(screen.getByRole('textbox', { name: 'text position 1' }));
        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test reaction sticker' })
        );

        await vi.waitFor(() =>
            expect(screen.getByRole('tab', { name: 'Layers' })).toHaveAttribute(
                'aria-selected',
                'true'
            )
        );

        expect(
            screen.getByRole('button', {
                name: /Test reaction sticker.*240 × 180 px/,
            })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            screen.getByRole('button', { name: /Text 1.*Empty text layer/ })
        ).toHaveAttribute('aria-pressed', 'false');
    });

    it('keeps attribution attached after adding a discovered image', async () => {
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', {
                    name: 'Add test discovered image',
                })
            );
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(
            screen.getByRole('tab', { name: 'Images' })
        ).toHaveAttribute('aria-selected', 'true');
        expect(
            reusableImagePersistenceMock.materializeReusableImage
        ).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));

        expect(
            await screen.findByRole('link', {
                name: 'Open original media source',
            })
        ).toHaveAttribute(
            'href',
            'https://commons.wikimedia.org/wiki/File:Reaction.jpg'
        );
        expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
    });

    it('refuses a new local image before it can exceed the recoverable draft budget', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const capacityCheck = vi
            .spyOn(
                editorDraftSchema,
                'assertMemeEditorDraftLocalMediaCapacity'
            )
            .mockImplementationOnce(() => {
                throw new Error(
                    'This project has reached its saved-image limit.'
                );
            });
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Add test discovered image',
            })
        );

        await vi.waitFor(() =>
            expect(capacityCheck).toHaveBeenCalledOnce()
        );
        const snapshot = await editorDraftMock.beforeSave!();
        expect(snapshot.imageOverlays).toEqual([]);
    });

    it('checks the recoverable draft budget before duplicating an image layer', async () => {
        const capacityCheck = vi
            .spyOn(
                editorDraftSchema,
                'assertMemeEditorDraftLocalMediaCapacity'
            )
            .mockImplementationOnce(() => undefined)
            .mockImplementationOnce(() => {
                throw new Error(
                    'This project has reached its saved-image limit.'
                );
            });
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Add test reaction sticker',
            })
        );
        const duplicate = await screen.findByRole('button', {
            name: 'Duplicate Test reaction sticker',
        });
        fireEvent.click(duplicate);

        expect(capacityCheck).toHaveBeenCalledTimes(2);
        expect(
            screen.getAllByRole('button', {
                name: /Test reaction sticker.*240 × 180 px/,
            })
        ).toHaveLength(1);
    });

    it('does not let an intervening canvas selection consume the discovery insertion intent', async () => {
        const mediaLog = vi
            .spyOn(console, 'info')
            .mockImplementation(() => {});
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        let releaseMaterialization: ((file: File) => void) | undefined;
        reusableImagePersistenceMock.materializeReusableImage.mockImplementationOnce(
            () =>
                new Promise<File>((resolve) => {
                    releaseMaterialization = resolve;
                })
        );

        const { container } = render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 0,
                            y: 0,
                            width: 30,
                            height: 20,
                            fontSize: 12,
                            minFont: 8,
                            align: 'left',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test reaction sticker' })
        );
        await vi.waitFor(() =>
            expect(screen.getByRole('tab', { name: 'Layers' })).toHaveAttribute(
                'aria-selected',
                'true'
            )
        );

        fireEvent.focus(
            screen.getByRole('textbox', { name: 'text position 1' })
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test discovered image' })
        );
        await vi.waitFor(() =>
            expect(releaseMaterialization).toEqual(expect.any(Function))
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).not.toBeNull();
        vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
            bottom: 180,
            height: 180,
            left: 0,
            right: 240,
            top: 0,
            width: 240,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });
        fireEvent.mouseDown(canvas!, { clientX: 120, clientY: 90 });
        await vi.waitFor(() =>
            expect(
                screen.getByRole('tab', { name: 'Images' })
            ).toHaveAttribute('aria-selected', 'true')
        );

        await act(async () => {
            releaseMaterialization?.(
                new File(['test'], 'licensed-reaction.jpg', {
                    type: 'image/jpeg',
                })
            );
            await Promise.resolve();
            await Promise.resolve();
        });

        await vi.waitFor(() =>
            expect(mediaLog).toHaveBeenCalledWith(
                '[memehub:media] overlay-added',
                expect.objectContaining({
                    label: 'Licensed reaction photo',
                })
            )
        );
        await vi.waitFor(() =>
            expect(
                screen.getByRole('tab', { name: 'Images' })
            ).toHaveAttribute('aria-selected', 'true')
        );
    });

    it('keeps Images open when a shape is selected during discovery image materialization', async () => {
        const mediaLog = vi
            .spyOn(console, 'info')
            .mockImplementation(() => {});
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        let releaseMaterialization: ((file: File) => void) | undefined;
        reusableImagePersistenceMock.materializeReusableImage.mockImplementationOnce(
            () =>
                new Promise<File>((resolve) => {
                    releaseMaterialization = resolve;
                })
        );

        const { container } = render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 0,
                            y: 0,
                            width: 30,
                            height: 20,
                            fontSize: 12,
                            minFont: 8,
                            align: 'left',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test rectangle' })
        );
        await screen.findByRole('button', {
            name: /Rectangle 1.*Shape layer/,
        });
        fireEvent.focus(
            screen.getByRole('textbox', { name: 'text position 1' })
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test discovered image' })
        );
        await vi.waitFor(() =>
            expect(releaseMaterialization).toEqual(expect.any(Function))
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).not.toBeNull();
        vi.spyOn(canvas!, 'getBoundingClientRect').mockReturnValue({
            bottom: 180,
            height: 180,
            left: 0,
            right: 240,
            top: 0,
            width: 240,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        });
        canvasShapeMock.hitExistingShape = true;
        fireEvent.mouseDown(canvas!, { clientX: 120, clientY: 90 });

        await vi.waitFor(() =>
            expect(
                screen.getByRole('tab', { name: 'Images' })
            ).toHaveAttribute('aria-selected', 'true')
        );

        await act(async () => {
            releaseMaterialization?.(
                new File(['test'], 'licensed-reaction.jpg', {
                    type: 'image/jpeg',
                })
            );
            await Promise.resolve();
            await Promise.resolve();
        });

        await vi.waitFor(() =>
            expect(mediaLog).toHaveBeenCalledWith(
                '[memehub:media] overlay-added',
                expect.objectContaining({
                    label: 'Licensed reaction photo',
                })
            )
        );
        expect(
            screen.getByRole('tab', { name: 'Images' })
        ).toHaveAttribute('aria-selected', 'true');
    });

    it('does not let an older async scene overwrite a newly loaded image', async () => {
        const templateSrc = 'https://example.com/base-template.png';
        const discoveredSrc = 'data:image/jpeg;base64,dGVzdA==';
        let releaseFirstTemplate: (() => void) | undefined;
        let templateLoadCount = 0;

        class ControlledImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            loadedSrc = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(value: string) {
                this.loadedSrc = value;
                if (value === templateSrc) {
                    this.width = 1200;
                    this.height = 1200;
                    templateLoadCount += 1;
                    if (templateLoadCount === 1) {
                        releaseFirstTemplate = () => this.onload?.();
                        return;
                    }
                }
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', ControlledImage);

        const drawImage = vi.fn();
        const noop = vi.fn();
        const context = {
            arc: noop,
            beginPath: noop,
            clearRect: noop,
            closePath: noop,
            drawImage,
            fill: noop,
            fillRect: noop,
            fillText: noop,
            lineTo: noop,
            measureText: () => ({ width: 0 }),
            moveTo: noop,
            quadraticCurveTo: noop,
            restore: noop,
            rotate: noop,
            save: noop,
            setLineDash: noop,
            stroke: noop,
            strokeRect: noop,
            strokeText: noop,
            translate: noop,
        } as unknown as CanvasRenderingContext2D;
        const getContextMock = vi
            .spyOn(HTMLCanvasElement.prototype, 'getContext')
            .mockReturnValue(context);

        render(
            <MemeEditor
                template={{
                    image: templateSrc,
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        await vi.waitFor(() =>
            expect(releaseFirstTemplate).toEqual(expect.any(Function))
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test discovered image' })
        );

        await vi.waitFor(() =>
            expect(drawImage).toHaveBeenCalledWith(
                expect.objectContaining({ loadedSrc: discoveredSrc }),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number)
            )
        );

        await act(async () => {
            releaseFirstTemplate?.();
            await Promise.resolve();
        });

        const lastDrawnImage = drawImage.mock.calls.at(-1)?.[0] as
            | ControlledImage
            | undefined;
        getContextMock.mockRestore();
        expect(lastDrawnImage?.loadedSrc).toBe(discoveredSrc);
    });

    it('keeps exactly one layer selected after adding a shape', async () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.focus(screen.getByRole('textbox', { name: 'text position 1' }));
        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test rectangle' })
        );

        await vi.waitFor(() =>
            expect(screen.getByRole('tab', { name: 'Layers' })).toHaveAttribute(
                'aria-selected',
                'true'
            )
        );

        expect(
            screen.getByRole('button', { name: /Rectangle 1.*Shape layer/ })
        ).toHaveAttribute('aria-pressed', 'true');
        expect(
            screen.getByRole('button', { name: /Text 1.*Empty text layer/ })
        ).toHaveAttribute('aria-pressed', 'false');
    });

    it.each(['menuitem', 'menu'] as const)(
        'does not let editor shortcuts delete a layer while role=%s has focus',
        async (interactiveRole) => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test rectangle' })
        );
        const shapeLayer = await screen.findByRole('button', {
            name: /Rectangle 1.*Shape layer/,
        });
        const menuItem = document.createElement('div');
        menuItem.setAttribute('role', interactiveRole);
        menuItem.tabIndex = 0;
        document.body.append(menuItem);
        menuItem.focus();

        fireEvent.keyDown(menuItem, { key: 'Delete' });

        expect(shapeLayer).toBeInTheDocument();
        menuItem.remove();
        }
    );

    it('waits for an in-flight image insertion before saving and leaving', async () => {
        const onReset = vi.fn();
        let finishImageLoad: (() => void) | undefined;
        class PendingImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                finishImageLoad = () => this.onload?.();
            }
        }
        vi.stubGlobal('Image', PendingImage);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={onReset}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test reaction sticker' })
        );
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        await vi.waitFor(() =>
            expect(finishImageLoad).toEqual(expect.any(Function))
        );
        expect(editorDraftMock.saveNow).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();

        finishImageLoad?.();

        await vi.waitFor(() =>
            expect(editorDraftMock.saveNow).toHaveBeenCalledOnce()
        );
        expect(onReset).toHaveBeenCalledOnce();
    });

    it('waits for discovery image materialization before saving and leaving', async () => {
        const onReset = vi.fn();
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        let releaseMaterialization: ((file: File) => void) | undefined;
        reusableImagePersistenceMock.materializeReusableImage.mockImplementationOnce(
            () =>
                new Promise<File>((resolve) => {
                    releaseMaterialization = resolve;
                })
        );

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={onReset}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test discovered image' })
        );
        await vi.waitFor(() =>
            expect(releaseMaterialization).toEqual(expect.any(Function))
        );
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        await act(
            () =>
                new Promise<void>((resolve) => {
                    window.setTimeout(resolve, 10);
                })
        );

        expect(editorDraftMock.saveNow).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();

        await act(async () => {
            releaseMaterialization?.(
                new File(['test'], 'licensed-reaction.jpg', {
                    type: 'image/jpeg',
                })
            );
            await Promise.resolve();
            await Promise.resolve();
        });

        await vi.waitFor(() =>
            expect(editorDraftMock.saveNow).toHaveBeenCalledOnce()
        );
        expect(onReset).toHaveBeenCalledOnce();
    });

    it('does not export while a discovery image is still materializing', async () => {
        const mediaLog = vi
            .spyOn(console, 'info')
            .mockImplementation(() => {});
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        let releaseMaterialization: ((file: File) => void) | undefined;
        reusableImagePersistenceMock.materializeReusableImage.mockImplementationOnce(
            () =>
                new Promise<File>((resolve) => {
                    releaseMaterialization = resolve;
                })
        );

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test discovered image' })
        );
        await vi.waitFor(() =>
            expect(releaseMaterialization).toEqual(expect.any(Function))
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Export' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Export original PNG' })
        );

        expect(
            canvasExportMock.renderSceneToImageBlob
        ).not.toHaveBeenCalled();

        await act(async () => {
            releaseMaterialization?.(
                new File(['test'], 'licensed-reaction.jpg', {
                    type: 'image/jpeg',
                })
            );
            await Promise.resolve();
            await Promise.resolve();
        });
        await vi.waitFor(() =>
            expect(mediaLog).toHaveBeenCalledWith(
                '[memehub:media] overlay-added',
                expect.objectContaining({
                    label: 'Licensed reaction photo',
                })
            )
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Export' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Export original PNG' })
        );
        await vi.waitFor(() =>
            expect(
                canvasExportMock.renderSceneToImageBlob
            ).toHaveBeenCalledOnce()
        );
    });

    it('returns the completed local discovery layer in the pre-save snapshot', async () => {
        class LoadedImage {
            width = 240;
            height = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        let releaseMaterialization: ((file: File) => void) | undefined;
        reusableImagePersistenceMock.materializeReusableImage.mockImplementationOnce(
            () =>
                new Promise<File>((resolve) => {
                    releaseMaterialization = resolve;
                })
        );

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test discovered image' })
        );
        await vi.waitFor(() =>
            expect(releaseMaterialization).toEqual(expect.any(Function))
        );
        expect(editorDraftMock.beforeSave).toEqual(expect.any(Function));
        const snapshotPromise = editorDraftMock.beforeSave!();

        releaseMaterialization?.(
            new File(['test'], 'licensed-reaction.jpg', {
                type: 'image/jpeg',
            })
        );
        const snapshot = await snapshotPromise;

        expect(snapshot.imageOverlays).toEqual([
            expect.objectContaining({
                src: expect.stringMatching(/^data:image\/jpeg;base64,/),
                source: expect.objectContaining({
                    provider: 'Wikimedia Commons',
                    licenseName: 'CC BY-SA 4.0',
                    rights: 'share-alike',
                }),
            }),
        ]);
    });

    it('starts a clean meme from a discovered image instead of adding it as a layer', async () => {
        class LoadedImage {
            width = 640;
            height = 480;
            naturalWidth = 640;
            naturalHeight = 480;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    displayName: 'Original template',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Use test discovered image as template',
            })
        );

        await vi.waitFor(() =>
            expect(
                reusableImagePersistenceMock.materializeReusableImage
            ).toHaveBeenCalledOnce()
        );
        expect(editorDraftMock.beforeSave).toEqual(expect.any(Function));

        let discoveredSnapshot: {
            template: {
                displayName?: string;
            };
            canvasTemplate?: {
                image: string;
                displayName?: string;
                mimeType: string;
                textBoxes: unknown[];
                source: {
                    provider: string;
                    licenseName: string;
                    rights: string;
                };
            };
            texts: string[];
            imageOverlays: unknown[];
            shapeOverlays: unknown[];
            strokes: unknown[];
        };

        await vi.waitFor(async () => {
            discoveredSnapshot = (await editorDraftMock.beforeSave!()) as typeof discoveredSnapshot;
            expect(discoveredSnapshot.template.displayName).toBe(
                'Original template'
            );
            expect(discoveredSnapshot.canvasTemplate).toMatchObject({
                image: expect.stringMatching(/^data:image\/jpeg;base64,/),
                displayName: 'Licensed reaction photo',
                mimeType: 'image/jpeg',
                source: {
                    provider: 'Wikimedia Commons',
                    licenseName: 'CC BY-SA 4.0',
                    rights: 'share-alike',
                },
            });
        });
        expect(discoveredSnapshot.canvasTemplate?.textBoxes).toHaveLength(2);
        expect(discoveredSnapshot.texts).toEqual(['', '']);
        expect(discoveredSnapshot.imageOverlays).toEqual([]);
        expect(discoveredSnapshot.shapeOverlays).toEqual([]);
        expect(discoveredSnapshot.strokes).toEqual([]);
        expect(
            await screen.findAllByRole('textbox', {
                name: /text position/,
            })
        ).toHaveLength(2);
        await vi.waitFor(() =>
            expect(
                screen.getByRole('textbox', { name: 'text position 1' })
            ).toHaveFocus()
        );
    });

    it('does not erase edits made while a new template image is loading', async () => {
        let discoveredImageLoads = 0;
        class LoadedImage {
            width = 240;
            height = 180;
            naturalWidth = 240;
            naturalHeight = 180;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(value: string) {
                if (value.startsWith('data:image/jpeg;base64,')) {
                    discoveredImageLoads += 1;
                }
                queueMicrotask(() => this.onload?.());
            }
        }
        vi.stubGlobal('Image', LoadedImage);

        let releaseMaterialization: ((file: File) => void) | undefined;
        reusableImagePersistenceMock.materializeReusableImage.mockImplementationOnce(
            () =>
                new Promise<File>((resolve) => {
                    releaseMaterialization = resolve;
                })
        );

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    displayName: 'Original template',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Use test discovered image as template',
            })
        );
        await vi.waitFor(() =>
            expect(releaseMaterialization).toEqual(expect.any(Function))
        );

        fireEvent.change(
            screen.getByRole('textbox', { name: 'text position 1' }),
            { target: { value: 'Do not lose this new caption' } }
        );
        releaseMaterialization?.(
            new File(['test'], 'licensed-reaction.jpg', {
                type: 'image/jpeg',
            })
        );

        await vi.waitFor(async () => {
            const snapshot = await editorDraftMock.beforeSave!();
            expect(snapshot.texts).toEqual([
                'Do not lose this new caption',
            ]);
            expect(snapshot.canvasTemplate).toBeUndefined();
        });

        vi.spyOn(window, 'confirm').mockReturnValue(true);
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Use test discovered image as template',
            })
        );
        await vi.waitFor(() =>
            expect(
                reusableImagePersistenceMock.materializeReusableImage
            ).toHaveBeenCalledTimes(2)
        );
        await vi.waitFor(() =>
            expect(discoveredImageLoads).toBe(2)
        );
    });

    it('replaces the current meme without asking for confirmation', async () => {
        const confirmReplacement = vi.spyOn(window, 'confirm');

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    displayName: 'Original template',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.change(
            screen.getByRole('textbox', { name: 'text position 1' }),
            { target: { value: 'Keep this joke' } }
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Use test discovered image as template',
            })
        );

        await vi.waitFor(() =>
            expect(
                reusableImagePersistenceMock.materializeReusableImage
            ).toHaveBeenCalledOnce()
        );
        expect(confirmReplacement).not.toHaveBeenCalled();
    });

    it('stops waiting when a remote image never finishes loading', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const onReset = vi.fn();
        class StalledImage {
            width = 0;
            height = 0;
            crossOrigin = '';
            onload: null | (() => void) = null;
            onerror: null | (() => void) = null;

            set src(_value: string) {
                // Intentionally never settles.
            }
        }
        vi.stubGlobal('Image', StalledImage);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={onReset}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'My assets' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Add test reaction sticker' })
        );
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(editorDraftMock.saveNow).not.toHaveBeenCalled();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(12_001);
        });

        expect(editorDraftMock.saveNow).toHaveBeenCalledOnce();
        expect(onReset).toHaveBeenCalledOnce();
    });

    it('names every text-settings trigger for its corresponding text field', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                        {
                            x: 20,
                            y: 200,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        expect(
            screen.getByRole('button', {
                name: 'Text settings for text position 1',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Text settings for text position 2',
            })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: 'text position 1' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: 'text position 2' })
        ).toBeInTheDocument();
    });

    it('keeps translation controls inside the text settings menu', async () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        const trigger = screen.getByRole('button', {
            name: 'Text settings for text position 1',
        });
        fireEvent.pointerDown(trigger);
        fireEvent.click(trigger);

        expect(await screen.findByText('Translate text')).toBeInTheDocument();
        expect(screen.getByLabelText('Translate to')).toBeInTheDocument();
        expect(screen.getByTitle('Translate this text layer')).toBeInTheDocument();
    });

    it('clears a predefined text box when the selected layer receives Backspace', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));
        fireEvent.click(screen.getAllByRole('button', { name: /Text 1/ })[0]);
        fireEvent.change(
            screen.getByRole('textbox', { name: 'text position 1' }),
            { target: { value: 'hello' } }
        );
        fireEvent.keyDown(document, { key: 'Backspace' });

        expect(
            screen.getByRole('textbox', { name: 'text position 1' })
        ).toHaveValue('');
        expect(
            screen.getAllByRole('button', { name: /Text 1/ })[0]
        ).toBeInTheDocument();
    });

    it('can add more than one custom text layer in the same project', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add Text' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add Text' }));

        expect(
            screen.getByRole('textbox', { name: 'Custom text 1' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: 'Custom text 2' })
        ).toBeInTheDocument();
    });

    it('removes a custom text layer when its cross button is clicked', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [
                        {
                            x: 20,
                            y: 20,
                            width: 300,
                            height: 80,
                            fontSize: 42,
                            minFont: 10,
                            align: 'center',
                        },
                    ],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Add Text' }));

        expect(
            screen.getByRole('textbox', { name: 'Custom text 1' })
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete custom text' })
        );

        expect(
            screen.queryByRole('textbox', { name: 'Custom text 1' })
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: 'text position 1' })
        ).toBeInTheDocument();
    });

    it('keeps focus on the same custom text through editor-level reordering', async () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );
        fireEvent.click(screen.getByRole('button', { name: 'Add Text' }));
        fireEvent.click(screen.getByRole('button', { name: 'Add Text' }));
        fireEvent.change(
            screen.getByRole('textbox', { name: 'Custom text 1' }),
            { target: { value: 'Layer A' } }
        );
        fireEvent.change(
            screen.getByRole('textbox', { name: 'Custom text 2' }),
            { target: { value: 'Layer B' } }
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));
        const moveLayerA = screen.getByRole('button', {
            name: 'Bring Custom text 1 forward',
        });
        moveLayerA.focus();

        fireEvent.click(moveLayerA);

        await vi.waitFor(() => {
            const focusedRow = (
                document.activeElement as HTMLElement
            ).closest('[data-layer-id]');
            expect(focusedRow).toHaveTextContent('Layer A');
            expect(focusedRow).not.toHaveTextContent('Layer B');
        });
    });

    it('keeps creator branding optional and lets the creator set their own handle', () => {
        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole('tab', { name: 'Text' }));
        const brandingToggle = screen.getByRole('checkbox', {
            name: 'Add creator watermark',
        });
        expect(brandingToggle).not.toBeChecked();

        fireEvent.click(brandingToggle);
        const watermarkInput = screen.getByRole('textbox', {
            name: 'Creator watermark text',
        });
        fireEvent.change(watermarkInput, { target: { value: '@my_memepage' } });

        expect(watermarkInput).toHaveValue('@my_memepage');
    });

    it('lets a creator explicitly leave when local draft storage cannot save', async () => {
        const onReset = vi.fn();
        editorDraftMock.saveNow.mockRejectedValueOnce(
            new Error('IndexedDB unavailable')
        );
        vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

        render(
            <MemeEditor
                template={{
                    image: 'data:image/png;base64,dGVzdA==',
                    textBoxes: [],
                }}
                onReset={onReset}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'Back' }));

        await vi.waitFor(() => expect(onReset).toHaveBeenCalledOnce());
        expect(window.confirm).toHaveBeenCalledWith(
            expect.stringContaining('Leave without saving')
        );
    });
});
