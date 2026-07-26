import type { MemeSearchIntent } from '@/lib/memeSearchPlanner';

export type CreatorSourceKind = 'news' | 'video';

export type CreatorSourceReference = {
    id: string;
    title: string;
    publisher: string;
    url: string;
    imageUrl?: string;
    publishedAt: string;
    kind: CreatorSourceKind;
};

export type IndiaTrendSignal = {
    id: string;
    title: string;
    approximateTraffic: number;
    trafficLabel: string;
    publishedAt: string;
    imageUrl?: string;
    imageSource?: string;
    sources: CreatorSourceReference[];
};

export type ReusableImageRights =
    | 'editable'
    | 'attribution'
    | 'share-alike';

export type ReusableImageAsset = {
    id: string;
    title: string;
    previewUrl: string;
    assetUrl: string;
    sourceUrl: string;
    width: number;
    height: number;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    creator: string;
    /** Exact credit line supplied by the source, when different from artist. */
    creditLine?: string;
    licenseName: string;
    licenseUrl?: string;
    attributionRequired?: boolean;
    usageTerms?: string;
    /** Non-copyright notices such as personality, privacy, or trademark rights. */
    restrictions?: string;
    provider: 'Wikimedia Commons';
    rights: ReusableImageRights;
};

export type WebImageAsset = {
    id: string;
    title: string;
    /** Privacy-preserving image rendition returned by the search provider. */
    previewUrl: string;
    /** The same trusted proxy rendition used when adding the result to canvas. */
    assetUrl: string;
    /** Publisher page where the image was discovered. */
    sourceUrl: string;
    sourceDomain: string;
    width: number;
    height: number;
    provider: 'SearXNG';
    kind: 'web' | 'news';
    publishedAt?: string;
    confidence?: 'low' | 'medium' | 'high';
    /** Web search discovers media; it does not grant reuse rights. */
    rights: 'unknown';
};

export type DiscoveryImageAsset = ReusableImageAsset | WebImageAsset;

export type DiscoveryProviderState =
    | 'live'
    | 'degraded'
    | 'idle'
    | 'not-configured'
    | 'rate-limited'
    | 'unavailable';

export type CreatorDiscoveryResponse = {
    fetchedAt: string;
    query: string;
    resolvedQuery: string;
    intent: MemeSearchIntent;
    region: 'IN';
    trends: IndiaTrendSignal[];
    webImages: WebImageAsset[];
    reusableImages: ReusableImageAsset[];
    videos: CreatorSourceReference[];
    providers: {
        web: DiscoveryProviderState;
        commons: DiscoveryProviderState;
    };
};
