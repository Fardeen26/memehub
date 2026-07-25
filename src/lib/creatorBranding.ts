export type WatermarkPosition =
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';

export type CreatorBranding = {
    enabled: boolean;
    text: string;
    position: WatermarkPosition;
};

export const DEFAULT_CREATOR_BRANDING: CreatorBranding = {
    enabled: false,
    text: '@yourpage',
    position: 'bottom-left',
};

export function fitWatermarkFontSize({
    initialFontSize,
    maxWidth,
    measureWidth,
    minFontSize,
}: {
    initialFontSize: number;
    maxWidth: number;
    measureWidth: () => number;
    minFontSize: number;
}): number {
    const measuredWidth = measureWidth();
    if (measuredWidth <= maxWidth || measuredWidth <= 0) {
        return initialFontSize;
    }

    const fittedFontSize =
        initialFontSize * (Math.max(0, maxWidth) / measuredWidth);
    const preferredFontSize = Math.max(minFontSize, fittedFontSize);

    // Prefer the readable floor when it fits, but never force text past the
    // canvas edge on very small images or unusually long creator handles.
    return measuredWidth * (preferredFontSize / initialFontSize) <= maxWidth
        ? preferredFontSize
        : fittedFontSize;
}

export function getWatermarkCoordinates(
    position: WatermarkPosition,
    canvasWidth: number,
    canvasHeight: number,
    padding: number
): {
    x: number;
    y: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
} {
    const onRight = position.endsWith('right');
    const onBottom = position.startsWith('bottom');

    return {
        x: onRight ? canvasWidth - padding : padding,
        y: onBottom ? canvasHeight - padding : padding,
        textAlign: onRight ? 'right' : 'left',
        textBaseline: onBottom ? 'bottom' : 'top',
    };
}
