import { NextRequest, NextResponse } from 'next/server';
import { fetchGiphy } from '@/lib/giphy';

export async function GET(request: NextRequest) {
    const apiKey = process.env.GIPHY_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            {
                error: 'GIPHY_API_KEY is not configured. Add it to your environment variables.',
                items: [],
            },
            { status: 503 }
        );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') === 'sticker' ? 'sticker' : 'gif';
    const q = searchParams.get('q') ?? undefined;
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;
    const limit = parseInt(searchParams.get('limit') ?? '24', 10) || 24;

    try {
        const result = await fetchGiphy(apiKey, type, { q, offset, limit });
        return NextResponse.json(result);
    } catch (error) {
        console.error('Giphy search error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Giphy search failed', items: [] },
            { status: 502 }
        );
    }
}
