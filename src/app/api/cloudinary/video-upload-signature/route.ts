import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_FOLDER = 'memehub/generated-exports';
const EXPORT_TAGS = 'memehub-export,temp-export';
const EXPORT_ALLOWED_FORMATS = 'mp4,webm,mov';
const EXPORT_MAX_FILE_SIZE = String(50 * 1024 * 1024);

function getEnv(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value || undefined;
}

const EXPORT_UPLOAD_PRESET = getEnv('CLOUDINARY_VIDEO_EXPORT_UPLOAD_PRESET');
const REQUIRE_UPLOAD_PRESET =
    process.env.NODE_ENV === 'production' &&
    process.env.CLOUDINARY_VIDEO_EXPORT_REQUIRE_UPLOAD_PRESET !== 'false';
const SIGNATURE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const SIGNATURE_RATE_LIMIT_MAX_REQUESTS = 10;
const SIGNATURE_GLOBAL_RATE_LIMIT_MAX_REQUESTS = 200;
const RATE_LIMIT_REDIS_URL = getEnv('UPSTASH_REDIS_REST_URL')?.replace(/\/$/, '');
const RATE_LIMIT_REDIS_TOKEN = getEnv('UPSTASH_REDIS_REST_TOKEN');
const ALLOW_MEMORY_RATE_LIMIT =
    process.env.NODE_ENV !== 'production' ||
    process.env.CLOUDINARY_VIDEO_EXPORT_ALLOW_MEMORY_RATE_LIMIT === 'true';

type RateLimitBucket = {
    count: number;
    resetAt: number;
};

type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

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
): RateLimitResult {
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

function hasSharedRateLimitStore(): boolean {
    return Boolean(RATE_LIMIT_REDIS_URL && RATE_LIMIT_REDIS_TOKEN);
}

async function redisCommand<T = unknown>(command: Array<string | number>): Promise<T> {
    if (!RATE_LIMIT_REDIS_URL || !RATE_LIMIT_REDIS_TOKEN) {
        throw new Error('Shared rate limit store is not configured.');
    }

    const response = await fetch(`${RATE_LIMIT_REDIS_URL}/pipeline`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RATE_LIMIT_REDIS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify([command]),
        cache: 'no-store',
    });

    const data = (await response.json().catch(() => null)) as
        | Array<{ result?: T; error?: string }>
        | null;
    const first = data?.[0];

    if (!response.ok || !first || first.error) {
        throw new Error(first?.error || 'Shared rate limit store request failed.');
    }

    return first.result as T;
}

async function consumeSharedRateLimitToken(
    key: string,
    maxRequests: number,
    windowMs: number
): Promise<RateLimitResult> {
    const count = Number(await redisCommand<number>(['INCR', key]));

    if (count === 1) {
        await redisCommand<number>(['PEXPIRE', key, windowMs]);
    }

    if (count <= maxRequests) {
        return { allowed: true };
    }

    const ttlMs = Number(await redisCommand<number>(['PTTL', key]));
    return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000)),
    };
}

async function refundSharedRateLimitToken(key: string): Promise<void> {
    await redisCommand<number>(['DECR', key]);
}

async function consumeSignatureRateLimitToken(
    key: string,
    maxRequests: number,
    windowMs: number
): Promise<RateLimitResult> {
    if (hasSharedRateLimitStore()) {
        return consumeSharedRateLimitToken(key, maxRequests, windowMs);
    }

    if (!ALLOW_MEMORY_RATE_LIMIT) {
        throw new Error('Shared rate limiting is required for Cloudinary video export signatures.');
    }

    return consumeRateLimitToken(key, maxRequests, windowMs);
}

async function refundSignatureRateLimitToken(key: string): Promise<void> {
    if (hasSharedRateLimitStore()) {
        await refundSharedRateLimitToken(key);
        return;
    }

    if (ALLOW_MEMORY_RATE_LIMIT) {
        refundRateLimitToken(key);
    }
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

function rateLimitUnavailableResponse() {
    return NextResponse.json(
        { error: 'Cloudinary video export rate limiting is not configured.' },
        {
            status: 503,
            headers: { 'Cache-Control': 'no-store' },
        }
    );
}

export async function POST(request: NextRequest) {
    const clientLimitKey = `video-upload-signature:${getClientIdentifier(request)}`;
    let clientLimitConsumed = false;

    try {
        const clientLimit = await consumeSignatureRateLimitToken(
            clientLimitKey,
            SIGNATURE_RATE_LIMIT_MAX_REQUESTS,
            SIGNATURE_RATE_LIMIT_WINDOW_MS
        );
        if (!clientLimit.allowed) {
            return rateLimitedResponse(clientLimit.retryAfterSeconds);
        }
        clientLimitConsumed = true;

        const globalLimit = await consumeSignatureRateLimitToken(
            'video-upload-signature:global',
            SIGNATURE_GLOBAL_RATE_LIMIT_MAX_REQUESTS,
            SIGNATURE_RATE_LIMIT_WINDOW_MS
        );
        if (!globalLimit.allowed) {
            await refundSignatureRateLimitToken(clientLimitKey);
            return rateLimitedResponse(globalLimit.retryAfterSeconds);
        }
    } catch (error) {
        if (clientLimitConsumed) {
            await refundSignatureRateLimitToken(clientLimitKey).catch((refundError) => {
                console.error('Cloudinary video export rate limit refund error:', refundError);
            });
        }
        console.error('Cloudinary video export rate limit error:', error);
        return rateLimitUnavailableResponse();
    }

    const cloudName = getEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
    const apiKey = getEnv('CLOUDINARY_API_KEY');
    const apiSecret = getEnv('CLOUDINARY_API_SECRET');
    const deliveryBaseUrl = getEnv('NEXT_PUBLIC_CLOUDINARY_BASE_URL') || 'https://res.cloudinary.com';

    if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json(
            { error: 'Cloudinary video export is not configured.' },
            { status: 503 }
        );
    }

    if (REQUIRE_UPLOAD_PRESET && !EXPORT_UPLOAD_PRESET) {
        return NextResponse.json(
            { error: 'Cloudinary video export upload preset is not configured.' },
            { status: 503 }
        );
    }

    const timestamp = Math.round(Date.now() / 1000);
    const publicId = `meme-${randomUUID()}`;
    const uploadParams: Record<string, string | number> = {
        allowed_formats: EXPORT_ALLOWED_FORMATS,
        folder: EXPORT_FOLDER,
        overwrite: 'false',
        public_id: publicId,
        tags: EXPORT_TAGS,
        timestamp,
    };
    if (EXPORT_UPLOAD_PRESET) {
        uploadParams.upload_preset = EXPORT_UPLOAD_PRESET;
    }
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
        uploadPreset: EXPORT_UPLOAD_PRESET,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    });
}
