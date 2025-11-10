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

