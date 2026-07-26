'use client';

import { useRef } from 'react';
import {
    ArrowDown,
    ArrowUp,
    Copy,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Lock,
    ExternalLink,
    Shapes,
    Trash2,
    Type,
} from 'lucide-react';
import type {
    ImageOverlay,
    ImageSourceAttribution,
    ShapeOverlay,
    TextSettings,
} from '@/types/editor';
import {
    canMoveTextLayerWithinGroup,
    isLayerVisible,
} from '@/lib/layerOperations';

type TextLayer = {
    id: string;
    text: string;
    settings: TextSettings;
};

type CreatorLayersPanelProps = {
    texts: TextLayer[];
    images: ImageOverlay[];
    shapes: ShapeOverlay[];
    selectedTextIndex: number;
    selectedImageIndex: number;
    selectedShapeIndex: number;
    originalTextCount: number;
    backgroundLabel?: string;
    backgroundSource?: ImageSourceAttribution;
    onSelectText: (index: number) => void;
    onSelectImage: (index: number) => void;
    onSelectShape: (index: number) => void;
    onToggleText: (index: number) => void;
    onToggleImage: (index: number) => void;
    onToggleShape: (index: number) => void;
    onDuplicateText: (index: number) => void;
    onDuplicateImage: (index: number) => void;
    onDuplicateShape: (index: number) => void;
    onMoveText: (index: number, direction: 'forward' | 'backward') => void;
    onMoveImage: (index: number, direction: 'forward' | 'backward') => void;
    onMoveShape: (index: number, direction: 'forward' | 'backward') => void;
    onDeleteText: (index: number) => void;
    onDeleteImage: (index: number) => void;
    onDeleteShape: (index: number) => void;
};

type LayerRowProps = {
    active: boolean;
    layerId?: string;
    icon: typeof Type;
    label: string;
    detail: string;
    visible: boolean;
    onSelect: () => void;
    onToggle: () => void;
    onDuplicate: () => void;
    onDelete?: () => void;
    onMoveBackward?: () => void;
    onMoveForward?: () => void;
    canMoveBackward?: boolean;
    canMoveForward?: boolean;
    duplicateDisabled?: boolean;
};

function ActionButton({
    label,
    disabled = false,
    onClick,
    buttonRef,
    children,
}: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    buttonRef?: React.RefObject<HTMLButtonElement | null>;
    children: React.ReactNode;
}) {
    return (
        <button
            ref={buttonRef}
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className="rounded-md p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
        >
            {children}
        </button>
    );
}

function LayerRow({
    active,
    layerId,
    icon: Icon,
    label,
    detail,
    visible,
    onSelect,
    onToggle,
    onDuplicate,
    onDelete,
    onMoveBackward,
    onMoveForward,
    canMoveBackward = false,
    canMoveForward = false,
    duplicateDisabled = false,
}: LayerRowProps) {
    const moveBackwardRef = useRef<HTMLButtonElement>(null);
    const moveForwardRef = useRef<HTMLButtonElement>(null);
    const keepMoveFocusOnLayer = (
        preferred: React.RefObject<HTMLButtonElement | null>,
        fallback: React.RefObject<HTMLButtonElement | null>
    ) => {
        const focusAfterRender = () => {
            const target =
                preferred.current && !preferred.current.disabled
                    ? preferred.current
                    : fallback.current && !fallback.current.disabled
                      ? fallback.current
                      : null;
            target?.focus();
        };

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(focusAfterRender);
        } else {
            window.setTimeout(focusAfterRender, 0);
        }
    };

    return (
        <div
            data-layer-id={layerId}
            className={`rounded-lg border transition-colors ${
                active
                    ? 'border-[#7f8ff0] bg-[#6a7bd1]/15'
                    : 'border-white/10 bg-black/25 hover:border-white/20'
            } ${visible ? '' : 'opacity-55'}`}
        >
            <div className="flex items-center gap-1 p-1.5">
                <button
                    type="button"
                    aria-pressed={active}
                    onClick={onSelect}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-white/5"
                >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/8">
                        <Icon className="h-4 w-4 text-white/65" />
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-white/90">
                            {label}
                        </span>
                        <span className="block truncate text-[10px] text-white/40">
                            {detail}
                        </span>
                    </span>
                </button>

                <ActionButton
                    label={`${visible ? 'Hide' : 'Show'} ${label}`}
                    onClick={onToggle}
                >
                    {visible ? (
                        <Eye className="h-3.5 w-3.5" />
                    ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                    )}
                </ActionButton>
                <ActionButton
                    label={`Duplicate ${label}`}
                    disabled={duplicateDisabled}
                    onClick={onDuplicate}
                >
                    <Copy className="h-3.5 w-3.5" />
                </ActionButton>
                {onMoveBackward && (
                    <ActionButton
                        label={`Send ${label} backward`}
                        disabled={!canMoveBackward}
                        buttonRef={moveBackwardRef}
                        onClick={() => {
                            onMoveBackward();
                            keepMoveFocusOnLayer(
                                moveBackwardRef,
                                moveForwardRef
                            );
                        }}
                    >
                        <ArrowDown className="h-3.5 w-3.5" />
                    </ActionButton>
                )}
                {onMoveForward && (
                    <ActionButton
                        label={`Bring ${label} forward`}
                        disabled={!canMoveForward}
                        buttonRef={moveForwardRef}
                        onClick={() => {
                            onMoveForward();
                            keepMoveFocusOnLayer(
                                moveForwardRef,
                                moveBackwardRef
                            );
                        }}
                    >
                        <ArrowUp className="h-3.5 w-3.5" />
                    </ActionButton>
                )}
                {onDelete && (
                    <ActionButton label={`Delete ${label}`} onClick={onDelete}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </ActionButton>
                )}
            </div>
        </div>
    );
}

