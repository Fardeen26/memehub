'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Check,
    ImagePlus,
    Layers3,
    Loader2,
    Search,
    ShieldCheck,
} from 'lucide-react';
import type {
    CreatorDiscoveryResponse,
    IndiaTrendSignal,
    ReusableImageAsset,
} from '@/types/creatorDiscovery';

type CreatorDiscoveryPanelProps = {
    onAddImage: (asset: ReusableImageAsset) => void | Promise<void>;
    onUseAsTemplate?: (
        asset: ReusableImageAsset
    ) => boolean | void | Promise<boolean | void>;
    disabled?: boolean;
};

type PendingImageAction = {
    assetId: string;
    assetTitle: string;
    action: 'template' | 'layer';
};

const MAX_DISCOVERY_QUERY_LENGTH = 120;

function hasSearchSubject(value: string): boolean {
    return /[\p{L}\p{N}]/u.test(value);
}

async function discoveryResponseError(response: Response): Promise<string> {
    try {
        const payload = (await response.json()) as { error?: unknown };
        if (
            typeof payload.error === 'string' &&
            payload.error.length > 0 &&
            payload.error.length <= 160
        ) {
            return payload.error;
        }
    } catch {
        // Keep upstream implementation details out of creator-facing errors.
    }
    return 'Image search could not be opened. Try again shortly.';
}

function RightsBadge({ asset }: { asset: ReusableImageAsset }) {
    const label =
        asset.rights === 'editable'
            ? 'Editable'
            : asset.licenseName;

    return (
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-100">
            <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
        </span>
    );
}

function TrendSearchChip({
    trend,
    disabled,
    onSearch,
}: {
    trend: IndiaTrendSignal;
    disabled: boolean;
    onSearch: (query: string) => void;
}) {
    return (
        <button
            type="button"
            aria-label={`Find images for ${trend.title}`}
            disabled={disabled}
            onClick={() => onSearch(trend.title)}
            className="group flex min-h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-left transition-colors hover:border-[#8292eb]/45 hover:bg-[#6a7bd1]/10 disabled:opacity-45"
        >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#6a7bd1]/12 text-[#aeb8ff]">
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">
                    {trend.title}
                </span>
            </span>
            <Search
                className="h-3.5 w-3.5 shrink-0 text-white/30 transition-colors group-hover:text-[#aeb8ff]"
                aria-hidden="true"
            />
        </button>
    );
}

