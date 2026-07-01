import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_PREFIX = 'memehub/generated-exports';
const DEFAULT_MAX_AGE_HOURS = 24;
const MIN_MAX_AGE_HOURS = 1;
const MAX_MAX_AGE_HOURS = 24 * 30;
const CLOUDINARY_PAGE_SIZE = 100;
const CLOUDINARY_DELETE_BATCH_SIZE = 100;

type CloudinaryResource = {
    created_at?: string;
    public_id?: string;
};

type CloudinaryResourcesResponse = {
    next_cursor?: string;
    resources?: CloudinaryResource[];
};

function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.CLOUDINARY_CLEANUP_SECRET;
    if (!secret) return false;

    const header = request.headers.get('authorization') || '';
    return header === `Bearer ${secret}`;
}

function parseMaxAgeHours(value: string | null): number | null {
    if (value === null) return DEFAULT_MAX_AGE_HOURS;

    const maxAgeHours = Number(value);
    if (
        !Number.isFinite(maxAgeHours) ||
        maxAgeHours < MIN_MAX_AGE_HOURS ||
        maxAgeHours > MAX_MAX_AGE_HOURS
    ) {
        return null;
    }

    return maxAgeHours;
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
        return NextResponse.json(
            { error: 'Cloudinary cleanup is not configured.' },
            { status: 503 }
        );
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
    });

    const maxAgeHours = parseMaxAgeHours(request.nextUrl.searchParams.get('maxAgeHours'));
    if (maxAgeHours === null) {
        return NextResponse.json(
            { error: `maxAgeHours must be between ${MIN_MAX_AGE_HOURS} and ${MAX_MAX_AGE_HOURS}.` },
            { status: 400 }
        );
    }

    const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const publicIds: string[] = [];
    let nextCursor: string | undefined;

    do {
        const resources = (await cloudinary.api.resources({
            max_results: CLOUDINARY_PAGE_SIZE,
            next_cursor: nextCursor,
            prefix: EXPORT_PREFIX,
            resource_type: 'video',
            type: 'upload',
        })) as CloudinaryResourcesResponse;

        for (const resource of resources.resources || []) {
            if (!resource.public_id || !resource.created_at) continue;
            if (new Date(resource.created_at).getTime() < cutoffMs) {
                publicIds.push(resource.public_id);
            }
        }

        nextCursor = resources.next_cursor;
    } while (nextCursor);

    if (publicIds.length === 0) {
        return NextResponse.json({ deleted: 0 });
    }

    const deleted: Record<string, string> = {};
    for (let index = 0; index < publicIds.length; index += CLOUDINARY_DELETE_BATCH_SIZE) {
        const batch = publicIds.slice(index, index + CLOUDINARY_DELETE_BATCH_SIZE);
        const deleteResult = await cloudinary.api.delete_resources(batch, {
            resource_type: 'video',
            type: 'upload',
        });
        Object.assign(deleted, deleteResult.deleted || {});
    }

    return NextResponse.json({
        deleted: publicIds.length,
        result: deleted,
    });
}
