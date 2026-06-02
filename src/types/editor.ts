import { Template } from "./template";

export type MemeEditorProps = {
    template: Template;
    onReset: () => void;
};

export type TextSettings = {
    fontSize: number;
    color: string;
    fontFamily: string;
    fontWeight: string;
    letterSpacing: number;
    textCase: 'uppercase' | 'lowercase' | 'normal';
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

export type ImageOverlay = {
    id: string;
    src: string;
    label?: string;
    /** GIF / animated SVG — canvas redraws each frame */
    animated?: boolean;
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

