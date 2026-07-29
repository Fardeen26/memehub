import type { GifDecodePolicy } from '@/lib/gifAnimation';
import { Template } from "./template";

export type MemeEditorProps = {
    template: Template;
    onReset: () => void;
};

export type TextSettings = {
    /** Hidden layers stay in the project and can be revealed from the layer panel. */
    visible?: boolean;
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight: string;
    letterSpacing: number;
    textCase: 'uppercase' | 'lowercase' | 'normal';
    backgroundColor: string;
    backgroundRadius: number;
    outline: {
        width: number;
        color: string;
    };
    shadow: {
        blur: number;
        offsetX: number;
        offsetY: number;
        color: string;
    };
};

export type EraseStroke = {
    points: { x: number; y: number }[];
    size: number;
    opacity: number;
};

export type ImageSourceAttribution = {
    provider: 'Wikimedia Commons' | 'SearXNG';
    url: string;
    creator: string;
    creditLine?: string;
    licenseName: string;
    licenseUrl?: string;
    rights: 'editable' | 'attribution' | 'share-alike' | 'unknown';
    attributionRequired?: boolean;
    usageTerms?: string;
    restrictions?: string;
};

export type ImageOverlay = {
    id: string;
    src: string;
    label?: string;
    /** Missing means visible for backward compatibility with existing drafts. */
    visible?: boolean;
    /** Animated GIF overlays are decoded into a ref/cache outside React state. */
    animated?: boolean;
    /** Original GIF source retained while a deferred decode shows a still preview. */
    animatedSrc?: string;
    /** Persisted safety policy used again if an animation is decoded after recovery. */
    animationDecodePolicy?: GifDecodePolicy;
    /** True while an intended animated GIF is decoding in the background. */
    animationDecodePending?: boolean;
    mimeType?: string;
    /** Original file page and license retained through draft recovery. */
    source?: ImageSourceAttribution;
    animationStartMs?: number;
    x: number;
    y: number;
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    opacity: number;
    rotation: number;
    eraseStrokes: EraseStroke[];
};

export type ShapeType =
    | 'rectangle'
    | 'ellipse'
    | 'arrow'
    | 'line'
    | 'triangle'
    | 'star'
    | 'speech-bubble';

export type ShapeOverlay = {
    id: string;
    type: ShapeType;
    /** Missing means visible for backward compatibility with existing drafts. */
    visible?: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    filled: boolean;
    opacity: number;
};

