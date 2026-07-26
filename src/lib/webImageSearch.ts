export type WebSearchConfidence = 'low' | 'medium' | 'high';

export interface WebSearchCandidate {
    id: string;
    title: string;
    /** Full-resolution image rendition used when the creator adds it to canvas. */
    assetUrl: string;
    previewUrl: string;
    sourceUrl: string;
    sourceDomain: string;
    width: number;
    height: number;
    kind: 'web' | 'news';
    publishedAt?: string;
    confidence?: WebSearchConfidence;
}

export interface WebImageSearchResult {
    candidates: WebSearchCandidate[];
    degradedEndpoints: string[];
}
