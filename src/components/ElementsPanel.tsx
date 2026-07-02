'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Film, Loader2, Search, Shapes, Sticker } from 'lucide-react';
import {
    GIPHY_GIF_QUERIES,
    GIPHY_STICKER_QUERIES,
    MEME_SHAPES,
} from '@/data/meme-elements';
import { useGiphyMedia } from '@/hooks/useGiphyMedia';
import type { ShapeType } from '@/types/editor';
import type { GiphyMediaItem } from '@/types/giphy';

type ElementsPanelProps = {
    onAddMedia: (item: GiphyMediaItem) => void | Promise<void>;
    onAddShape: (type: ShapeType) => void;
    disabled?: boolean;
};

type Tab = 'stickers' | 'gifs' | 'shapes';

function MediaGrid({
    items,
    loading,
    error,
    hasMore,
    onLoadMore,
    onSelect,
    disabled,
    addingItemId,
}: {
    items: ReturnType<typeof useGiphyMedia>['items'];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    onLoadMore: () => void;
    onSelect: (item: GiphyMediaItem) => void | Promise<void>;
    disabled: boolean;
    addingItemId: string | null;
}) {
    if (error && items.length === 0) {
        return (
            <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-xs text-amber-100/90 leading-relaxed">
                {error}
                {error.includes('GIPHY_API_KEY') && (
                    <span className="block mt-1 text-white/50">
                        Get a free key at{' '}
                        <a
                            href="https://developers.giphy.com/dashboard/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-[#6a7bd1]"
                        >
                            developers.giphy.com
                        </a>
                    </span>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto p-1.5 rounded-md border border-white/10 bg-black/40">
                {items.map((item) => {
                    const isAdding = addingItemId === item.id;
                    const isWaiting = Boolean(addingItemId) && !isAdding;

                    return (
                        <motion.button
                            key={item.id}
                            type="button"
                            disabled={disabled || Boolean(addingItemId)}
                            whileTap={{ scale: 0.92 }}
                            title={isAdding ? `Adding ${item.title || 'media'}...` : item.title}
                            aria-busy={isAdding}
                            onClick={() => onSelect(item)}
                            className={`group relative aspect-square rounded-md border bg-white/5 overflow-hidden transition-all duration-200 disabled:cursor-not-allowed ${
                                isAdding
                                    ? 'border-[#8ea0ff] shadow-[0_0_18px_rgba(106,123,209,0.45)]'
                                    : 'border-white/15 hover:bg-white/15 hover:border-[#6a7bd1]/60'
                            } ${isWaiting ? 'opacity-35' : ''}`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={item.previewUrl || item.stillUrl || item.url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className={`w-full h-full object-contain bg-black/20 pointer-events-none transition-transform duration-300 ${
                                    isAdding ? 'scale-110 opacity-45 blur-[1px]' : 'group-hover:scale-105'
                                }`}
                            />
                            {isAdding && (
                                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white">
                                    <span className="relative flex h-9 w-9 items-center justify-center">
                                        <span className="absolute inset-0 rounded-full border border-[#8ea0ff]/30 bg-[#6a7bd1]/20 animate-ping" />
                                        <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/70">
                                            <Loader2 className="h-4 w-4 animate-spin text-[#b8c2ff]" />
                                        </span>
                                    </span>
                                </span>
                            )}
                        </motion.button>
                    );
                })}
                {loading &&
                    items.length === 0 &&
                    Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="aspect-square rounded-md bg-white/5 animate-pulse border border-white/10"
                        />
                    ))}
            </div>
            {hasMore && (
                <button
                    type="button"
                    disabled={disabled || Boolean(addingItemId) || loading}
                    onClick={onLoadMore}
                    className="w-full py-1.5 text-xs rounded-md border border-white/20 text-white/70 hover:bg-white/10 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Load more
                </button>
            )}
        </>
    );
}

export default function ElementsPanel({
    onAddMedia,
    onAddShape,
    disabled = false,
}: ElementsPanelProps) {
    const [tab, setTab] = useState<Tab>('stickers');
    const [searchInput, setSearchInput] = useState('');
    const [addingMediaId, setAddingMediaId] = useState<string | null>(null);

    const stickers = useGiphyMedia('sticker', tab === 'stickers');
    const gifs = useGiphyMedia('gif', tab === 'gifs');

    const active = tab === 'stickers' ? stickers : gifs;
    const quickQueries = tab === 'stickers' ? GIPHY_STICKER_QUERIES : GIPHY_GIF_QUERIES;
    const isAddingMedia = addingMediaId !== null;
    const controlsDisabled = disabled || isAddingMedia;

    useEffect(() => {
        setSearchInput(active.query);
    }, [tab, active.query]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (controlsDisabled) return;
        active.search(searchInput);
    };

    const handleSelectMedia = async (item: GiphyMediaItem) => {
        if (controlsDisabled) return;

        setAddingMediaId(item.id);
        try {
            await onAddMedia(item);
        } finally {
            setAddingMediaId((current) => (current === item.id ? null : current));
        }
    };

    const tabClass = (activeTab: boolean) =>
        `flex-1 flex items-center justify-center gap-1 py-2 text-[10px] sm:text-xs transition-colors ${
            activeTab ? 'bg-[#6a7bd1] text-white' : 'bg-black/70 text-white/70 hover:bg-white/10'
        }`;

    return (
        <div className="space-y-2">
            <div className="flex rounded-md border border-white/20 overflow-hidden">
                <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setTab('stickers')}
                    className={tabClass(tab === 'stickers')}
                >
                    <Sticker className="h-3.5 w-3.5 shrink-0" />
                    Stickers
                </button>
                <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setTab('gifs')}
                    className={tabClass(tab === 'gifs')}
                >
                    <Film className="h-3.5 w-3.5 shrink-0" />
                    GIFs
                </button>
                <button
                    type="button"
                    disabled={controlsDisabled}
                    onClick={() => setTab('shapes')}
                    className={tabClass(tab === 'shapes')}
                >
                    <Shapes className="h-3.5 w-3.5 shrink-0" />
                    Shapes
                </button>
            </div>

            {(tab === 'stickers' || tab === 'gifs') && (
                <>
                    <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                            <input
                                type="search"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                placeholder={`Search Giphy ${tab}...`}
                                disabled={controlsDisabled}
                                className="w-full pl-8 pr-2 py-1.5 text-xs rounded-md bg-black/70 border border-white/20 text-white placeholder:text-white/40"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={controlsDisabled || active.loading}
                            className="px-3 py-1.5 text-xs rounded-md bg-[#6a7bd1] hover:bg-[#6975b3] text-white disabled:opacity-50"
                        >
                            Go
                        </button>
                    </form>

                    <div className="flex flex-wrap gap-1">
                        {quickQueries.map((q) => (
                            <button
                                key={q}
                                type="button"
                                disabled={controlsDisabled}
                                onClick={() => {
                                    setSearchInput(q);
                                    active.search(q);
                                }}
                                className="px-2 py-0.5 rounded-full text-[10px] border border-white/15 text-white/50 hover:text-white/80 hover:border-[#6a7bd1]/50"
                            >
                                {q}
                            </button>
                        ))}
                    </div>

                    <MediaGrid
                        items={active.items}
                        loading={active.loading}
                        error={active.error}
                        hasMore={active.hasMore}
                        onLoadMore={active.loadMore}
                        disabled={disabled}
                        addingItemId={addingMediaId}
                        onSelect={handleSelectMedia}
                    />

                    <p className="text-[9px] text-white/35 text-right">Powered by GIPHY</p>
                </>
            )}

            {tab === 'shapes' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-4 gap-1.5"
                >
                    {MEME_SHAPES.map((shape) => (
                        <motion.button
                            key={shape.type}
                            type="button"
                            disabled={controlsDisabled}
                            whileTap={{ scale: 0.95 }}
                            title={shape.label}
                            onClick={() => onAddShape(shape.type)}
                            className="flex flex-col items-center justify-center py-2 px-1 rounded-md border border-white/15 bg-black/70 hover:bg-white/10 hover:border-[#6a7bd1]/60 text-white text-xs transition-colors disabled:opacity-50"
                        >
                            <span className="text-lg leading-none mb-0.5">{shape.icon}</span>
                            <span className="text-[10px] text-white/70">{shape.label}</span>
                        </motion.button>
                    ))}
                </motion.div>
            )}

            {tab === 'shapes' && (
                <p className="text-[10px] text-white/40 leading-snug">
                    Drawing tools for arrows and highlights. Stickers & GIFs come from Giphy.
                </p>
            )}
        </div>
    );
}
