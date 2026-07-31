import type { Template } from '@/types/template';

const blankCanvasSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="white" />
</svg>`;

export const blankCanvasTemplate: Template = {
    image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(blankCanvasSvg)}`,
    displayName: 'Blank canvas',
    textBoxes: [],
};
