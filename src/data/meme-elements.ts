import type { ShapeType } from '@/types/editor';

export type MemeShapeOption = {
    type: ShapeType;
    label: string;
    icon: string;
};

/** Editor drawing tools only — not third-party meme assets. */
export const MEME_SHAPES: MemeShapeOption[] = [
    { type: 'rectangle', label: 'Rectangle', icon: '▭' },
    { type: 'ellipse', label: 'Circle', icon: '○' },
    { type: 'arrow', label: 'Arrow', icon: '→' },
    { type: 'line', label: 'Line', icon: '—' },
    { type: 'triangle', label: 'Triangle', icon: '△' },
    { type: 'star', label: 'Star', icon: '★' },
    { type: 'speech-bubble', label: 'Bubble', icon: '◉' },
];

/** Quick-search chips → Giphy queries (real catalog content). */
export const GIPHY_STICKER_QUERIES = [
    'reaction meme',
    'funny sticker',
    'savage',
    'anime reaction',
    'cat meme',
    'brainrot',
    'sigma',
    'skull reaction',
];

export const GIPHY_GIF_QUERIES = [
    'meme reaction',
    'funny gif',
    'cringe',
    'dramatic',
    'facepalm',
    'celebration',
    'awkward',
    'viral meme',
];
