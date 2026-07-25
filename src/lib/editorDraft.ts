import type {
    ImageOverlay,
    ImageSourceAttribution,
    ShapeOverlay,
    TextSettings,
} from '@/types/editor';
import type { Template } from '@/types/template';
import type { MemeDraftV1 } from './memeDraft';
import { MEME_DRAFT_SCHEMA_VERSION } from './memeDraft';
import type { CreatorBranding } from './creatorBranding';
import {
    hasMeaningfulReusableCredit,
    resolveReusableImageRights,
} from './reusableMediaRights';

export type DrawingStroke = {
    points: { x: number; y: number }[];
    color: string;
    size: number;
    eraser: boolean;
};

export type CanvasTemplate = Template & {
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    source: ImageSourceAttribution;
};

export type MemeEditorDraftState = {
    /** Immutable gallery template used to identify this draft. */
    template: Template;
    /** Optional creator-selected base image rendered in place of the gallery template. */
    canvasTemplate?: CanvasTemplate;
    texts: string[];
    textBoxes: Template['textBoxes'];
    textBoxRotations: number[];
    textSettings: TextSettings[];
    imageOverlays: ImageOverlay[];
    shapeOverlays: ShapeOverlay[];
    strokes: DrawingStroke[];
    branding?: CreatorBranding;
};

