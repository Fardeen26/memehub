// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
    EditorCanvasLayout,
    EditorCanvasStage,
    EditorInspectorPanel,
    EditorToolsPanel,
} from './EditorCanvasLayout';

afterEach(cleanup);

describe('EditorCanvasLayout', () => {
    it('provides separate tool, canvas, and inspector regions', () => {
        render(
            <EditorCanvasLayout>
                <EditorCanvasStage>Canvas content</EditorCanvasStage>
                <EditorToolsPanel>Tool content</EditorToolsPanel>
                <EditorInspectorPanel>Inspector content</EditorInspectorPanel>
            </EditorCanvasLayout>
        );

        expect(
            screen.getByRole('complementary', { name: 'Editor tools' })
        ).toHaveTextContent('Tool content');
        expect(
            screen.getByRole('region', { name: 'Meme canvas' })
        ).toHaveTextContent('Canvas content');
        expect(
            screen.getByRole('complementary', {
                name: 'Properties inspector',
            })
        ).toHaveTextContent('Inspector content');
    });

    it('gives the canvas most of the desktop workspace without stretching panels', () => {
        render(
            <EditorCanvasLayout>
                <EditorCanvasStage>Canvas</EditorCanvasStage>
                <EditorToolsPanel>Tools</EditorToolsPanel>
                <EditorInspectorPanel>Inspector</EditorInspectorPanel>
            </EditorCanvasLayout>
        );

        const workspace = screen.getByTestId('editor-canvas-layout');
        expect(workspace).toHaveClass(
            'items-start',
            'lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(260px,290px)]'
        );
        expect(workspace).not.toHaveClass('items-stretch');
        expect(
            screen.getByRole('region', { name: 'Meme canvas' })
        ).toHaveClass('lg:col-start-2');
    });

    it('returns collapsed tools to a rail and gives that space to the canvas', () => {
        render(
            <EditorCanvasLayout toolsCollapsed>
                <EditorCanvasStage>Canvas</EditorCanvasStage>
                <EditorToolsPanel>Tools</EditorToolsPanel>
                <EditorInspectorPanel>Inspector</EditorInspectorPanel>
            </EditorCanvasLayout>
        );

        expect(screen.getByTestId('editor-canvas-layout')).toHaveClass(
            'lg:grid-cols-[64px_minmax(0,1fr)_minmax(260px,290px)]'
        );
    });
});
