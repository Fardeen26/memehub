const MIN_TEMPLATE_SHORT_SIDE = 320;

export function isTemplateImageTooSmall(
    width: number,
    height: number
): boolean {
    return (
        Number.isFinite(width) &&
        Number.isFinite(height) &&
        width > 0 &&
        height > 0 &&
        Math.min(width, height) < MIN_TEMPLATE_SHORT_SIDE
    );
}

export function getTemplateImageTooSmallMessage(
    width: number,
    height: number
): string {
    return `This image is too small to use as a template (${Math.round(width)} × ${Math.round(height)}). Try a larger result.`;
}
