'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import {
    deleteCreatorAsset,
    listCreatorAssets,
    loadCreatorAsset,
    saveCreatorAsset,
    touchCreatorAsset,
    type CreatorAsset,
    type CreatorAssetMetadata,
} from '@/lib/creatorAssets';

type CreatorAssetShelfProps = {
    onAddAsset: (asset: CreatorAsset) => void | Promise<void>;
};

function AssetThumbnail({
    asset,
}: {
    asset: CreatorAssetMetadata;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldLoad, setShouldLoad] = useState(false);
    const [source, setSource] = useState('');

    useEffect(() => {
        const element = containerRef.current;
        if (!element || typeof IntersectionObserver === 'undefined') {
            setShouldLoad(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries.find(
                    (candidate) => candidate.target === element
                );
                if (entry) setShouldLoad(entry.isIntersecting);
            },
            { rootMargin: '160px' }
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!shouldLoad) {
            setSource('');
            return;
        }

        let active = true;
        let objectUrl = '';
        void loadCreatorAsset(asset.id)
            .then((loadedAsset) => {
                if (!active || !loadedAsset) return;
                objectUrl = URL.createObjectURL(loadedAsset.blob);
                setSource(objectUrl);
            })
            .catch(() => undefined);

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [asset.id, shouldLoad]);

    return (
        <div ref={containerRef} className="h-full w-full">
            {source ? (
                // Blob URLs are local to this browser and cannot use Next image optimization.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={source}
                    alt=""
                    className="h-full w-full object-contain"
                />
            ) : (
                <div className="h-full w-full animate-pulse bg-white/5" />
            )}
        </div>
    );
}

export default function CreatorAssetShelf({
    onAddAsset,
}: CreatorAssetShelfProps) {
    const [assets, setAssets] = useState<CreatorAssetMetadata[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyAssetId, setBusyAssetId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const refreshAssets = useCallback(async () => {
        const nextAssets = await listCreatorAssets();
        setAssets(nextAssets);
    }, []);

    useEffect(() => {
        let active = true;
        listCreatorAssets()
            .then((nextAssets) => {
                if (active) setAssets(nextAssets);
            })
            .catch((reason) => {
                if (active) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Could not open your asset shelf.'
                    );
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const handleUpload = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setBusyAssetId('upload');
        setError(null);
        try {
            await saveCreatorAsset({
                blob: file,
                name: file.name || 'Reusable image',
            });
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Could not save this image.'
            );
            setBusyAssetId(null);
            return;
        }

        try {
            await refreshAssets();
        } catch {
            setError(
                'Saved locally, but the shelf could not be refreshed. Reopen My assets.'
            );
        } finally {
            setBusyAssetId(null);
        }
    };

    const handleAdd = async (asset: CreatorAssetMetadata) => {
        setBusyAssetId(asset.id);
        setError(null);
        try {
            const loadedAsset = await loadCreatorAsset(asset.id);
            if (!loadedAsset) {
                throw new Error('This saved asset is no longer available.');
            }
            await onAddAsset(loadedAsset);
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Could not add this asset to the canvas.'
            );
            setBusyAssetId(null);
            return;
        }

        try {
            await touchCreatorAsset(asset.id);
            await refreshAssets();
        } catch {
            setError(
                'Added to the canvas, but the shelf order could not be refreshed.'
            );
        } finally {
            setBusyAssetId(null);
        }
    };

    const handleDelete = async (asset: CreatorAssetMetadata) => {
        setBusyAssetId(asset.id);
        setError(null);
        try {
            await deleteCreatorAsset(asset.id);
            setAssets((current) =>
                current.filter((item) => item.id !== asset.id)
            );
        } catch (reason) {
            setError(
                reason instanceof Error
                    ? reason.message
                    : 'Could not delete this asset.'
            );
        } finally {
            setBusyAssetId(null);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-white">My assets</p>
                    <p className="text-[10px] leading-relaxed text-white/45">
                        Your reusable cutouts, logos, and reaction images live here.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busyAssetId !== null}
                    className="flex shrink-0 items-center gap-1.5 rounded-md bg-[#6a7bd1] px-2.5 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-[#7889e8] disabled:opacity-50"
                >
                    {busyAssetId === 'upload' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <ImagePlus className="h-3.5 w-3.5" />
                    )}
                    Save image
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Save reusable image"
                    onChange={handleUpload}
                    className="sr-only"
                />
            </div>

            {error && (
                <p
                    role="alert"
                    className="rounded-md border border-red-400/25 bg-red-400/10 px-2.5 py-2 text-[10px] leading-relaxed text-red-100"
                >
                    {error}
                </p>
            )}

            {loading ? (
                <div
                    role="status"
                    className="flex min-h-24 items-center justify-center gap-2 text-xs text-white/45"
                >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading assets…
                </div>
            ) : assets.length === 0 ? (
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/20 px-4 text-center transition-colors hover:border-[#6a7bd1]/60 hover:bg-[#6a7bd1]/5"
                >
                    <ImagePlus className="mb-2 h-5 w-5 text-white/35" />
                    <span className="text-xs font-medium text-white/70">
                        Save your first reusable asset
                    </span>
                    <span className="mt-1 text-[10px] text-white/35">
                        PNG, JPEG, or WebP · 5 MB each · 40 MB total
                    </span>
                </button>
            ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {assets.map((asset) => {
                        const busy = busyAssetId === asset.id;
                        return (
                            <div
                                key={asset.id}
                                className="group overflow-hidden rounded-lg border border-white/12 bg-black/30"
                            >
                                <div className="relative aspect-square bg-[linear-gradient(45deg,#20212b_25%,transparent_25%),linear-gradient(-45deg,#20212b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#20212b_75%),linear-gradient(-45deg,transparent_75%,#20212b_75%)] bg-[length:16px_16px]">
                                    <AssetThumbnail asset={asset} />
                                    {busy && (
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/65">
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                        </span>
                                    )}
                                </div>
                                <div className="px-1.5 pb-1.5 pt-1">
                                    <p
                                        className="truncate text-[9px] text-white/55"
                                        title={asset.name}
                                    >
                                        {asset.name}
                                    </p>
                                    <div className="mt-1 flex gap-1">
                                        <button
                                            type="button"
                                            aria-label={`Add ${asset.name} to canvas`}
                                            disabled={busyAssetId !== null}
                                            onClick={() => handleAdd(asset)}
                                            className="flex flex-1 items-center justify-center gap-1 rounded bg-[#6a7bd1] px-1 py-1 text-[9px] font-medium text-white disabled:opacity-45"
                                        >
                                            <Plus className="h-3 w-3" />
                                            Add
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Delete ${asset.name}`}
                                            disabled={busyAssetId !== null}
                                            onClick={() => handleDelete(asset)}
                                            className="rounded bg-white/8 p-1 text-white/55 hover:bg-red-500/20 hover:text-red-200 disabled:opacity-45"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
