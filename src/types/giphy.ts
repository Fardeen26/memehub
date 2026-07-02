export type GiphyImageRendition = {
    url: string;
    width: string;
    height: string;
};

export type GiphyItem = {
    id: string;
    title: string;
    images: {
        fixed_width?: GiphyImageRendition;
        fixed_width_small?: GiphyImageRendition;
        fixed_width_still?: GiphyImageRendition;
        fixed_width_small_still?: GiphyImageRendition;
        fixed_height?: GiphyImageRendition;
        fixed_height_small?: GiphyImageRendition;
        fixed_height_still?: GiphyImageRendition;
        fixed_height_small_still?: GiphyImageRendition;
        downsized?: GiphyImageRendition;
        downsized_still?: GiphyImageRendition;
        original?: GiphyImageRendition;
        original_still?: GiphyImageRendition;
    };
};

export type GiphySearchResponse = {
    data: GiphyItem[];
    pagination: {
        total_count: number;
        count: number;
        offset: number;
    };
    meta?: { status: number; msg: string };
};

export type GiphyMediaItem = {
    id: string;
    mediaType: 'gif' | 'sticker';
    title: string;
    previewUrl: string;
    url: string;
    width: number;
    height: number;
    animated: boolean;
    mimeHint: string;
    stillUrl?: string;
};
