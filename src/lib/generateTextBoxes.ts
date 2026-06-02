import type { TextBox } from "@/types/template";

export function generateTextBoxes(
    width: number,
    height: number,
    boxCount: number
): TextBox[] {
    const count = Math.max(1, boxCount ?? 2);
    const fontSize = Math.max(30, Math.min(width, height) * 0.08);
    const minFont = 20;
    const horizontalPadding = Math.max(20, width * 0.05);
    const boxWidth = Math.min(width * 0.9, width - 40);

    if (count === 1) {
        return [
            {
                x: horizontalPadding,
                y: Math.max(50, height * 0.4),
                width: boxWidth,
                height: Math.max(height * 0.2, 150),
                fontSize,
                minFont,
                align: "center",
            },
        ];
    }

    if (count === 2) {
        return [
            {
                x: horizontalPadding,
                y: Math.max(50, height * 0.1),
                width: boxWidth,
                height: Math.max(height * 0.2, 150),
                fontSize,
                minFont,
                align: "center",
            },
            {
                x: horizontalPadding,
                y: Math.max(height * 0.7, height - 200),
                width: boxWidth,
                height: Math.max(height * 0.2, 150),
                fontSize,
                minFont,
                align: "center",
            },
        ];
    }

    const gap = height * 0.02;
    const totalGap = gap * (count - 1);
    const boxHeight = Math.max((height - totalGap) / count, 80);

    return Array.from({ length: count }, (_, index) => ({
        x: horizontalPadding,
        y: index * (boxHeight + gap) + gap,
        width: boxWidth,
        height: boxHeight,
        fontSize: Math.max(24, fontSize * 0.85),
        minFont,
        align: "center" as const,
    }));
}
