import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_PREFIX = 'memehub/generated-exports';
const DEFAULT_MAX_AGE_HOURS = 24;

function isAuthorized(request: NextRequest): boolean {
    const secret = process.env.CLOUDINARY_CLEANUP_SECRET;
    if (!secret) return false;

    const header = request.headers.get('authorization') || '';
    return header === `Bearer ${secret}`;
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

    const maxAgeHours = Number(request.nextUrl.searchParams.get('maxAgeHours')) || DEFAULT_MAX_AGE_HOURS;
    const cutoffMs = Date.now() - maxAgeHours * 60 * 60 * 1000;
    const resources = await cloudinary.api.resources({
        max_results: 100,
        prefix: EXPORT_PREFIX,
        resource_type: 'video',
        type: 'upload',
    });

    const publicIds = (resources.resources || [])
        .filter((resource: { created_at?: string; public_id?: string }) => {
            if (!resource.public_id || !resource.created_at) return false;
            return new Date(resource.created_at).getTime() < cutoffMs;
        })
        .map((resource: { public_id: string }) => resource.public_id);

    if (publicIds.length === 0) {
        return NextResponse.json({ deleted: 0 });
    }

    const deleteResult = await cloudinary.api.delete_resources(publicIds, {
        resource_type: 'video',
        type: 'upload',
    });

    return NextResponse.json({
        deleted: publicIds.length,
        result: deleteResult.deleted || {},
    });
}
