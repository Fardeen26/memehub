import { generateTextBoxes } from "@/lib/generateTextBoxes";
import type { Template } from "@/types/template";
import type { ImgflipMemesResponse } from "@/types/imgflip";

export const IMGFLIP_MEMES_URL = "https://api.imgflip.com/get_memes";

export function toTemplateKey(id: string): string {
    return `imgflip-${id}`;
}

export function transformImgflipMemes(
    memes: ImgflipMemesResponse["data"]["memes"]
): Record<string, Template> {
    return Object.fromEntries(
        memes
            .filter(
                (meme) =>
                    Boolean(meme.url) &&
                    Number.isFinite(meme.width) &&
                    meme.width > 0 &&
                    Number.isFinite(meme.height) &&
                    meme.height > 0
            )
            .map((meme) => [
                toTemplateKey(meme.id),
                {
                    image: meme.url,
                    textBoxes: generateTextBoxes(
                        meme.width,
                        meme.height,
                        meme.box_count ?? 2
                    ),
                    displayName: meme.name,
                },
            ])
    );
}

export async function fetchTrendingTemplatesFromImgflip(): Promise<
    Record<string, Template>
> {
    const response = await fetch(IMGFLIP_MEMES_URL, {
        headers: {
            Accept: "application/json",
        },
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw new Error(`Imgflip request failed with status ${response.status}`);
    }

    const data: ImgflipMemesResponse = await response.json();

    if (!data.success || !Array.isArray(data.data?.memes) || data.data.memes.length === 0) {
        throw new Error("Imgflip returned an invalid meme list");
    }

    return transformImgflipMemes(data.data.memes);
}
