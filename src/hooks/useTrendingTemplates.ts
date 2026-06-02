"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchTrendingTemplatesFromImgflip } from "@/lib/imgflip";
import type { Template } from "@/types/template";
import type { TrendingTemplatesResponse } from "@/types/imgflip";

type UseTrendingTemplatesResult = {
    templates: Record<string, Template>;
    loading: boolean;
    error: string | null;
    refetch: () => void;
};

async function fetchViaApiRoute(): Promise<Record<string, Template>> {
    const response = await fetch("/api/templates", {
        signal: AbortSignal.timeout(15000),
    });

    const data: TrendingTemplatesResponse = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || "API route failed");
    }

    return data.templates;
}

async function loadTrendingTemplates(): Promise<Record<string, Template>> {
    try {
        return await fetchTrendingTemplatesFromImgflip();
    } catch (directError) {
        console.warn("Direct Imgflip fetch failed, trying API route:", directError);

        try {
            return await fetchViaApiRoute();
        } catch (apiError) {
            console.error("API route fallback failed:", apiError);
            throw directError;
        }
    }
}

export function useTrendingTemplates(): UseTrendingTemplatesResult {
    const [templates, setTemplates] = useState<Record<string, Template>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fetchKey, setFetchKey] = useState(0);

    const refetch = useCallback(() => {
        setFetchKey((current) => current + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);

            try {
                const nextTemplates = await loadTrendingTemplates();

                if (!cancelled) {
                    setTemplates(nextTemplates);
                }
            } catch {
                if (!cancelled) {
                    setError("Failed to load trending templates");
                    setTemplates({});
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [fetchKey]);

    return { templates, loading, error, refetch };
}
