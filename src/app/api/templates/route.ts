import { transformImgflipMemes, IMGFLIP_MEMES_URL } from "@/lib/imgflip";
import type { ImgflipMemesResponse } from "@/types/imgflip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_SECONDS = 3600;

export async function GET() {
    try {
        const response = await fetch(IMGFLIP_MEMES_URL, {
            headers: {
                Accept: "application/json",
                "User-Agent": "MemeHub/1.0",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            return Response.json(
                {
                    success: false,
                    error: "Failed to fetch trending templates",
                    templates: {},
                    fetchedAt: new Date().toISOString(),
                },
                { status: 502 }
            );
        }

        const data: ImgflipMemesResponse = await response.json();

        if (!data.success || !Array.isArray(data.data?.memes) || data.data.memes.length === 0) {
            return Response.json(
                {
                    success: false,
                    error: "Invalid response from template provider",
                    templates: {},
                    fetchedAt: new Date().toISOString(),
                },
                { status: 502 }
            );
        }

        const templates = transformImgflipMemes(data.data.memes);

        return Response.json(
            {
                success: true,
                templates,
                fetchedAt: new Date().toISOString(),
            },
            {
                headers: {
                    "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
                },
            }
        );
    } catch (error) {
        console.error("[api/templates] Failed to fetch Imgflip memes:", error);

        return Response.json(
            {
                success: false,
                error: "Unable to load trending templates",
                templates: {},
                fetchedAt: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
