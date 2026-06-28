import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_FOLDER = 'memehub/generated-exports';
const EXPORT_TAGS = 'memehub-export,temp-export';
const EXPORT_ALLOWED_FORMATS = 'mp4,webm,mov';
const EXPORT_MAX_FILE_SIZE = String(25 * 1024 * 1024);
const SIGNATURE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const SIGNATURE_RATE_LIMIT_MAX_REQUESTS = 10;
const SIGNATURE_GLOBAL_RATE_LIMIT_MAX_REQUESTS = 200;

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function getClientIdentifier(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const clientIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-real-ip') ||
        forwardedFor;

    return clientIp || `unknown:${request.headers.get('user-agent') || 'no-user-agent'}`;
}

function pruneExpiredBuckets(now: number): void {
    for (const [key, bucket] of rateLimitBuckets) {
        if (bucket.resetAt <= now) {
            rateLimitBuckets.delete(key);
        }
    }
}

function consumeRateLimitToken(
    key: string,
    maxRequests: number,
    windowMs: number
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
    const now = Date.now();
    pruneExpiredBuckets(now);

    const bucket = rateLimitBuckets.get(key);
    if (!bucket) {
        rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
    }

    if (bucket.count >= maxRequests) {
        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
    }

    bucket.count += 1;
    return { allowed: true };
}

function refundRateLimitToken(key: string): void {
    const bucket = rateLimitBuckets.get(key);
    if (!bucket) return;

    if (bucket.count <= 1) {
        rateLimitBuckets.delete(key);
        return;
    }

    bucket.count -= 1;
}

function rateLimitedResponse(retryAfterSeconds: number) {
    return NextResponse.json(
        { error: 'Too many video export requests. Please try again shortly.' },
        {
            status: 429,
            headers: {
                'Cache-Control': 'no-store',
                'Retry-After': String(retryAfterSeconds),
            },
        }
    );
}

export async function POST(request: NextRequest) {
    const clientLimitKey = `video-upload-signature:${getClientIdentifier(request)}`;
    const clientLimit = consumeRateLimitToken(
        clientLimitKey,
        SIGNATURE_RATE_LIMIT_MAX_REQUESTS,
        SIGNATURE_RATE_LIMIT_WINDOW_MS
    );
    if (!clientLimit.allowed) {
        return rateLimitedResponse(clientLimit.retryAfterSeconds);
    }

    const globalLimit = consumeRateLimitToken(
        'video-upload-signature:global',
        SIGNATURE_GLOBAL_RATE_LIMIT_MAX_REQUESTS,
        SIGNATURE_RATE_LIMIT_WINDOW_MS
    );
    if (!globalLimit.allowed) {
        refundRateLimitToken(clientLimitKey);
        return rateLimitedResponse(globalLimit.retryAfterSeconds);
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const deliveryBaseUrl = process.env.NEXT_PUBLIC_CLOUDINARY_BASE_URL || 'https://res.cloudinary.com';

    if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json(
            { error: 'Cloudinary video export is not configured.' },
            { status: 503 }
        );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `meme-${randomUUID()}`;
    const uploadParams = {
        allowed_formats: EXPORT_ALLOWED_FORMATS,
        folder: EXPORT_FOLDER,
        max_file_size: EXPORT_MAX_FILE_SIZE,
        overwrite: 'false',
        public_id: publicId,
        tags: EXPORT_TAGS,
        timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(uploadParams, apiSecret);

    return NextResponse.json({
        allowedFormats: EXPORT_ALLOWED_FORMATS,
        apiKey,
        cloudName,
        deliveryBaseUrl,
        folder: EXPORT_FOLDER,
        maxFileSize: EXPORT_MAX_FILE_SIZE,
        overwrite: 'false',
        publicId,
        signature,
        tags: EXPORT_TAGS,
        timestamp,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    });
}
