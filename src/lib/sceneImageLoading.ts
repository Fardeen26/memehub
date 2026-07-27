export const SCENE_IMAGE_UNAVAILABLE_MESSAGE =
    'A visible image layer could not be loaded. Reconnect or replace that layer before exporting.';

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
