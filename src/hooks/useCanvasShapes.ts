import { useCallback, useState, RefObject } from 'react';
import type { ShapeOverlay, ShapeType } from '@/types/editor';
import { SHAPE_DEFAULTS, drawShape } from '@/lib/shapeDrawing';
import {
    applyResizeHandle,
    drawTransformableSelection,
    getTransformableAtPosition,
} from '@/lib/overlayUtils';

function generateShapeId(): string {
    return `shape_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function useCanvasShapes(canvasRef: RefObject<HTMLCanvasElement | null>) {
    const [shapeOverlays, setShapeOverlays] = useState<ShapeOverlay[]>([]);
    const [selectedShapeIndex, setSelectedShapeIndex] = useState(-1);
    const [isDraggingShape, setIsDraggingShape] = useState(false);
    const [dragShapeIndex, setDragShapeIndex] = useState(-1);
    const [dragShapeOffset, setDragShapeOffset] = useState({ x: 0, y: 0 });
    const [isResizingShape, setIsResizingShape] = useState(false);
    const [resizeShapeIndex, setResizeShapeIndex] = useState(-1);
    const [resizeShapeHandle, setResizeShapeHandle] = useState('');
    const [resizeShapeStartPos, setResizeShapeStartPos] = useState({ x: 0, y: 0 });
    const [resizeShapeStartSize, setResizeShapeStartSize] = useState({ width: 0, height: 0 });
    const [resizeShapeStartBoxPos, setResizeShapeStartBoxPos] = useState({ x: 0, y: 0 });
    const [isRotatingShape, setIsRotatingShape] = useState(false);
    const [rotateShapeIndex, setRotateShapeIndex] = useState(-1);
    const [rotateShapeStartAngle, setRotateShapeStartAngle] = useState(0);

    const addShape = useCallback(
        (type: ShapeType) => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const defaults = SHAPE_DEFAULTS[type];
            const width = defaults.width;
            const height = defaults.height;

            const newShape: ShapeOverlay = {
                id: generateShapeId(),
                type,
                x: (canvas.width - width) / 2,
                y: (canvas.height - height) / 2,
                width,
                height,
                rotation: 0,
                strokeColor: '#ef4444',
                fillColor: type === 'speech-bubble' ? '#ffffff' : '#ef4444',
                strokeWidth: defaults.strokeWidth,
                filled: defaults.filled,
                opacity: 1,
            };

            setShapeOverlays((prev) => {
                setSelectedShapeIndex(prev.length);
                return [...prev, newShape];
            });
        },
        [canvasRef]
    );

    const removeShape = useCallback(
        (index: number) => {
            setShapeOverlays((prev) => prev.filter((_, i) => i !== index));
            setSelectedShapeIndex((prev) => {
                if (prev === index) return -1;
                if (prev > index) return prev - 1;
                return prev;
            });
        },
        []
    );

    const updateShape = useCallback((index: number, patch: Partial<ShapeOverlay>) => {
        setShapeOverlays((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...patch };
            return updated;
        });
    }, []);

    const getShapeAtPosition = useCallback(
        (x: number, y: number) => getTransformableAtPosition(x, y, shapeOverlays),
        [shapeOverlays]
    );

    const tryShapeMouseDown = useCallback(
        (x: number, y: number, canvas: HTMLCanvasElement): boolean => {
            const result = getShapeAtPosition(x, y);
            if (result.index === -1) return false;

            setSelectedShapeIndex(result.index);

            if (result.handle === 'move') {
                setIsDraggingShape(true);
                setDragShapeIndex(result.index);
                setDragShapeOffset({
                    x: x - shapeOverlays[result.index].x,
                    y: y - shapeOverlays[result.index].y,
                });
                canvas.style.cursor = 'grabbing';
            } else if (result.handle === 'rotate') {
                setIsRotatingShape(true);
                setRotateShapeIndex(result.index);
                const shape = shapeOverlays[result.index];
                const centerX = shape.x + shape.width / 2;
                const centerY = shape.y + shape.height / 2;
                const angle = (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
                setRotateShapeStartAngle(angle - shape.rotation);
                canvas.style.cursor = 'grab';
            } else {
                setIsResizingShape(true);
                setResizeShapeIndex(result.index);
                setResizeShapeHandle(result.handle);
                setResizeShapeStartPos({ x, y });
                setResizeShapeStartSize({
                    width: shapeOverlays[result.index].width,
                    height: shapeOverlays[result.index].height,
                });
                setResizeShapeStartBoxPos({
                    x: shapeOverlays[result.index].x,
                    y: shapeOverlays[result.index].y,
                });
                canvas.style.cursor = `${result.handle}-resize`;
            }
            return true;
        },
        [getShapeAtPosition, shapeOverlays]
    );

    const handleShapeMouseMove = useCallback(
        (x: number, y: number, canvas: HTMLCanvasElement) => {
            if (isDraggingShape && dragShapeIndex !== -1) {
                const shape = shapeOverlays[dragShapeIndex];
                const newX = Math.max(0, Math.min(canvas.width - shape.width, x - dragShapeOffset.x));
                const newY = Math.max(0, Math.min(canvas.height - shape.height, y - dragShapeOffset.y));
                updateShape(dragShapeIndex, { x: newX, y: newY });
            } else if (isRotatingShape && rotateShapeIndex !== -1) {
                const shape = shapeOverlays[rotateShapeIndex];
                const centerX = shape.x + shape.width / 2;
                const centerY = shape.y + shape.height / 2;
                const angle = (Math.atan2(y - centerY, x - centerX) * 180) / Math.PI;
                updateShape(rotateShapeIndex, { rotation: angle - rotateShapeStartAngle });
            } else if (isResizingShape && resizeShapeIndex !== -1) {
                const deltaX = x - resizeShapeStartPos.x;
                const deltaY = y - resizeShapeStartPos.y;
                const next = applyResizeHandle(
                    resizeShapeHandle,
                    deltaX,
                    deltaY,
                    {
                        width: resizeShapeStartSize.width,
                        height: resizeShapeStartSize.height,
                        x: resizeShapeStartBoxPos.x,
                        y: resizeShapeStartBoxPos.y,
                    }
                );
                updateShape(resizeShapeIndex, next);
            } else if (!isDraggingShape && !isResizingShape && !isRotatingShape) {
                const hit = getShapeAtPosition(x, y);
                if (hit.index !== -1) {
                    canvas.style.cursor =
                        hit.handle === 'move'
                            ? 'grab'
                            : hit.handle === 'rotate'
                              ? 'grab'
                              : `${hit.handle}-resize`;
                }
            }
        },
        [
            isDraggingShape,
            dragShapeIndex,
            dragShapeOffset,
            shapeOverlays,
            isRotatingShape,
            rotateShapeIndex,
            rotateShapeStartAngle,
            isResizingShape,
            resizeShapeIndex,
            resizeShapeHandle,
            resizeShapeStartPos,
            resizeShapeStartSize,
            resizeShapeStartBoxPos,
            getShapeAtPosition,
            updateShape,
        ]
    );

    const endShapeInteraction = useCallback(() => {
        setIsDraggingShape(false);
        setDragShapeIndex(-1);
        setIsResizingShape(false);
        setResizeShapeIndex(-1);
        setResizeShapeHandle('');
        setIsRotatingShape(false);
        setRotateShapeIndex(-1);
    }, []);

    const drawShapesLayer = useCallback(
        (ctx: CanvasRenderingContext2D) => {
            for (const shape of shapeOverlays) {
                drawShape(ctx, shape);
            }
            if (selectedShapeIndex >= 0 && selectedShapeIndex < shapeOverlays.length) {
                drawTransformableSelection(ctx, shapeOverlays[selectedShapeIndex]);
            }
        },
        [shapeOverlays, selectedShapeIndex]
    );

    const isShapeInteracting =
        isDraggingShape || isResizingShape || isRotatingShape;

    return {
        shapeOverlays,
        selectedShapeIndex,
        setSelectedShapeIndex,
        addShape,
        removeShape,
        updateShape,
        tryShapeMouseDown,
        handleShapeMouseMove,
        endShapeInteraction,
        drawShapesLayer,
        isShapeInteracting,
        getShapeAtPosition,
    };
}
