import type {
    ImageOverlay,
    ShapeOverlay,
    TextSettings,
} from '@/types/editor';
import type { Template } from '@/types/template';

type VisibleLayer = {
    visible?: boolean;
};

export type LayerMoveDirection = 'forward' | 'backward';

export function canMoveTextLayerWithinGroup(
    index: number,
    direction: LayerMoveDirection,
    totalTextLayers: number,
    originalTextCount: number
): boolean {
    const targetIndex =
        direction === 'forward' ? index + 1 : index - 1;
    if (
        index < 0 ||
        index >= totalTextLayers ||
        targetIndex < 0 ||
        targetIndex >= totalTextLayers
    ) {
        return false;
    }

    const sourceIsTemplate = index < originalTextCount;
    const targetIsTemplate = targetIndex < originalTextCount;
    return sourceIsTemplate === targetIsTemplate;
}

export function moveLayer<T>(
    items: readonly T[],
    selectedIndex: number,
    direction: LayerMoveDirection
): { items: T[]; selectedIndex: number } {
    const nextIndex =
        direction === 'forward' ? selectedIndex + 1 : selectedIndex - 1;

    if (
        selectedIndex < 0 ||
        selectedIndex >= items.length ||
        nextIndex < 0 ||
        nextIndex >= items.length
    ) {
        return { items: [...items], selectedIndex };
    }

    const nextItems = [...items];
    [nextItems[selectedIndex], nextItems[nextIndex]] = [
        nextItems[nextIndex],
        nextItems[selectedIndex],
    ];

    return { items: nextItems, selectedIndex: nextIndex };
}

export function toggleLayerVisibility<T extends VisibleLayer>(
    items: readonly T[],
    index: number
): T[] {
    return items.map((item, itemIndex) =>
        itemIndex === index
            ? { ...item, visible: item.visible === false }
            : item
    );
}

export function isLayerVisible(layer: VisibleLayer): boolean {
    return layer.visible !== false;
}

export function duplicateImageLayer(
    layer: ImageOverlay,
    id: string
): ImageOverlay {
    if (layer.animated || layer.animationDecodePending) {
        throw new Error('Animated GIF layers cannot be duplicated yet.');
    }

    return {
        ...layer,
        id,
        label: `${layer.label || 'Image'} copy`,
        visible: true,
        x: layer.x + 16,
        y: layer.y + 16,
        eraseStrokes: layer.eraseStrokes.map((stroke) => ({
            ...stroke,
            points: stroke.points.map((point) => ({ ...point })),
        })),
    };
}

export function duplicateShapeLayer(
    layer: ShapeOverlay,
    id: string
): ShapeOverlay {
    return {
        ...layer,
        id,
        visible: true,
        x: layer.x + 16,
        y: layer.y + 16,
    };
}

type TextLayerCollections = {
    texts: string[];
    textBoxes: Template['textBoxes'];
    rotations: number[];
    settings: TextSettings[];
};

export function duplicateTextLayer(
    collections: TextLayerCollections,
    index: number
): TextLayerCollections & { selectedIndex: number } {
    const { texts, textBoxes, rotations, settings } = collections;
    if (
        index < 0 ||
        index >= texts.length ||
        !textBoxes[index] ||
        rotations[index] === undefined ||
        !settings[index]
    ) {
        throw new RangeError('Text layer does not exist.');
    }

    const copiedSettings: TextSettings = {
        ...settings[index],
        visible: true,
        outline: { ...settings[index].outline },
        shadow: { ...settings[index].shadow },
    };
    const copiedBox = {
        ...textBoxes[index],
        x: textBoxes[index].x + 16,
        y: textBoxes[index].y + 16,
    };

    return {
        texts: [...texts, texts[index]],
        textBoxes: [...textBoxes, copiedBox],
        rotations: [...rotations, rotations[index]],
        settings: [...settings, copiedSettings],
        selectedIndex: texts.length,
    };
}

export function moveTextLayer(
    collections: TextLayerCollections,
    index: number,
    direction: LayerMoveDirection
): TextLayerCollections & { selectedIndex: number } {
    const { texts, textBoxes, rotations, settings } = collections;
    if (
        textBoxes.length !== texts.length ||
        rotations.length !== texts.length ||
        settings.length !== texts.length
    ) {
        throw new RangeError('Text layer collections are out of sync.');
    }

    const movedTexts = moveLayer(texts, index, direction);
    return {
        texts: movedTexts.items,
        textBoxes: moveLayer(textBoxes, index, direction).items,
        rotations: moveLayer(rotations, index, direction).items,
        settings: moveLayer(settings, index, direction).items,
        selectedIndex: movedTexts.selectedIndex,
    };
}

