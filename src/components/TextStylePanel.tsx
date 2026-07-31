'use client';

import { useState } from 'react';
import { Check, Type } from 'lucide-react';
import {
    TEXT_STYLE_PRESETS,
    type TextStylePresetId,
} from '@/lib/textStylePresets';

type TextStylePanelProps = {
    activeTextIndex: number;
    textCount: number;
    onSelectText: (index: number) => void;
    onApplyPreset: (presetId: TextStylePresetId, index: number) => void;
};

const PREVIEW_CLASS: Record<TextStylePresetId, string> = {
    'black-bar': 'bg-black px-2 py-1 font-black text-white',
    'meme-outline': 'font-black uppercase text-white [-webkit-text-stroke:2px_#000] [text-shadow:2px_2px_0_#000]',
    reaction:
        'font-black uppercase tracking-wide text-[#ffd400] [-webkit-text-stroke:1px_#000]',
};

const PREVIEW_COPY: Record<TextStylePresetId, string> = {
    'black-bar': 'Say less.',
    'meme-outline': 'NO WAY',
    reaction: 'SERIOUSLY?',
};

export default function TextStylePanel({
    activeTextIndex,
    textCount,
    onSelectText,
    onApplyPreset,
}: TextStylePanelProps) {
    const [announcement, setAnnouncement] = useState<string | null>(null);
    const safeIndex =
        textCount === 0
            ? -1
            : Math.max(0, Math.min(activeTextIndex, textCount - 1));

    if (textCount === 0) {
        return (
            <div className="rounded-lg border border-dashed border-white/15 bg-black/20 px-4 py-6 text-center">
                <Type className="mx-auto mb-2 h-5 w-5 text-white/35" />
                <p className="text-xs font-medium text-white/75">
                    Add a text layer to use one-tap styles
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-white">
                        One-tap text styles
                    </p>
                    <p className="text-[10px] text-white/45">
                        Apply to Text {safeIndex + 1}; font size stays unchanged.
                    </p>
                </div>
                {textCount > 1 && (
                    <div
                        className="flex max-w-[55%] gap-1 overflow-x-auto"
                        aria-label="Choose text layer"
                    >
                        {Array.from({ length: textCount }, (_, index) => (
                            <button
                                key={index}
                                type="button"
                                aria-pressed={safeIndex === index}
                                onClick={() => onSelectText(index)}
                                className={`shrink-0 rounded-md px-2 py-1 text-[10px] transition-colors ${
                                    safeIndex === index
                                        ? 'bg-[#6a7bd1] text-white'
                                        : 'bg-white/8 text-white/55 hover:bg-white/15'
                                }`}
                            >
                                Text {index + 1}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {TEXT_STYLE_PRESETS.map((preset) => {
                    const displayLabel = preset.label;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            aria-label={`Apply ${displayLabel} style`}
                            title={preset.description}
                            onClick={() => {
                                onApplyPreset(preset.id, safeIndex);
                                setAnnouncement(
                                    `${displayLabel} applied to Text ${safeIndex + 1}`
                                );
                            }}
                            className="group min-h-24 overflow-hidden rounded-lg border border-white/12 bg-black/30 text-left transition-all hover:-translate-y-0.5 hover:border-[#7f8ff0]/70 hover:bg-[#6a7bd1]/10"
                        >
                            <span className="flex h-14 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#36394f,#181923_72%)] px-2 text-center">
                                <span
                                    className={`line-clamp-2 text-sm ${PREVIEW_CLASS[preset.id]}`}
                                >
                                    {PREVIEW_COPY[preset.id]}
                                </span>
                            </span>
                            <span className="flex items-center justify-between gap-1 px-2 py-1.5">
                                <span className="truncate text-[10px] font-medium text-white/75">
                                    {displayLabel}
                                </span>
                                <Check className="h-3 w-3 shrink-0 text-[#91a0ff] opacity-0 transition-opacity group-hover:opacity-100" />
                            </span>
                        </button>
                    );
                })}
            </div>

            <p
                aria-live="polite"
                className="min-h-4 text-[10px] text-[#aeb8ff]"
            >
                {announcement}
            </p>
        </div>
    );
}
