import { NextRequest, NextResponse } from 'next/server';
import { consumeDiscoveryImageRateLimit } from '@/lib/discoveryRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/octet-stream',
]);

function imageProxyUrl(value: string, baseValue: string): string | undefined {
    try {
        const baseUrl = new URL(baseValue.trim());
        const imageUrl = new URL(value);
        const normalizedBasePath = baseUrl.pathname.replace(/\/+$/, '');
        const expectedPath = `${normalizedBasePath}/image_proxy`;
        if (
            (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') ||
            baseUrl.username ||
            baseUrl.password ||
            imageUrl.origin !== baseUrl.origin ||
            imageUrl.pathname !== expectedPath ||
            !imageUrl.searchParams.get('url')
        ) {
            return undefined;
        }
        return imageUrl.toString();
    } catch {
        return undefined;
    }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
    const searxngUrl = process.env.SEARXNG_URL?.trim();
    const requestedUrl = request.nextUrl.searchParams.get('url');
    const proxyUrl =
        searxngUrl && requestedUrl
            ? imageProxyUrl(requestedUrl, searxngUrl)
            : undefined;
    if (!proxyUrl) {
        return NextResponse.json(
            { error: 'Invalid image source.' },
            { status: 400 }
        );
    }

    const rateLimit = await consumeDiscoveryImageRateLimit(request);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error:
                    rateLimit.reason === 'unavailable'
                        ? 'Image relay is temporarily unavailable.'
                        : 'Too many image requests. Try again shortly.',
            },
            {
                status: rateLimit.reason === 'unavailable' ? 503 : 429,
                headers: {
                    'Cache-Control': 'private, no-store',
                    'Retry-After': String(rateLimit.retryAfterSeconds),
                },
            }
        );
    }

    try {
        const upstream = await fetch(proxyUrl, {
            credentials: 'omit',
            redirect: 'error',
            referrerPolicy: 'no-referrer',
            signal: AbortSignal.timeout(12_000),
        });
        if (!upstream.ok || upstream.redirected || !upstream.body) {
            return NextResponse.json(
                { error: 'Image is temporarily unavailable.' },
                { status: 502 }
            );
        }

        const contentType = (upstream.headers.get('content-type') ?? '')
            .split(';', 1)[0]
            .trim()
            .toLowerCase();
        const contentLengthHeader = upstream.headers.get('content-length');
        const contentLength = contentLengthHeader
            ? Number(contentLengthHeader)
            : undefined;
        if (
            !ALLOWED_IMAGE_TYPES.has(contentType) ||
            (contentLength !== undefined &&
                (!Number.isSafeInteger(contentLength) ||
                    contentLength < 0 ||
                    contentLength > MAX_IMAGE_BYTES))
        ) {
            return NextResponse.json(
                { error: 'Image is unavailable.' },
                { status: 502 }
            );
        }

        return new NextResponse(upstream.body, {
            headers: {
                'Cache-Control': 'private, max-age=300',
                'Content-Type': contentType,
                ...(contentLength !== undefined
                    ? { 'Content-Length': String(contentLength) }
                    : {}),
            },
        });
    } catch {
        return NextResponse.json(
            { error: 'Image is temporarily unavailable.' },
            { status: 502 }
        );
    }
}