export function createEditorDraft(
    state: MemeEditorDraftState,
    updatedAt: number
): MemeDraftV1<MemeEditorDraftState> {
    return {
        schemaVersion: MEME_DRAFT_SCHEMA_VERSION,
        updatedAt,
        state,
    };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const MAX_TEXT_LAYERS = 1_000;
const MAX_OVERLAY_LAYERS = 1_000;
const MAX_DRAWING_STROKES = 5_000;
const MAX_ERASE_STROKES_PER_IMAGE = 1_000;
const MAX_POINTS_PER_STROKE = 10_000;
export const MAX_DRAFT_LOCAL_MEDIA_BYTES = 24 * 1024 * 1024;

const TEXT_ALIGNMENTS = ['center', 'left', 'right'] as const;
const TEXT_CASES = ['uppercase', 'lowercase', 'normal'] as const;
const SHAPE_TYPES = [
    'rectangle',
    'ellipse',
    'arrow',
    'line',
    'triangle',
    'star',
    'speech-bubble',
] as const;
const WATERMARK_POSITIONS = [
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
] as const;
const GIF_DECODE_POLICIES = ['giphy'] as const;
const IMAGE_SOURCE_RIGHTS = [
    'editable',
    'attribution',
    'share-alike',
] as const;
const MAX_SOURCE_TEXT_LENGTH = 1_000;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function isBoundedArray(
    value: unknown,
    maximumLength: number
): value is unknown[] {
    return Array.isArray(value) && value.length <= maximumLength;
}

function hasEveryArrayItem(
    values: unknown[],
    validator: (value: unknown) => boolean
): boolean {
    for (let index = 0; index < values.length; index += 1) {
        if (!(index in values) || !validator(values[index])) {
            return false;
        }
    }

    return true;
}

function isOneOf<T extends string>(
    value: unknown,
    supportedValues: readonly T[]
): value is T {
    return (
        typeof value === 'string' &&
        supportedValues.includes(value as T)
    );
}

function isOptionalString(value: unknown): value is string | undefined {
    return value === undefined || typeof value === 'string';
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
    return value === undefined || typeof value === 'boolean';
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
    return value === undefined || isFiniteNumber(value);
}

function isBoundedString(value: unknown, maximumLength: number): value is string {
    return typeof value === 'string' && value.length <= maximumLength;
}

function isHttpUrl(value: unknown): value is string {
    if (!isBoundedString(value, MAX_SOURCE_TEXT_LENGTH)) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

function isImageSourceAttribution(value: unknown): boolean {
    if (!isObjectRecord(value)) return false;
    const licenseName = value.licenseName;
    const rights = isBoundedString(licenseName, MAX_SOURCE_TEXT_LENGTH)
        ? resolveReusableImageRights(licenseName)
        : null;
    const creditLine =
        typeof value.creditLine === 'string'
            ? value.creditLine
            : typeof value.creator === 'string'
              ? value.creator
              : undefined;
    const requiresCredit =
        rights !== 'editable' || value.attributionRequired === true;
    return (
        value.provider === 'Wikimedia Commons' &&
        isHttpUrl(value.url) &&
        isBoundedString(value.creator, MAX_SOURCE_TEXT_LENGTH) &&
        value.creator.trim().length > 0 &&
        (value.creditLine === undefined ||
            isBoundedString(value.creditLine, MAX_SOURCE_TEXT_LENGTH)) &&
        rights !== null &&
        (value.licenseUrl === undefined || isHttpUrl(value.licenseUrl)) &&
        isOneOf(value.rights, IMAGE_SOURCE_RIGHTS) &&
        value.rights === rights &&
        (!requiresCredit || hasMeaningfulReusableCredit(creditLine)) &&
        (value.attributionRequired === undefined ||
            typeof value.attributionRequired === 'boolean') &&
        (value.usageTerms === undefined ||
            isBoundedString(value.usageTerms, MAX_SOURCE_TEXT_LENGTH)) &&
        (value.restrictions === undefined ||
            isBoundedString(value.restrictions, MAX_SOURCE_TEXT_LENGTH))
    );
}

function localSourceMime(value: string): string | null {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,/i.exec(value);
    return match?.[1]?.toLowerCase() ?? null;
}

function localMediaSourceBytes(value: unknown): number {
    if (typeof value !== 'string') return 0;
    const match = /^data:image\/[a-z0-9.+-]+;base64,/i.exec(value);
    if (!match) return 0;

    const payload = value.slice(match[0].length);
    const padding = payload.endsWith('==')
        ? 2
        : payload.endsWith('=')
          ? 1
          : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

export function getMemeEditorDraftLocalMediaBytes(
    state: MemeEditorDraftState
): number {
    let total = localMediaSourceBytes(state.template.image);
    total += localMediaSourceBytes(state.canvasTemplate?.image);

    for (const overlay of state.imageOverlays) {
        total += localMediaSourceBytes(overlay.src);
        total += localMediaSourceBytes(overlay.animatedSrc);
        if (total > MAX_DRAFT_LOCAL_MEDIA_BYTES) return total;
    }

    return total;
}

export function assertMemeEditorDraftLocalMediaCapacity(
    state: MemeEditorDraftState
): void {
    if (
        getMemeEditorDraftLocalMediaBytes(state) >
        MAX_DRAFT_LOCAL_MEDIA_BYTES
    ) {
        throw new Error(
            'This project has reached its saved-image limit. Remove an image before adding another.'
        );
    }
}

function isPoint(value: unknown): value is { x: number; y: number } {
    return (
        isObjectRecord(value) &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y)
    );
}

function isTextBox(value: unknown): value is Template['textBoxes'][number] {
    return (
        isObjectRecord(value) &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y) &&
        isFiniteNumber(value.width) &&
        isFiniteNumber(value.height) &&
        isFiniteNumber(value.fontSize) &&
        isFiniteNumber(value.minFont) &&
        isOneOf(value.align, TEXT_ALIGNMENTS) &&
        isOptionalString(value.id)
    );
}

function isTemplate(value: unknown): value is Template {
    return (
        isObjectRecord(value) &&
        typeof value.image === 'string' &&
        isOptionalString(value.displayName) &&
        isBoundedArray(value.textBoxes, MAX_TEXT_LAYERS) &&
        hasEveryArrayItem(value.textBoxes, isTextBox)
    );
}

function isCanvasTemplate(value: unknown): value is CanvasTemplate {
    if (!isObjectRecord(value) || !isTemplate(value)) return false;
    const candidate = value as Template & Record<string, unknown>;
    if (
        candidate.mimeType !== 'image/jpeg' &&
        candidate.mimeType !== 'image/png' &&
        candidate.mimeType !== 'image/webp'
    ) {
        return false;
    }

    return (
        localSourceMime(candidate.image) === candidate.mimeType &&
        isImageSourceAttribution(candidate.source)
    );
}

function isTextSettings(value: unknown): value is TextSettings {
    if (
        !isObjectRecord(value) ||
        !isObjectRecord(value.outline) ||
        !isObjectRecord(value.shadow)
    ) {
        return false;
    }

    return (
        isFiniteNumber(value.fontSize) &&
        isOptionalBoolean(value.visible) &&
        typeof value.color === 'string' &&
        typeof value.fontFamily === 'string' &&
        typeof value.fontWeight === 'string' &&
        isFiniteNumber(value.letterSpacing) &&
        isOneOf(value.textCase, TEXT_CASES) &&
        isFiniteNumber(value.outline.width) &&
        typeof value.outline.color === 'string' &&
        isFiniteNumber(value.shadow.blur) &&
        isFiniteNumber(value.shadow.offsetX) &&
        isFiniteNumber(value.shadow.offsetY) &&
        typeof value.shadow.color === 'string'
    );
}

function isEraseStroke(value: unknown): boolean {
    return (
        isObjectRecord(value) &&
        isBoundedArray(value.points, MAX_POINTS_PER_STROKE) &&
        hasEveryArrayItem(value.points, isPoint) &&
        isFiniteNumber(value.size) &&
        isFiniteNumber(value.opacity)
    );
}

function isImageOverlay(value: unknown): value is ImageOverlay {
    if (!isObjectRecord(value)) return false;
    const sourceIsValid =
        (value.source === undefined ||
            (isImageSourceAttribution(value.source) &&
                typeof value.src === 'string' &&
                localSourceMime(value.src) !== null &&
                localSourceMime(value.src) === value.mimeType &&
                value.animated !== true &&
                value.animatedSrc === undefined &&
                value.animationDecodePolicy === undefined &&
                value.animationDecodePending !== true &&
                value.animationStartMs === undefined));
    return (
        typeof value.id === 'string' &&
        typeof value.src === 'string' &&
        isOptionalString(value.label) &&
        isOptionalBoolean(value.visible) &&
        isOptionalBoolean(value.animated) &&
        isOptionalString(value.animatedSrc) &&
        (value.animationDecodePolicy === undefined ||
            isOneOf(value.animationDecodePolicy, GIF_DECODE_POLICIES)) &&
        isOptionalBoolean(value.animationDecodePending) &&
        isOptionalString(value.mimeType) &&
        sourceIsValid &&
        isOptionalFiniteNumber(value.animationStartMs) &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y) &&
        isFiniteNumber(value.width) &&
        isFiniteNumber(value.height) &&
        isFiniteNumber(value.originalWidth) &&
        isFiniteNumber(value.originalHeight) &&
        isFiniteNumber(value.opacity) &&
        isFiniteNumber(value.rotation) &&
        isBoundedArray(
            value.eraseStrokes,
            MAX_ERASE_STROKES_PER_IMAGE
        ) &&
        hasEveryArrayItem(value.eraseStrokes, isEraseStroke)
    );
}

