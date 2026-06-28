import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_FOLDER = 'memehub/generated-exports';
const EXPORT_TAGS = 'memehub-export,temp-export';

export async function POST() {
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
        folder: EXPORT_FOLDER,
        overwrite: true,
        public_id: publicId,
        tags: EXPORT_TAGS,
        timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(uploadParams, apiSecret);

    return NextResponse.json({
        apiKey,
        cloudName,
        deliveryBaseUrl,
        folder: EXPORT_FOLDER,
        overwrite: 'true',
        publicId,
        signature,
        tags: EXPORT_TAGS,
        timestamp,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    });
}
