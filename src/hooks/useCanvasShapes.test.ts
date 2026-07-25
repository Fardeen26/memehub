// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ShapeOverlay } from '@/types/editor';
import { useCanvasShapes } from './useCanvasShapes';

const drawShapeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/shapeDrawing', () => ({
    SHAPE_DEFAULTS: {
        rectangle: { width: 100, height: 80, strokeWidth: 2, filled: true },
    },
    drawShape: drawShapeMock,
}));

describe('useCanvasShapes draft restoration', () => {
    it('exposes a way to replace the persisted shape collection', () => {
        const canvasRef = { current: null };
        const { result } = renderHook(() => useCanvasShapes(canvasRef));

        expect(typeof (result.current as Record<string, unknown>).replaceShapes).toBe('function');
    });

    it('replaces shapes and clears the current selection', () => {
        const canvasRef = { current: null };
        const { result } = renderHook(() => useCanvasShapes(canvasRef));
        const savedShape: ShapeOverlay = {
            id: 'saved-arrow',
            type: 'arrow',
            x: 20,
            y: 30,
            width: 180,
            height: 80,
            rotation: 12,
            strokeColor: '#ef4444',
            fillColor: '#ef4444',
            strokeWidth: 6,
            filled: true,
            opacity: 0.9,
        };

        act(() => {
            result.current.setSelectedShapeIndex(3);
            result.current.replaceShapes([savedShape]);
        });

        expect(result.current.shapeOverlays).toEqual([savedShape]);
        expect(result.current.selectedShapeIndex).toBe(-1);
    });

    it('does not draw hidden shape layers', () => {
        const canvasRef = { current: null };
        const { result } = renderHook(() => useCanvasShapes(canvasRef));
        const visibleShape: ShapeOverlay = {
            id: 'visible',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 80,
            rotation: 0,
            strokeColor: '#fff',
            fillColor: '#000',
            strokeWidth: 2,
            filled: true,
            opacity: 1,
        };
        const hiddenShape = { ...visibleShape, id: 'hidden', visible: false };
        const context = {} as CanvasRenderingContext2D;

        act(() => {
            result.current.replaceShapes([visibleShape, hiddenShape]);
        });
        result.current.drawShapesLayer(context, false);

        expect(drawShapeMock).toHaveBeenCalledTimes(1);
        expect(drawShapeMock).toHaveBeenCalledWith(context, visibleShape);
    });
});