function isShapeOverlay(value: unknown): value is ShapeOverlay {
    return (
        isObjectRecord(value) &&
        typeof value.id === 'string' &&
        isOneOf(value.type, SHAPE_TYPES) &&
        isOptionalBoolean(value.visible) &&
        isFiniteNumber(value.x) &&
        isFiniteNumber(value.y) &&
        isFiniteNumber(value.width) &&
        isFiniteNumber(value.height) &&
        isFiniteNumber(value.rotation) &&
        typeof value.strokeColor === 'string' &&
        typeof value.fillColor === 'string' &&
        isFiniteNumber(value.strokeWidth) &&
        typeof value.filled === 'boolean' &&
        isFiniteNumber(value.opacity)
    );
}

function isDrawingStroke(value: unknown): value is DrawingStroke {
    return (
        isObjectRecord(value) &&
        isBoundedArray(value.points, MAX_POINTS_PER_STROKE) &&
        hasEveryArrayItem(value.points, isPoint) &&
        typeof value.color === 'string' &&
        isFiniteNumber(value.size) &&
        typeof value.eraser === 'boolean'
    );
}

function isCreatorBranding(value: unknown): value is CreatorBranding {
    if (!isObjectRecord(value)) return false;

    const keys = Object.keys(value);

    return (
        keys.length === 3 &&
        keys.every((key) =>
            ['enabled', 'text', 'position'].includes(key)
        ) &&
        typeof value.enabled === 'boolean' &&
        typeof value.text === 'string' &&
        isOneOf(value.position, WATERMARK_POSITIONS)
    );
}

export function isMemeEditorDraftState(value: unknown): value is MemeEditorDraftState {
    if (!isObjectRecord(value) || !isTemplate(value.template)) return false;
    if (
        !isBoundedArray(value.texts, MAX_TEXT_LAYERS) ||
        !isBoundedArray(value.textBoxes, MAX_TEXT_LAYERS) ||
        !isBoundedArray(value.textBoxRotations, MAX_TEXT_LAYERS) ||
        !isBoundedArray(value.textSettings, MAX_TEXT_LAYERS) ||
        !isBoundedArray(value.imageOverlays, MAX_OVERLAY_LAYERS) ||
        !isBoundedArray(value.shapeOverlays, MAX_OVERLAY_LAYERS) ||
        !isBoundedArray(value.strokes, MAX_DRAWING_STROKES)
    ) {
        return false;
    }

    const textCount = value.texts.length;
    const validBranding =
        value.branding === undefined || isCreatorBranding(value.branding);
    const validCanvasTemplate =
        value.canvasTemplate === undefined ||
        isCanvasTemplate(value.canvasTemplate);
    const localMediaIsBounded =
        validCanvasTemplate &&
        hasEveryArrayItem(value.imageOverlays, isImageOverlay) &&
        getMemeEditorDraftLocalMediaBytes(
            value as unknown as MemeEditorDraftState
        ) <= MAX_DRAFT_LOCAL_MEDIA_BYTES;

    return (
        validBranding &&
        validCanvasTemplate &&
        localMediaIsBounded &&
        hasEveryArrayItem(value.texts, (text) => typeof text === 'string') &&
        hasEveryArrayItem(value.textBoxes, isTextBox) &&
        hasEveryArrayItem(value.textBoxRotations, isFiniteNumber) &&
        hasEveryArrayItem(value.textSettings, isTextSettings) &&
        hasEveryArrayItem(value.imageOverlays, isImageOverlay) &&
        hasEveryArrayItem(value.shapeOverlays, isShapeOverlay) &&
        hasEveryArrayItem(value.strokes, isDrawingStroke) &&
        value.textBoxes.length === textCount &&
        value.textBoxRotations.length === textCount &&
        value.textSettings.length === textCount
    );
}
