export type GiphyImageRendition = {
    url: string;
    width: string;
    height: string;
};

export type GiphyItem = {
    id: string;
    title: string;
    images: {
        fixed_height?: GiphyImageRendition;
        fixed_height_small?: GiphyImageRendition;
        downsized?: GiphyImageRendition;
        original?: GiphyImageRendition;
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
    title: string;
    previewUrl: string;
    url: string;
    width: number;
    height: number;
};
