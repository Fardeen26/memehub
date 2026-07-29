export const SCENE_IMAGE_UNAVAILABLE_MESSAGE =
    'A visible image layer could not be loaded. Reconnect or replace that layer before exporting.';

type CachedSceneOverlay = {
    id: string;
    src: string;
    visible?: boolean;
};

/**
 * Interaction frames must never wait for network or decoding work. They use
 * the last prepared image cache and let the next non-interactive render fill
 * in anything new.
 */
export function collectCachedSceneImages<T extends HTMLImageElement>(
    imageCache: ReadonlyMap<string, T>,
    templateSource: string,
    overlays: ReadonlyArray<CachedSceneOverlay>
) {
    const overlayImages = new Map<string, T>();
    for (const overlay of overlays) {
        if (overlay.visible === false) continue;
        const image = imageCache.get(overlay.src);
        if (image) overlayImages.set(overlay.id, image);
    }

    return {
        templateImage: imageCache.get(templateSource),
        overlayImages,
    };
}

export async function settleSceneImageLoads<T>(
    imagePromises: Array<Promise<T>>,
    options: { strict: boolean }
): Promise<Array<PromiseSettledResult<T>>> {
    const results = await Promise.allSettled(imagePromises);
    const failedCount = results.filter(
        (result) => result.status === 'rejected'
    ).length;

    if (options.strict && failedCount > 0) {
        throw new Error(SCENE_IMAGE_UNAVAILABLE_MESSAGE);
    }

    return results;
}
