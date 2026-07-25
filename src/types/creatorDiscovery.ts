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

export type DiscoveryProviderState =
    | 'live'
    | 'idle'
    | 'not-configured'
    | 'rate-limited'
    | 'unavailable';

export type CreatorDiscoveryResponse = {
    fetchedAt: string;
    query: string;
    region: 'IN';
    trends: IndiaTrendSignal[];
    reusableImages: ReusableImageAsset[];
    videos: CreatorSourceReference[];
    providers: {
        trends: DiscoveryProviderState;
        commons: DiscoveryProviderState;
        youtube: DiscoveryProviderState;
    };
};
