import type { Template } from "@/types/template";
import type { OptimizedMemeTemplate } from "@/data/templates";

export function normalizeTemplateName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function curatedToEditorTemplates(
    templates: Record<string, OptimizedMemeTemplate>
): Record<string, Template> {
    return Object.fromEntries(
        Object.entries(templates).map(([key, template]) => [
            key,
            {
                image: template.image || template.originalUrl,
                textBoxes: template.textBoxes,
                displayName: key.replace(/-/g, " "),
            },
        ])
    );
}

export function mergeCuratedAndTrending(
    curated: Record<string, Template>,
    trending: Record<string, Template>
): Record<string, Template> {
    const curatedNames = new Set(
        Object.entries(curated).map(([key, template]) =>
            normalizeTemplateName(template.displayName || key)
        )
    );

    const dedupedTrending = Object.fromEntries(
        Object.entries(trending).filter(([, template]) => {
            const trendingName = normalizeTemplateName(template.displayName || "");
            if (!trendingName) return true;

            for (const curatedName of curatedNames) {
                if (
                    curatedName === trendingName ||
                    curatedName.includes(trendingName) ||
                    trendingName.includes(curatedName)
                ) {
                    return false;
                }
            }

            return true;
        })
    );

    return { ...dedupedTrending, ...curated };
}