export function fitImageLayerToCanvas(
    layer: ImageOverlay,
    canvasWidth: number,
    canvasHeight: number,
    mode: 'fit' | 'fill'
): ImageOverlay {
    if (
        !Number.isFinite(canvasWidth) ||
        !Number.isFinite(canvasHeight) ||
        canvasWidth <= 0 ||
        canvasHeight <= 0 ||
        !Number.isFinite(layer.originalWidth) ||
        !Number.isFinite(layer.originalHeight) ||
        layer.originalWidth <= 0 ||
        layer.originalHeight <= 0
    ) {
        throw new RangeError('Image and canvas dimensions must be positive.');
    }

    const radians = ((layer.rotation % 360) * Math.PI) / 180;
    const rawCosine = Math.abs(Math.cos(radians));
    const rawSine = Math.abs(Math.sin(radians));
    const cosine = rawCosine < 1e-10 ? 0 : rawCosine;
    const sine = rawSine < 1e-10 ? 0 : rawSine;
    const visibleOriginalWidth =
        layer.originalWidth * cosine + layer.originalHeight * sine;
    const visibleOriginalHeight =
        layer.originalWidth * sine + layer.originalHeight * cosine;
    const fitWidthScale = canvasWidth / visibleOriginalWidth;
    const fitHeightScale = canvasHeight / visibleOriginalHeight;
    const fillWidthScale =
        (canvasWidth * cosine + canvasHeight * sine) /
        layer.originalWidth;
    const fillHeightScale =
        (canvasWidth * sine + canvasHeight * cosine) /
        layer.originalHeight;
    const scale =
        mode === 'fill'
            ? Math.max(fillWidthScale, fillHeightScale)
            : Math.min(fitWidthScale, fitHeightScale);
    const width = layer.originalWidth * scale;
    const height = layer.originalHeight * scale;
    const maskScaleX =
        Number.isFinite(layer.width) && layer.width > 0
            ? width / layer.width
            : 1;
    const maskScaleY =
        Number.isFinite(layer.height) && layer.height > 0
            ? height / layer.height
            : 1;
    const brushScale = Math.sqrt(maskScaleX * maskScaleY);

    return {
        ...layer,
        x: (canvasWidth - width) / 2,
        y: (canvasHeight - height) / 2,
        width,
        height,
        eraseStrokes: layer.eraseStrokes.map((stroke) => ({
            ...stroke,
            size: stroke.size * brushScale,
            points: stroke.points.map((point) => ({
                x: point.x * maskScaleX,
                y: point.y * maskScaleY,
            })),
        })),
    };
}

export function constrainLayerPosition(
    layer: { width: number; height: number; rotation?: number },
    canvas: { width: number; height: number },
    proposed: { x: number; y: number }
): { x: number; y: number } {
    const radians = (((layer.rotation ?? 0) % 360) * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    const absoluteCosine = Math.abs(cosine);
    const absoluteSine = Math.abs(sine);
    const layerHalfWidth = layer.width / 2;
    const layerHalfHeight = layer.height / 2;
    const requiredLocalHalfWidth =
        (canvas.width * absoluteCosine +
            canvas.height * absoluteSine) /
        2;
    const requiredLocalHalfHeight =
        (canvas.width * absoluteSine +
            canvas.height * absoluteCosine) /
        2;
    const epsilon = 1e-8;

    if (
        layerHalfWidth + epsilon >= requiredLocalHalfWidth &&
        layerHalfHeight + epsilon >= requiredLocalHalfHeight
    ) {
        const proposedCenterOffsetX =
            proposed.x + layerHalfWidth - canvas.width / 2;
        const proposedCenterOffsetY =
            proposed.y + layerHalfHeight - canvas.height / 2;
        const proposedLocalX =
            cosine * proposedCenterOffsetX +
            sine * proposedCenterOffsetY;
        const proposedLocalY =
            -sine * proposedCenterOffsetX +
            cosine * proposedCenterOffsetY;
        const localMarginX = Math.max(
            0,
            layerHalfWidth - requiredLocalHalfWidth
        );
        const localMarginY = Math.max(
            0,
            layerHalfHeight - requiredLocalHalfHeight
        );
        const localX = Math.max(
            -localMarginX,
            Math.min(localMarginX, proposedLocalX)
        );
        const localY = Math.max(
            -localMarginY,
            Math.min(localMarginY, proposedLocalY)
        );
        const centerOffsetX = cosine * localX - sine * localY;
        const centerOffsetY = sine * localX + cosine * localY;

        return {
            x: canvas.width / 2 + centerOffsetX - layerHalfWidth,
            y: canvas.height / 2 + centerOffsetY - layerHalfHeight,
        };
    }

    const minX = Math.min(0, canvas.width - layer.width);
    const maxX = Math.max(0, canvas.width - layer.width);
    const minY = Math.min(0, canvas.height - layer.height);
    const maxY = Math.max(0, canvas.height - layer.height);

    return {
        x: Math.max(minX, Math.min(maxX, proposed.x)),
        y: Math.max(minY, Math.min(maxY, proposed.y)),
    };
}
