'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Check,
    ExternalLink,
    ImagePlus,
    Images,
    Layers3,
    LayoutTemplate,
    Loader2,
    MessageSquareText,
    ScanSearch,
    Scissors,
    Search,
    ShieldCheck,
    Smile,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MemeSearchIntent } from '@/lib/memeSearchPlanner';
import type {
    CreatorDiscoveryResponse,
    DiscoveryImageAsset,
    WebImageAsset,
} from '@/types/creatorDiscovery';

type CreatorDiscoveryPanelProps = {
    onAddImage: (asset: DiscoveryImageAsset) => void | Promise<void>;
    onUseAsTemplate?: (
        asset: DiscoveryImageAsset
    ) => boolean | void | Promise<boolean | void>;
    disabled?: boolean;
};

type PendingImageAction = {
    assetId: string;
    assetTitle: string;
    action: 'template' | 'layer';
};

type IntentOption = {
    value: MemeSearchIntent;
    label: string;
    description: string;
    icon: LucideIcon;
};

const MAX_DISCOVERY_QUERY_LENGTH = 120;

const INTENT_OPTIONS: readonly IntentOption[] = [
    {
        value: 'moment',
        label: 'Breaking moment',
        description: 'Current events and news frames',
        icon: Zap,
    },
    {
        value: 'reaction',
        label: 'Reaction face',
        description: 'Expressions, gestures, and moods',
        icon: Smile,
    },
    {
        value: 'cutout',
        label: 'Clean cutout',
        description: 'Isolated subjects and transparent PNGs',
        icon: Scissors,
    },
    {
        value: 'template',
        label: 'Blank template',
        description: 'Caption-ready meme formats',
        icon: LayoutTemplate,
    },
    {
        value: 'social',
        label: 'Social post',
        description: 'Frames from Reddit, X, and Instagram',
        icon: MessageSquareText,
    },
];

function hasSearchSubject(value: string): boolean {
    return /[\p{L}\p{N}]/u.test(value);
}

function isWebImage(asset: DiscoveryImageAsset): asset is WebImageAsset {
    return asset.provider === 'SearXNG';
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
        // Keep provider implementation details out of creator-facing errors.
    }
    return 'Image search could not be opened. Try again shortly.';
}

function RightsBadge({ asset }: { asset: DiscoveryImageAsset }) {
    if (isWebImage(asset)) {
        return (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[9px] font-semibold text-amber-100">
                <ScanSearch className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Check source rights</span>
            </span>
        );
    }

    return (
        <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-100">
            <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{asset.licenseName}</span>
        </span>
    );
}

