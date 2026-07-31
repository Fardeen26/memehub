'use client';

import { useState } from 'react';
import { Check, RotateCcw, Type } from 'lucide-react';
import {
    TEXT_STYLE_PRESETS,
    type TextStylePresetId,
} from '@/lib/textStylePresets';

type TextStylePanelProps = {
    activeTextIndex: number;
    textCount: number;
    onApplyPreset: (presetId: TextStylePresetId, index: number) => void;
    onResetStyle: (index: number) => void;
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
    onApplyPreset,
    onResetStyle,
}: TextStylePanelProps) {
    const [announcement, setAnnouncement] = useState<string | null>(null);
    const hasSelectedText =
        activeTextIndex >= 0 && activeTextIndex < textCount;

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
                <p className="text-xs font-semibold text-white">
                    One-tap text styles
                </p>
                <button
                    type="button"
                    aria-label="Reset text style"
                    disabled={!hasSelectedText}
                    onClick={() => {
                        if (!hasSelectedText) return;
                        onResetStyle(activeTextIndex);
                        setAnnouncement('Text style reset to normal');
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-white/12 bg-white/5 px-2 py-1 text-[10px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white/5"
                >
                    <RotateCcw className="h-3 w-3" />
                    Reset style
                </button>
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
                            disabled={!hasSelectedText}
                            onClick={() => {
                                if (!hasSelectedText) return;
                                onApplyPreset(preset.id, activeTextIndex);
                                setAnnouncement(
                                    `${displayLabel} applied to the selected text`
                                );
                            }}
                            className="group min-h-24 overflow-hidden rounded-lg border border-white/12 bg-black/30 text-left transition-all hover:-translate-y-0.5 hover:border-[#7f8ff0]/70 hover:bg-[#6a7bd1]/10 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:border-white/12 disabled:hover:bg-black/30"
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
                {announcement ?? (!hasSelectedText ? 'Select a text box to apply a style.' : null)}
            </p>
        </div>
    );
}
