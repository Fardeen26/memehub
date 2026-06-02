'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GiphyMediaItem } from '@/types/giphy';

type GiphyMediaType = 'gif' | 'sticker';

type UseGiphyMediaResult = {
    items: GiphyMediaItem[];
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    loadMore: () => void;
    search: (query: string) => void;
    query: string;
};

export function useGiphyMedia(type: GiphyMediaType, enabled: boolean): UseGiphyMediaResult {
    const [items, setItems] = useState<GiphyMediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const requestId = useRef(0);

    const fetchPage = useCallback(
        async (searchQuery: string, pageOffset: number, append: boolean) => {
            const id = ++requestId.current;
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    type,
                    offset: String(pageOffset),
                    limit: '24',
                });
                if (searchQuery.trim()) {
                    params.set('q', searchQuery.trim());
                }

                const response = await fetch(`/api/giphy/search?${params.toString()}`);
                const data = await response.json();

                if (id !== requestId.current) return;

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to load media');
                }

                const newItems = (data.items ?? []) as GiphyMediaItem[];
                const pagination = data.pagination ?? { total_count: 0, count: 0, offset: 0 };

                setItems((prev) => (append ? [...prev, ...newItems] : newItems));
                setHasMore(pagination.offset + pagination.count < pagination.total_count);
                setOffset(pageOffset + pagination.count);
            } catch (err) {
                if (id !== requestId.current) return;
                setError(err instanceof Error ? err.message : 'Failed to load media');
                if (!append) setItems([]);
                setHasMore(false);
            } finally {
                if (id === requestId.current) setLoading(false);
            }
        },
        [type]
    );

    const search = useCallback(
        (nextQuery: string) => {
            setQuery(nextQuery);
            setOffset(0);
            fetchPage(nextQuery, 0, false);
        },
        [fetchPage]
    );

    const loadMore = useCallback(() => {
        if (loading || !hasMore) return;
        fetchPage(query, offset, true);
    }, [loading, hasMore, query, offset, fetchPage]);

    useEffect(() => {
        if (!enabled) return;
        setQuery('');
        setOffset(0);
        fetchPage('', 0, false);
    }, [enabled, type, fetchPage]);

    return { items, loading, error, hasMore, loadMore, search, query };
}