function ImageResultCard({
    asset,
    disabled,
    pendingAction,
    canUseAsTemplate,
    onUseAsTemplate,
    onAddAsLayer,
}: {
    asset: ReusableImageAsset;
    disabled: boolean;
    pendingAction: PendingImageAction | null;
    canUseAsTemplate: boolean;
    onUseAsTemplate: (asset: ReusableImageAsset) => void;
    onAddAsLayer: (asset: ReusableImageAsset) => void;
}) {
    const templatePending =
        pendingAction?.assetId === asset.id &&
        pendingAction.action === 'template';
    const layerPending =
        pendingAction?.assetId === asset.id &&
        pendingAction.action === 'layer';

    return (
        <article className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
            <div className="aspect-[4/3] overflow-hidden bg-white/5">
                {/* Creator-selected reusable media can come from Wikimedia. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={asset.previewUrl}
                    alt={asset.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02]"
                />
            </div>
            <div className="space-y-2 p-2.5">
                <div className="min-w-0">
                    <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-white">
                        {asset.title}
                    </h4>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                        <RightsBadge asset={asset} />
                        <span className="shrink-0 text-[9px] text-white/35">
                            {asset.width} × {asset.height}
                        </span>
                    </div>
                </div>

                <div className="grid gap-1.5">
                    {canUseAsTemplate && (
                        <button
                            type="button"
                            aria-label={`Use ${asset.title} as template`}
                            aria-busy={templatePending}
                            disabled={disabled}
                            onClick={() => onUseAsTemplate(asset)}
                            className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#6a7bd1] px-2.5 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-[#7889e8] disabled:opacity-45"
                        >
                            {templatePending ? (
                                <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <ImagePlus
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                />
                            )}
                            Use as template
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label={`Add ${asset.title} as a layer`}
                        aria-busy={layerPending}
                        disabled={disabled}
                        onClick={() => onAddAsLayer(asset)}
                        className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.035] px-2.5 py-2 text-[10px] font-medium text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-45"
                    >
                        {layerPending ? (
                            <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden="true"
                            />
                        ) : (
                            <Layers3
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                        )}
                        Add as layer
                    </button>
                </div>
            </div>
        </article>
    );
}

export default function CreatorDiscoveryPanel({
    onAddImage,
    onUseAsTemplate,
    disabled = false,
}: CreatorDiscoveryPanelProps) {
    const [data, setData] = useState<CreatorDiscoveryResponse | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [pendingAction, setPendingAction] =
        useState<PendingImageAction | null>(null);
    const activeRequestRef = useRef<AbortController | null>(null);
    const requestRevisionRef = useRef(0);

    const loadDiscovery = useCallback(async (query: string) => {
        activeRequestRef.current?.abort();
        const controller = new AbortController();
        const revision = requestRevisionRef.current + 1;
        requestRevisionRef.current = revision;
        activeRequestRef.current = controller;
        setLoading(true);
        setError(null);
        setStatus(null);

        try {
            const parameters = new URLSearchParams();
            if (query.trim()) parameters.set('q', query.trim());
            const suffix = parameters.size ? `?${parameters.toString()}` : '';
            const response = await fetch(`/api/creator-discovery${suffix}`, {
                signal: controller.signal,
            });
            if (!response.ok) {
                throw new Error(await discoveryResponseError(response));
            }
            const nextData =
                (await response.json()) as CreatorDiscoveryResponse;
            if (
                requestRevisionRef.current === revision &&
                !controller.signal.aborted
            ) {
                setData(nextData);
            }
        } catch (reason) {
            if (reason instanceof DOMException && reason.name === 'AbortError') {
                return;
            }
            if (requestRevisionRef.current === revision) {
                setError(
                    reason instanceof Error
                        ? reason.message
                        : 'Image search could not be opened. Try again shortly.'
                );
            }
        } finally {
            if (requestRevisionRef.current === revision) {
                activeRequestRef.current = null;
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void loadDiscovery('');
        return () => {
            requestRevisionRef.current += 1;
            activeRequestRef.current?.abort();
            activeRequestRef.current = null;
        };
    }, [loadDiscovery]);

    const runSearch = (query: string) => {
        const normalized = query.replace(/\s+/g, ' ').trim();
        if (!normalized) {
            setSearchInput('');
            void loadDiscovery('');
            return;
        }
        if (!hasSearchSubject(normalized)) {
            setError('Search for a person, event, phrase, or topic.');
            setStatus(null);
            return;
        }
        if (normalized.length > MAX_DISCOVERY_QUERY_LENGTH) {
            setError('Searches must be 120 characters or fewer.');
            setStatus(null);
            return;
        }
        setSearchInput(normalized);
        void loadDiscovery(normalized);
    };

    const runImageAction = async (
        asset: ReusableImageAsset,
        action: PendingImageAction['action']
    ) => {
        if (disabled || pendingAction) return;
        const callback =
            action === 'template' ? onUseAsTemplate : onAddImage;
        if (!callback) return;

        setPendingAction({
            assetId: asset.id,
            assetTitle: asset.title,
            action,
        });
        setError(null);
        setStatus(null);
        try {
            const completed = await callback(asset);
            if (completed === false) return;
            setStatus(
                action === 'template'
                    ? 'Template ready. Add your text and publish.'
                    : 'Image added as a layer.'
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : action === 'template'
                      ? 'This image could not be used as a template.'
                      : 'This image could not be added as a layer.'
            );
        } finally {
            setPendingAction(null);
        }
    };

    const providerMessage = useMemo(() => {
        if (!data) return null;
        if (
            data.query &&
            data.providers.commons === 'unavailable'
        ) {
            return 'Image search is temporarily unavailable. Try again shortly.';
        }
        if (!data.query && data.providers.trends === 'unavailable') {
            return 'Trending searches are temporarily unavailable. You can still search for an image.';
        }
        return null;
    }, [data]);

    const actionDisabled =
        disabled || loading || pendingAction !== null;
    const showingResults = Boolean(data?.query);

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-sm font-semibold text-white">
                    Find a meme image
                </h2>
                <p className="mt-0.5 text-[10px] leading-relaxed text-white/45">
                    Search once, then start with the image or place it on your
                    current meme.
                </p>
            </div>

            <form
                role="search"
                onSubmit={(event) => {
                    event.preventDefault();
                    runSearch(searchInput);
                }}
                className="rounded-xl border border-[#6a7bd1]/25 bg-[#6a7bd1]/8 p-2"
            >
                <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                        <Search
                            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            aria-label="Search viral topics and reusable visuals"
                            value={searchInput}
                            maxLength={MAX_DISCOVERY_QUERY_LENGTH}
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                            placeholder="A person, event, dialogue, or reaction…"
                            disabled={disabled}
                            className="h-10 w-full rounded-lg border border-white/12 bg-black/35 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-[#8ea0ff]/70 disabled:opacity-50"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={
                            disabled ||
                            loading ||
                            !hasSearchSubject(searchInput)
                        }
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#6a7bd1] text-white hover:bg-[#7889e8] disabled:opacity-45"
                    >
                        {loading ? (
                            <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden="true"
                            />
                        ) : (
                            <Search
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                            />
                        )}
                        <span className="sr-only">Search images</span>
                    </button>
                </div>
            </form>

            {(error || providerMessage) && (
                <p
                    role="alert"
                    className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100"
                >
                    {error || providerMessage}
                </p>
            )}
            {status && (
                <p
                    role="status"
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/8 px-3 py-2 text-[10px] text-emerald-100"
                >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    {status}
                </p>
            )}
            {pendingAction && (
                <p role="status" className="sr-only" aria-live="polite">
                    {pendingAction.action === 'template'
                        ? `Preparing ${pendingAction.assetTitle} as your template`
                        : `Adding ${pendingAction.assetTitle} as a layer`}
                </p>
            )}

            {loading && !data ? (
                <div
                    role="status"
                    className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-white/8 bg-black/20 text-xs text-white/45"
                >
                    <Loader2
                        className="h-5 w-5 animate-spin text-[#9aa8ff]"
                        aria-hidden="true"
                    />
                    Finding today&apos;s topics…
                </div>
            ) : showingResults ? (
                <section className="space-y-2" aria-live="polite">
                    <div className="flex items-center justify-between gap-3">
                        <h3 className="min-w-0 truncate text-xs font-semibold text-white">
                            Images for “{data?.query}”
                        </h3>
                        <button
                            type="button"
                            disabled={disabled || loading}
                            onClick={() => runSearch('')}
                            className="shrink-0 rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-medium text-white/55 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        >
                            Show trending searches
                        </button>
                    </div>

                    {loading && (
                        <p
                            role="status"
                            className="flex items-center gap-1.5 text-[10px] text-white/45"
                        >
                            <Loader2
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden="true"
                            />
                            Finding images…
                        </p>
                    )}

                    {data?.providers.commons !== 'unavailable' &&
                        data?.reusableImages.length === 0 &&
                        !loading && (
                            <p className="rounded-lg border border-white/8 bg-black/20 px-3 py-3 text-[10px] leading-relaxed text-white/48">
                                No reusable images found. Try a shorter name or a
                                broader phrase.
                            </p>
                        )}

                    {Boolean(data?.reusableImages.length) && (
                        <div className="grid grid-cols-1 gap-2">
                            {data?.reusableImages.map((asset) => (
                                <ImageResultCard
                                    key={asset.id}
                                    asset={asset}
                                    disabled={actionDisabled}
                                    pendingAction={pendingAction}
                                    canUseAsTemplate={Boolean(
                                        onUseAsTemplate
                                    )}
                                    onUseAsTemplate={(selectedAsset) =>
                                        void runImageAction(
                                            selectedAsset,
                                            'template'
                                        )
                                    }
                                    onAddAsLayer={(selectedAsset) =>
                                        void runImageAction(
                                            selectedAsset,
                                            'layer'
                                        )
                                    }
                                />
                            ))}
                        </div>
                    )}
                </section>
            ) : (
                <section className="space-y-2">
                    <div>
                        <h3 className="text-xs font-semibold text-white">
                            Trending in India
                        </h3>
                        <p className="mt-0.5 text-[9px] text-white/38">
                            Pick a topic to find images for it.
                        </p>
                    </div>
                    {data?.trends.length ? (
                        <div className="grid grid-cols-1 gap-2">
                            {data.trends.map((trend) => (
                                <TrendSearchChip
                                    key={trend.id}
                                    trend={trend}
                                    disabled={disabled || loading}
                                    onSearch={runSearch}
                                />
                            ))}
                        </div>
                    ) : (
                        !loading &&
                        data?.providers.trends !== 'unavailable' && (
                            <p className="rounded-lg border border-white/8 bg-black/20 px-3 py-3 text-[10px] text-white/45">
                                No trending searches are available yet. Search
                                for any topic above.
                            </p>
                        )
                    )}
                </section>
            )}
        </div>
    );
}
