// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageOverlay } from '@/types/editor';
import ImageLayerTools from './ImageLayerTools';

const selectedImage: ImageOverlay = {
    id: 'reaction',
    src: 'data:image/png;base64,dGVzdA==',
    label: 'Reaction face',
    x: 10,
    y: 20,
    width: 100,
    height: 80,
    originalWidth: 200,
    originalHeight: 160,
    opacity: 0.75,
    rotation: 0,
    eraseStrokes: [],
};

afterEach(cleanup);

describe('ImageLayerTools', () => {
    it('keeps the license and original source visible for discovered media', () => {
        render(
            <ImageLayerTools
                image={{
                    ...selectedImage,
                    source: {
                        provider: 'Wikimedia Commons',
                        url: 'https://commons.wikimedia.org/wiki/File:Reaction.jpg',
                        creator: 'Example photographer',
                        creditLine: 'Photo: Example photographer / Archive',
                        licenseName: 'CC BY-SA 4.0',
                        licenseUrl:
                            'https://creativecommons.org/licenses/by-sa/4.0/',
                        rights: 'share-alike',
                        attributionRequired: true,
                        usageTerms:
                            'Creative Commons Attribution-ShareAlike 4.0',
                        restrictions: 'Personality rights may apply',
                    },
                }}
                eraseMode={false}
                eraseBrushSize={20}
                eraseBrushOpacity={1}
                onOpacityChange={vi.fn()}
                onRotate90={vi.fn()}
                onFit={vi.fn()}
                onFill={vi.fn()}
                onToggleErase={vi.fn()}
                onEraseBrushSizeChange={vi.fn()}
                onEraseBrushOpacityChange={vi.fn()}
                onUndoErase={vi.fn()}
                onClearErase={vi.fn()}
            />
        );

        expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
        expect(screen.getByText('Example photographer')).toBeInTheDocument();
        expect(
            screen.getByText('Credit: Photo: Example photographer / Archive')
        ).toBeInTheDocument();
        expect(
            screen.getByText('Other rights: Personality rights may apply')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: 'Open original media source' })
        ).toHaveAttribute(
            'href',
            'https://commons.wikimedia.org/wiki/File:Reaction.jpg'
        );
    });

    it('exposes useful image editing controls for the selected layer', () => {
        const onOpacityChange = vi.fn();
        const onRotate90 = vi.fn();
        const onFit = vi.fn();
        const onFill = vi.fn();
        const onToggleErase = vi.fn();

        render(
            <ImageLayerTools
                image={selectedImage}
                eraseMode={false}
                eraseBrushSize={20}
                eraseBrushOpacity={1}
                onOpacityChange={onOpacityChange}
                onRotate90={onRotate90}
                onFit={onFit}
                onFill={onFill}
                onToggleErase={onToggleErase}
                onEraseBrushSizeChange={vi.fn()}
                onEraseBrushOpacityChange={vi.fn()}
                onUndoErase={vi.fn()}
                onClearErase={vi.fn()}
            />
        );

        fireEvent.change(screen.getByRole('slider', { name: 'Image opacity' }), {
            target: { value: '55' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Rotate image 90 degrees' }));
        fireEvent.click(screen.getByRole('button', { name: 'Fit image inside canvas' }));
        fireEvent.click(screen.getByRole('button', { name: 'Fill canvas with image' }));
        fireEvent.click(screen.getByRole('button', { name: 'Start manual erase' }));

        expect(onOpacityChange).toHaveBeenCalledWith(0.55);
        expect(onRotate90).toHaveBeenCalledOnce();
        expect(onFit).toHaveBeenCalledOnce();
        expect(onFill).toHaveBeenCalledOnce();
        expect(onToggleErase).toHaveBeenCalledOnce();
    });

    it('shows brush controls and erase history actions only in erase mode', () => {
        render(
            <ImageLayerTools
                image={{ ...selectedImage, eraseStrokes: [{ points: [], size: 20, opacity: 1 }] }}
                eraseMode
                eraseBrushSize={24}
                eraseBrushOpacity={0.7}
                onOpacityChange={vi.fn()}
                onRotate90={vi.fn()}
                onFit={vi.fn()}
                onFill={vi.fn()}
                onToggleErase={vi.fn()}
                onEraseBrushSizeChange={vi.fn()}
                onEraseBrushOpacityChange={vi.fn()}
                onUndoErase={vi.fn()}
                onClearErase={vi.fn()}
            />
        );

        expect(screen.getByRole('slider', { name: 'Erase brush size' })).toHaveValue(
            '24'
        );
        expect(
            screen.getByRole('slider', { name: 'Erase brush opacity' })
        ).toHaveValue('70');
        expect(screen.getByRole('button', { name: 'Undo last erase stroke' })).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Clear all erase strokes' })).toBeEnabled();
    });

    it('does not start an invisible erase session for a hidden image', () => {
        render(
            <ImageLayerTools
                image={{ ...selectedImage, visible: false }}
                eraseMode={false}
                eraseBrushSize={20}
                eraseBrushOpacity={1}
                onOpacityChange={vi.fn()}
                onRotate90={vi.fn()}
                onFit={vi.fn()}
                onFill={vi.fn()}
                onToggleErase={vi.fn()}
                onEraseBrushSizeChange={vi.fn()}
                onEraseBrushOpacityChange={vi.fn()}
                onUndoErase={vi.fn()}
                onClearErase={vi.fn()}
            />
        );

        expect(
            screen.getByRole('button', { name: 'Start manual erase' })
        ).toBeDisabled();
    });
});
