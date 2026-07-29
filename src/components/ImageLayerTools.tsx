'use client';

import {
    Eraser,
    ExternalLink,
    Maximize2,
    Minimize2,
    RotateCw,
    ShieldCheck,
    TriangleAlert,
    Trash2,
    Undo2,
} from 'lucide-react';
import type { ImageOverlay } from '@/types/editor';

type ImageLayerToolsProps = {
    image: ImageOverlay;
    eraseMode: boolean;
    eraseBrushSize: number;
    eraseBrushOpacity: number;
    onOpacityChange: (opacity: number) => void;
    onRotate90: () => void;
    onFit: () => void;
    onFill: () => void;
    onToggleErase: () => void;
    onEraseBrushSizeChange: (size: number) => void;
    onEraseBrushOpacityChange: (opacity: number) => void;
    onUndoErase: () => void;
    onClearErase: () => void;
};

function ToolButton({
    label,
    active = false,
    disabled = false,
    onClick,
    children,
}: {
    label: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={`flex min-h-9 items-center justify-center gap-1 rounded-md border px-2 text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                active
                    ? 'border-[#7f8ff0] bg-[#6a7bd1] text-white'
                    : 'border-white/12 bg-black/25 text-white/65 hover:bg-white/8 hover:text-white'
            }`}
        >
            {children}
        </button>
    );
}

export default function ImageLayerTools({
    image,
    eraseMode,
    eraseBrushSize,
    eraseBrushOpacity,
    onOpacityChange,
    onRotate90,
    onFit,
    onFill,
    onToggleErase,
    onEraseBrushSizeChange,
    onEraseBrushOpacityChange,
    onUndoErase,
    onClearErase,
}: ImageLayerToolsProps) {
    const hasEraseHistory = image.eraseStrokes.length > 0;
    const sourceRightsUnknown = image.source?.rights === 'unknown';

    return (
        <section className="space-y-3 rounded-lg border border-[#6a7bd1]/25 bg-[#6a7bd1]/8 p-3">
            <div>
                <p className="truncate text-xs font-semibold text-white">
                    Edit {image.label || 'selected image'}
                </p>
                <p className="text-[10px] text-white/40">
                    Fit, rotate, fade, or manually remove parts.
                </p>
            </div>

            {image.source && (
                <div className="rounded-lg border border-amber-400/20 bg-amber-400/8 p-2.5">
                    <div className="flex items-start gap-2">
                        {sourceRightsUnknown ? (
                            <span
                                role="img"
                                aria-label="Rights warning"
                                className="mt-0.5 shrink-0 text-amber-200"
                            >
                                <TriangleAlert
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5"
                                />
                            </span>
                        ) : (
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200" />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold text-amber-100">
                                {image.source.licenseName}
                            </p>
                            <p className="mt-0.5 truncate text-[9px] text-white/45">
                                {image.source.creator}
                            </p>
                            {image.source.creditLine &&
                                image.source.creditLine !==
                                    image.source.creator && (
                                    <p className="mt-1 text-[9px] leading-relaxed text-white/45">
                                        Credit: {image.source.creditLine}
                                    </p>
                                )}
                        </div>
                        <a
                            href={image.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open original media source"
                            className="rounded p-1 text-white/45 hover:bg-white/10 hover:text-white"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                    <p className="mt-1.5 text-[9px] leading-relaxed text-white/35">
                        {sourceRightsUnknown
                            ? 'Source and rights warning stay attached to this layer.'
                            : 'Source and license stay attached to this layer.'}
                    </p>
                    {sourceRightsUnknown && (
                        <p className="mt-1.5 rounded border border-amber-300/15 bg-black/15 px-2 py-1 text-[9px] leading-relaxed text-amber-100/75">
                            {image.source.usageTerms ||
                                'Check the original publisher before reuse.'}
                        </p>
                    )}
                    {image.source.restrictions && (
                        <p className="mt-1.5 rounded border border-amber-300/15 bg-black/15 px-2 py-1 text-[9px] leading-relaxed text-amber-100/75">
                            Other rights: {image.source.restrictions}
                        </p>
                    )}
                </div>
            )}

            <label className="block space-y-1 text-[10px] text-white/55">
                <span>Opacity: {Math.round(image.opacity * 100)}%</span>
                <input
                    type="range"
                    aria-label="Image opacity"
                    min="0"
                    max="100"
                    value={Math.round(image.opacity * 100)}
                    onChange={(event) =>
                        onOpacityChange(Number(event.target.value) / 100)
                    }
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#6a7bd1]"
                />
            </label>

            <div className="grid grid-cols-4 gap-1.5">
                <ToolButton label="Fit image inside canvas" onClick={onFit}>
                    <Minimize2 className="h-3.5 w-3.5" />
                    Fit
                </ToolButton>
                <ToolButton label="Fill canvas with image" onClick={onFill}>
                    <Maximize2 className="h-3.5 w-3.5" />
                    Fill
                </ToolButton>
                <ToolButton label="Rotate image 90 degrees" onClick={onRotate90}>
                    <RotateCw className="h-3.5 w-3.5" />
                    90°
                </ToolButton>
                <ToolButton
                    label={eraseMode ? 'Finish manual erase' : 'Start manual erase'}
                    active={eraseMode}
                    disabled={image.visible === false}
                    onClick={onToggleErase}
                >
                    <Eraser className="h-3.5 w-3.5" />
                    Erase
                </ToolButton>
            </div>

            {eraseMode && (
                <div className="space-y-2 border-t border-white/10 pt-3">
                    <label className="block space-y-1 text-[10px] text-white/55">
                        <span>Brush size: {eraseBrushSize}px</span>
                        <input
                            type="range"
                            aria-label="Erase brush size"
                            min="5"
                            max="100"
                            value={eraseBrushSize}
                            onChange={(event) =>
                                onEraseBrushSizeChange(
                                    Number(event.target.value)
                                )
                            }
                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#6a7bd1]"
                        />
                    </label>
                    <label className="block space-y-1 text-[10px] text-white/55">
                        <span>
                            Brush opacity: {Math.round(eraseBrushOpacity * 100)}%
                        </span>
                        <input
                            type="range"
                            aria-label="Erase brush opacity"
                            min="10"
                            max="100"
                            step="10"
                            value={Math.round(eraseBrushOpacity * 100)}
                            onChange={(event) =>
                                onEraseBrushOpacityChange(
                                    Number(event.target.value) / 100
                                )
                            }
                            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-[#6a7bd1]"
                        />
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                        <ToolButton
                            label="Undo last erase stroke"
                            disabled={!hasEraseHistory}
                            onClick={onUndoErase}
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            Undo erase
                        </ToolButton>
                        <ToolButton
                            label="Clear all erase strokes"
                            disabled={!hasEraseHistory}
                            onClick={onClearErase}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Clear mask
                        </ToolButton>
                    </div>
                </div>
            )}
        </section>
    );
}
