type RequestFrame = (callback: FrameRequestCallback) => number;
type CancelFrame = (handle: number) => void;

/**
 * Keeps high-frequency input work to one state commit per rendered frame.
 */
export function createFrameCoalescer<T>(
    commit: (value: T) => void,
    requestFrame: RequestFrame = requestAnimationFrame,
    cancelFrame: CancelFrame = cancelAnimationFrame
) {
    let frame: number | null = null;
    let latestValue: T;

    return {
        schedule(value: T) {
            latestValue = value;
            if (frame !== null) return;

            frame = requestFrame(() => {
                frame = null;
                commit(latestValue);
            });
        },
        cancel() {
            if (frame === null) return;
            cancelFrame(frame);
            frame = null;
        },
    };
}
