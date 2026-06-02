export type ImgflipMeme = {
    id: string;
    name: string;
    url: string;
    width: number;
    height: number;
    box_count: number;
    captions: number;
};

export type ImgflipMemesResponse = {
    success: boolean;
    data: {
        memes: ImgflipMeme[];
    };
};

export type TrendingTemplatesResponse = {
    success: boolean;
    templates: Record<string, import("@/types/template").Template>;
    fetchedAt: string;
    error?: string;
};
