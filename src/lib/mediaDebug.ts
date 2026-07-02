const MEDIA_DEBUG_STORAGE_KEY = 'memehub:media-debug';

export function getMediaPerfNow(): number {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        return performance.now();
    }

    return Date.now();
}

export function isMediaDebugEnabled(): boolean {
    if (process.env.NODE_ENV !== 'production') return true;
    if (typeof window === 'undefined') return false;

    try {
        return window.localStorage.getItem(MEDIA_DEBUG_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function logMediaDebug(event: string, payload: Record<string, unknown>): void {
    if (!isMediaDebugEnabled()) return;

    console.info(`[memehub:media] ${event}`, payload);
}