export default function CreatorLayersPanel({
    texts,
    images,
    shapes,
    selectedTextIndex,
    selectedImageIndex,
    selectedShapeIndex,
    originalTextCount,
    backgroundLabel,
    backgroundSource,
    onSelectText,
    onSelectImage,
    onSelectShape,
    onToggleText,
    onToggleImage,
    onToggleShape,
    onDuplicateText,
    onDuplicateImage,
    onDuplicateShape,
    onMoveText,
    onMoveImage,
    onMoveShape,
    onDeleteText,
    onDeleteImage,
    onDeleteShape,
}: CreatorLayersPanelProps) {
    const totalLayers = 1 + texts.length + images.length + shapes.length;
    const backgroundCredit =
        backgroundSource?.creditLine?.trim() ||
        backgroundSource?.creator;
    const backgroundRightsUnknown = backgroundSource?.rights === 'unknown';

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-white">Layer stack</p>
                    <p className="text-[10px] leading-relaxed text-white/45">
                        Hide, copy, and arrange without deleting your work.
                    </p>
                </div>
                <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-white/55">
                    {totalLayers} layers
                </span>
            </div>

            <div className="space-y-1.5">
                {[...texts].reverse().map((layer, reverseIndex) => {
                    const index = texts.length - reverseIndex - 1;
                    const isTemplateText = index < originalTextCount;
                    const label =
                        isTemplateText
                            ? `Text ${index + 1}`
                            : `Custom text ${index - originalTextCount + 1}`;
                    const detail = layer.text.trim() || 'Empty text layer';

                    return (
                        <LayerRow
                            key={layer.id}
                            active={selectedTextIndex === index}
                            layerId={layer.id}
                            icon={Type}
                            label={label}
                            detail={detail}
                            visible={isLayerVisible(layer.settings)}
                            onSelect={() => onSelectText(index)}
                            onToggle={() => onToggleText(index)}
                            onDuplicate={() => onDuplicateText(index)}
                            onMoveBackward={() =>
                                onMoveText(index, 'backward')
                            }
                            onMoveForward={() =>
                                onMoveText(index, 'forward')
                            }
                            canMoveBackward={canMoveTextLayerWithinGroup(
                                index,
                                'backward',
                                texts.length,
                                originalTextCount
                            )}
                            canMoveForward={canMoveTextLayerWithinGroup(
                                index,
                                'forward',
                                texts.length,
                                originalTextCount
                            )}
                            onDelete={
                                !isTemplateText
                                    ? () => onDeleteText(index)
                                    : undefined
                            }
                        />
                    );
                })}

                {[...shapes].reverse().map((shape, reverseIndex) => {
                    const index = shapes.length - reverseIndex - 1;
                    const label = `${shape.type
                        .split('-')
                        .map((part) => part[0].toUpperCase() + part.slice(1))
                        .join(' ')} ${index + 1}`;
                    return (
                        <LayerRow
                            key={shape.id}
                            active={selectedShapeIndex === index}
                            icon={Shapes}
                            label={label}
                            detail="Shape layer"
                            visible={isLayerVisible(shape)}
                            onSelect={() => onSelectShape(index)}
                            onToggle={() => onToggleShape(index)}
                            onDuplicate={() => onDuplicateShape(index)}
                            onMoveBackward={() => onMoveShape(index, 'backward')}
                            onMoveForward={() => onMoveShape(index, 'forward')}
                            canMoveBackward={index > 0}
                            canMoveForward={index < shapes.length - 1}
                            onDelete={() => onDeleteShape(index)}
                        />
                    );
                })}

                {[...images].reverse().map((image, reverseIndex) => {
                    const index = images.length - reverseIndex - 1;
                    const label = image.label || `Image ${index + 1}`;
                    return (
                        <LayerRow
                            key={image.id}
                            active={selectedImageIndex === index}
                            icon={ImageIcon}
                            label={label}
                            detail={
                                image.animated || image.animationDecodePending
                                    ? 'Animated media'
                                    : `${Math.round(image.width)} × ${Math.round(image.height)} px`
                            }
                            visible={isLayerVisible(image)}
                            onSelect={() => onSelectImage(index)}
                            onToggle={() => onToggleImage(index)}
                            onDuplicate={() => onDuplicateImage(index)}
                            duplicateDisabled={Boolean(
                                image.animated || image.animationDecodePending
                            )}
                            onMoveBackward={() => onMoveImage(index, 'backward')}
                            onMoveForward={() => onMoveImage(index, 'forward')}
                            canMoveBackward={index > 0}
                            canMoveForward={index < images.length - 1}
                            onDelete={() => onDeleteImage(index)}
                        />
                    );
                })}

                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2.5 text-white/45">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5">
                        <ImageIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <span className="block text-xs font-medium text-white/65">
                            Background
                        </span>
                        <span className="block text-[10px]">
                            {backgroundLabel || 'Base template'}
                        </span>
                        {backgroundSource && (
                            <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[9px] text-white/45">
                                <span
                                    className={`rounded-full border px-1.5 py-0.5 ${
                                        backgroundRightsUnknown
                                            ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                                            : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                                    }`}
                                >
                                    {backgroundSource.licenseName}
                                </span>
                                <span>{backgroundCredit}</span>
                                <a
                                    href={backgroundSource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Open background image source"
                                    className="inline-flex items-center gap-0.5 text-[#aeb8ff] hover:text-white"
                                >
                                    Details
                                    <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                            </span>
                        )}
                        {backgroundSource &&
                            (backgroundSource.usageTerms ||
                                backgroundSource.restrictions) && (
                                <details
                                    open={backgroundRightsUnknown}
                                    className="mt-1 text-[9px] text-white/45"
                                >
                                    <summary className="cursor-pointer text-[#aeb8ff]">
                                        {backgroundRightsUnknown
                                            ? 'Rights warning'
                                            : 'Usage notes'}
                                    </summary>
                                    <div className="mt-1 space-y-1 leading-relaxed">
                                        {backgroundSource.usageTerms && (
                                            <p>
                                                <span>Terms: </span>
                                                <span>
                                                    {
                                                        backgroundSource.usageTerms
                                                    }
                                                </span>
                                            </p>
                                        )}
                                        {backgroundSource.restrictions && (
                                            <p>
                                                <span>Restrictions: </span>
                                                <span>
                                                    {
                                                        backgroundSource.restrictions
                                                    }
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </details>
                            )}
                    </div>
                    <Lock className="h-3.5 w-3.5" aria-label="Background locked" />
                </div>
            </div>

            <p className="text-[10px] leading-relaxed text-white/35">
                Text renders above shapes, and shapes above media. Arrow controls
                change order inside each group.
            </p>
        </div>
    );
}
