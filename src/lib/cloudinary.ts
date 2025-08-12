interface CloudinaryTransformations {
    width?: number;
    height?: number;
    quality?: 'auto' | 'auto:best' | 'auto:good' | 'auto:eco' | number;
    format?: 'auto' | 'webp' | 'avif' | 'jpg' | 'png';
    crop?: 'fill' | 'fit' | 'scale' | 'pad' | 'crop';
    gravity?: 'auto' | 'face' | 'center' | 'north' | 'south';
    fetch_format?: 'auto';
    flags?: 'progressive' | 'immutable_cache' | 'lossy';
    effect?: string;
    blur?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
}

export class CloudinaryOptimizer {
    private baseUrl: string;
    private cloudName: string;

    constructor() {
        this.cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
        this.baseUrl = process.env.NEXT_PUBLIC_CLOUDINARY_BASE_URL || 'https://res.cloudinary.com';
    }

    optimizeUrl(
        originalUrl: string | { publicId: string },
        transformations: CloudinaryTransformations = {}
    ): string {
        if (!this.cloudName) {
            if (typeof originalUrl === 'string') {
                return originalUrl;
            } else {
                throw new Error('Cloudinary cloud name not configured');
            }
        }

        let publicId: string;

        if (typeof originalUrl === 'string') {
            if (originalUrl.includes('cloudinary.com')) {
                const urlParts = originalUrl.split('/');
                const uploadIndex = urlParts.indexOf('upload');
                if (uploadIndex !== -1 && urlParts.length > uploadIndex + 1) {
                    const pathAfterUpload = urlParts.slice(uploadIndex + 1).join('/');
                    publicId = pathAfterUpload.replace(/^v\d+\//, '');
                    publicId = publicId.replace(/\.[^.]+$/, '');
                } else {
                    throw new Error('Invalid Cloudinary URL format');
                }
            } else {
                publicId = originalUrl;
            }
        } else {
            publicId = originalUrl.publicId;
        }

        const transformParts: string[] = [];

        transformParts.push(`q_${transformations.quality || 'auto:eco'}`);

        transformParts.push(`f_${transformations.format || 'auto'}`);

        if (transformations.width) transformParts.push(`w_${transformations.width}`);
        if (transformations.height) transformParts.push(`h_${transformations.height}`);

        if (transformations.crop) transformParts.push(`c_${transformations.crop}`);
        if (transformations.gravity) transformParts.push(`g_${transformations.gravity}`);

        transformParts.push('fl_progressive');
        transformParts.push('fl_immutable_cache');

        if (transformations.effect) transformParts.push(`e_${transformations.effect}`);
        if (transformations.blur) transformParts.push(`e_blur:${transformations.blur}`);
        if (transformations.brightness) transformParts.push(`e_brightness:${transformations.brightness}`);
        if (transformations.contrast) transformParts.push(`e_contrast:${transformations.contrast}`);
        if (transformations.saturation) transformParts.push(`e_saturation:${transformations.saturation}`);

        const transformString = transformParts.join(',');

        return `${this.baseUrl}/${this.cloudName}/image/upload/${transformString}/${publicId}`;
    }

    generateResponsiveUrls(
        originalUrl: string | { publicId: string },
        baseTransformations: CloudinaryTransformations = {}
    ) {
        return {
            mobile: this.optimizeUrl(originalUrl, {
                ...baseTransformations,
                width: 480,
                quality: 'auto:eco'
            }),
            tablet: this.optimizeUrl(originalUrl, {
                ...baseTransformations,
                width: 768,
                quality: 'auto:good'
            }),
            desktop: this.optimizeUrl(originalUrl, {
                ...baseTransformations,
                width: 1200,
                quality: 'auto:best'
            }),
            original: this.optimizeUrl(originalUrl, baseTransformations)
        };
    }

    getThumbnail(
        originalUrl: string | { publicId: string },
        size: number = 200
    ): string {
        return this.optimizeUrl(originalUrl, {
            width: size,
            height: size,
            crop: 'fill',
            gravity: 'auto',
            quality: 'auto:eco'
        });
    }

    getBlurPlaceholder(
        originalUrl: string | { publicId: string }
    ): string {
        return this.optimizeUrl(originalUrl, {
            width: 20,
            height: 20,
            quality: 'auto:eco',
            blur: 1000,
            fetch_format: 'auto'
        });
    }
}

export const cloudinary = new CloudinaryOptimizer();