function ResultSource({ asset }: { asset: DiscoveryImageAsset }) {
    const label = isWebImage(asset)
        ? asset.sourceDomain
        : asset.provider;

    return (
        <a
            href={asset.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open source for ${asset.title}`}
            className="inline-flex min-w-0 items-center gap-1 text-[9px] text-white/40 transition-colors hover:text-white/75"
        >
            <span className="truncate">{label}</span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
        </a>
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
    asset: DiscoveryImageAsset;
    disabled: boolean;
    pendingAction: PendingImageAction | null;
    canUseAsTemplate: boolean;
    onUseAsTemplate: (asset: DiscoveryImageAsset) => void;
    onAddAsLayer: (asset: DiscoveryImageAsset) => void;
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
                {/* Results use either Wikimedia media or the SearXNG relay. */}
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
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <ResultSource asset={asset} />
                        <span className="shrink-0 text-[9px] text-white/35">
                            {asset.width} × {asset.height}
                        </span>
                    </div>
                    <div className="mt-1.5">
                        <RightsBadge asset={asset} />
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

function ResultGrid({
    title,
    description,
    assets,
    actionDisabled,
    pendingAction,
    canUseAsTemplate,
    onUseAsTemplate,
    onAddAsLayer,
}: {
    title: string;
    description: string;
    assets: DiscoveryImageAsset[];
    actionDisabled: boolean;
    pendingAction: PendingImageAction | null;
    canUseAsTemplate: boolean;
    onUseAsTemplate: (asset: DiscoveryImageAsset) => void;
    onAddAsLayer: (asset: DiscoveryImageAsset) => void;
}) {
    if (assets.length === 0) return null;

    return (
        <section className="space-y-2">
            <div>
                <h3 className="text-xs font-semibold text-white">{title}</h3>
                <p className="mt-0.5 text-[9px] leading-relaxed text-white/38">
                    {description}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-2">
                {assets.map((asset) => (
                    <ImageResultCard
                        key={asset.id}
                        asset={asset}
                        disabled={actionDisabled}
                        pendingAction={pendingAction}
                        canUseAsTemplate={canUseAsTemplate}
                        onUseAsTemplate={onUseAsTemplate}
                        onAddAsLayer={onAddAsLayer}
                    />
                ))}
            </div>
        </section>
    );
}

export default function CreatorDiscoveryPanel({
    onAddImage,
    onUseAsTemplate,
    disabled = false,
}: CreatorDiscoveryPanelProps) {
    const [data, setData] = useState<CreatorDiscoveryResponse | null>(null);
    const [searchInput, setSearchInput] = useState('');
    const [selectedIntent, setSelectedIntent] =
        useState<MemeSearchIntent>('moment');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [pendingAction, setPendingAction] =
        useState<PendingImageAction | null>(null);
    const activeRequestRef = useRef<AbortController | null>(null);
    const requestRevisionRef = useRef(0);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const loadDiscovery = useCallback(
        async (query: string, intent: MemeSearchIntent) => {
            activeRequestRef.current?.abort();
            const controller = new AbortController();
            const revision = requestRevisionRef.current + 1;
            requestRevisionRef.current = revision;
            activeRequestRef.current = controller;
            setLoading(true);
            setData(null);
            setError(null);
            setStatus(null);

            try {
                const parameters = new URLSearchParams({
                    q: query,
                    intent,
                });
                const response = await fetch(
                    `/api/creator-discovery?${parameters.toString()}`,
                    { signal: controller.signal }
                );
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
                if (
                    reason instanceof DOMException &&
                    reason.name === 'AbortError'
                ) {
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
        },
        []
    );

    useEffect(
        () => () => {
            requestRevisionRef.current += 1;
            activeRequestRef.current?.abort();
            activeRequestRef.current = null;
        },
        []
    );

    const runSearch = (
        query: string,
        intent: MemeSearchIntent = selectedIntent
    ) => {
        const normalized = query.normalize('NFKC').replace(/\s+/g, ' ').trim();
        if (!normalized) {
            setSearchInput('');
            setData(null);
            setError(null);
            setStatus(null);
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
        void loadDiscovery(normalized, intent);
    };

    const selectIntent = (intent: MemeSearchIntent) => {
        setSelectedIntent(intent);
        setError(null);
        setStatus(null);
        inputRef.current?.focus();

        if (data?.query && hasSearchSubject(searchInput)) {
            runSearch(searchInput, intent);
        }
    };

    const runImageAction = async (
        asset: DiscoveryImageAsset,
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

    const providerMessages: string[] = [];
    if (data?.providers.web === 'degraded') {
        providerMessages.push(
            'Some live web sources are temporarily unavailable; showing the results that responded.'
        );
    }

    if (
        data?.providers.web === 'not-configured' &&
        data.providers.commons === 'unavailable'
    ) {
        providerMessages.push(
            'Live web search is not configured, and reusable image search is temporarily unavailable.'
        );
    } else if (
        data?.providers.web === 'unavailable' &&
        data.providers.commons === 'unavailable'
    ) {
        providerMessages.push(
            'Both live web and reusable image search are temporarily unavailable.'
        );
    } else if (data?.providers.commons === 'unavailable') {
        providerMessages.push(
            data.webImages.length > 0
                ? 'Reusable image search is temporarily unavailable; showing live web results.'
                : 'Reusable image search is temporarily unavailable.'
        );
    } else if (data?.providers.commons === 'degraded') {
        providerMessages.push(
            'Reusable image search is partially available; showing the results that responded.'
        );
    } else if (
        data &&
        (data.providers.web === 'not-configured' ||
            data.providers.web === 'unavailable') &&
        data.reusableImages.length > 0
    ) {
        providerMessages.push(
            'Live web results are unavailable; showing reusable sources.'
        );
    } else if (data?.providers.web === 'not-configured') {
        providerMessages.push(
            'Live web search is not configured; reusable search returned no matches.'
        );
    } else if (data?.providers.web === 'unavailable') {
        providerMessages.push(
            'Live web search is temporarily unavailable; reusable search returned no matches.'
        );
    }

    const actionDisabled = disabled || loading || pendingAction !== null;
    const hasResults = Boolean(
        data &&
            (data.webImages.length > 0 || data.reusableImages.length > 0)
    );
    const hasProviderCoverage = Boolean(
        data &&
            [data.providers.web, data.providers.commons].some(
                (provider) =>
                    provider === 'live' || provider === 'degraded'
            )
    );
    const correctionShown = Boolean(
        data &&
            data.resolvedQuery &&
            data.resolvedQuery.toLocaleLowerCase() !==
                data.query.toLocaleLowerCase()
    );

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-sm font-semibold text-white">
                    Find meme material
                </h2>
                <p className="mt-0.5 text-[10px] leading-relaxed text-white/45">
                    Choose what you need, then search a person, event, quote, or
                    reaction.
                </p>
            </div>

            <div
                className="grid grid-cols-2 gap-1.5"
                aria-label="Meme material type"
            >
                {INTENT_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = selectedIntent === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={selected}
                            disabled={disabled || loading}
                            onClick={() => selectIntent(option.value)}
                            className={`min-w-0 rounded-lg border px-2.5 py-2 text-left transition-colors last:col-span-2 ${
                                selected
                                    ? 'border-[#8292eb]/60 bg-[#6a7bd1]/18 text-white'
                                    : 'border-white/8 bg-white/[0.025] text-white/65 hover:border-white/16 hover:bg-white/[0.05]'
                            }`}
                        >
                            <span className="flex items-center gap-1.5 text-[10px] font-semibold">
                                <Icon
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                {option.label}
                            </span>
                            <span className="mt-0.5 block truncate text-[8px] text-white/35">
                                {option.description}
                            </span>
                        </button>
                    );
                })}
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
                            ref={inputRef}
                            type="search"
                            aria-label="Search people, moments, reactions, and meme material"
                            value={searchInput}
                            maxLength={MAX_DISCOVERY_QUERY_LENGTH}
                            onChange={(event) =>
                                setSearchInput(event.target.value)
                            }
                            placeholder="e.g. CJP protest lathi charge"
                            disabled={disabled}
                            className="h-10 w-full rounded-lg border border-white/12 bg-black/35 pl-9 pr-3 text-xs text-white outline-none placeholder:text-white/30 focus:border-[#8ea0ff]/70 disabled:opacity-50"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={
                            disabled || loading || !searchInput.trim()
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

            {error && (
                <p
                    role="alert"
                    className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100"
                >
                    {error}
                </p>
            )}
            {!error &&
                providerMessages.map((providerMessage) => (
                    <p
                        key={providerMessage}
                        role="alert"
                        className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[10px] leading-relaxed text-amber-100"
                    >
                        {providerMessage}
                    </p>
                ))}
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

            {loading && (
                <div
                    role="status"
                    className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-white/8 bg-black/20 text-xs text-white/45"
                >
                    <Loader2
                        className="h-5 w-5 animate-spin text-[#9aa8ff]"
                        aria-hidden="true"
                    />
                    Searching fresh web and reusable sources…
                </div>
            )}

            {data && !loading && (
                <div className="space-y-4" aria-live="polite">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-white">
                                Material for “{data.query}”
                            </p>
                            {correctionShown && (
                                <p className="mt-1 text-[10px] text-[#bdc5ff]">
                                    Showing results for “{data.resolvedQuery}”
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                                setSearchInput('');
                                setData(null);
                                setError(null);
                                setStatus(null);
                                inputRef.current?.focus();
                            }}
                            className="shrink-0 rounded-md border border-white/10 px-2 py-1.5 text-[9px] font-medium text-white/55 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        >
                            New search
                        </button>
                    </div>

                    <ResultGrid
                        title="Fresh web"
                        description="Current web and news frames. Check the original source before publishing."
                        assets={data.webImages}
                        actionDisabled={actionDisabled}
                        pendingAction={pendingAction}
                        canUseAsTemplate={Boolean(onUseAsTemplate)}
                        onUseAsTemplate={(asset) =>
                            void runImageAction(asset, 'template')
                        }
                        onAddAsLayer={(asset) =>
                            void runImageAction(asset, 'layer')
                        }
                    />
                    <ResultGrid
                        title="Reusable & licensed"
                        description="Open-license images with source and credit details kept in your draft."
                        assets={data.reusableImages}
                        actionDisabled={actionDisabled}
                        pendingAction={pendingAction}
                        canUseAsTemplate={Boolean(onUseAsTemplate)}
                        onUseAsTemplate={(asset) =>
                            void runImageAction(asset, 'template')
                        }
                        onAddAsLayer={(asset) =>
                            void runImageAction(asset, 'layer')
                        }
                    />

                    {!hasResults && hasProviderCoverage && (
                        <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-4 text-center">
                            <Images
                                className="mx-auto h-5 w-5 text-white/28"
                                aria-hidden="true"
                            />
                            <p className="mt-2 text-[10px] leading-relaxed text-white/48">
                                No useful visual yet. Shorten the event name,
                                search the main person, or try Reaction face or
                                Clean cutout.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {!data && !loading && !error && (
                <div className="rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-[10px] leading-relaxed text-white/42">
                    For political or breaking memes, start with the event or
                    person. Switch modes to find an expression, clean subject,
                    blank format, or social frame from the same search.
                </div>
            )}
        </div>
    );
}
