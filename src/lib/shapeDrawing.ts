import type { ShapeOverlay, ShapeType } from '@/types/editor';

function withShapeTransform(
    ctx: CanvasRenderingContext2D,
    shape: ShapeOverlay,
    draw: () => void
): void {
    const centerX = shape.x + shape.width / 2;
    const centerY = shape.y + shape.height / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    if (shape.rotation !== 0) {
        ctx.rotate((shape.rotation * Math.PI) / 180);
    }
    ctx.translate(-centerX, -centerY);
    draw();
    ctx.restore();
}

function drawArrowPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
): void {
    const shaftH = height * 0.35;
    const shaftY = y + (height - shaftH) / 2;
    const headW = width * 0.4;
    const shaftW = width - headW;

    ctx.beginPath();
    ctx.rect(x, shaftY, shaftW, shaftH);
    ctx.moveTo(x + shaftW, y);
    ctx.lineTo(x + width, y + height / 2);
    ctx.lineTo(x + shaftW, y + height);
    ctx.closePath();
}

function drawStarPath(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    outerR: number,
    innerR: number,
    points = 5
): void {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const radius = i % 2 === 0 ? outerR : innerR;
        const angle = (Math.PI / points) * i - Math.PI / 2;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawSpeechBubble(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
): void {
    const bodyH = height * 0.78;
    const tailW = width * 0.2;
    const r = Math.min(12, width * 0.08, bodyH * 0.15);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + bodyH - r);
    ctx.quadraticCurveTo(x + width, y + bodyH, x + width - r, y + bodyH);
    ctx.lineTo(x + width * 0.35 + tailW, y + bodyH);
    ctx.lineTo(x + width * 0.2, y + height);
    ctx.lineTo(x + width * 0.28, y + bodyH);
    ctx.lineTo(x + r, y + bodyH);
    ctx.quadraticCurveTo(x, y + bodyH, x, y + bodyH - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function traceShape(
    ctx: CanvasRenderingContext2D,
    type: ShapeType,
    x: number,
    y: number,
    width: number,
    height: number
): void {
    switch (type) {
        case 'rectangle':
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            break;
        case 'ellipse':
            ctx.beginPath();
            ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
            break;
        case 'triangle':
            ctx.beginPath();
            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(x + width, y + height);
            ctx.lineTo(x, y + height);
            ctx.closePath();
            break;
        case 'arrow':
            drawArrowPath(ctx, x, y, width, height);
            break;
        case 'line':
            ctx.beginPath();
            ctx.moveTo(x, y + height / 2);
            ctx.lineTo(x + width, y + height / 2);
            break;
        case 'star':
            drawStarPath(ctx, x + width / 2, y + height / 2, width / 2, width / 4);
            break;
        case 'speech-bubble':
            drawSpeechBubble(ctx, x, y, width, height);
            break;
        default:
            ctx.beginPath();
            ctx.rect(x, y, width, height);
    }
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: ShapeOverlay): void {
    withShapeTransform(ctx, shape, () => {
        const { x, y, width, height, type, strokeColor, fillColor, strokeWidth, filled, opacity } =
            shape;

        ctx.save();
        ctx.globalAlpha = opacity;
        traceShape(ctx, type, x, y, width, height);

        if (type !== 'line' && filled) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        if (strokeWidth > 0) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            if (type === 'line') {
                ctx.lineCap = 'round';
            }
            ctx.stroke();
        }

        ctx.restore();
    });
}

export const SHAPE_DEFAULTS: Record<
    ShapeType,
    { width: number; height: number; filled: boolean; strokeWidth: number }
> = {
    rectangle: { width: 160, height: 100, filled: false, strokeWidth: 6 },
    ellipse: { width: 140, height: 140, filled: false, strokeWidth: 6 },
    triangle: { width: 140, height: 120, filled: false, strokeWidth: 6 },
    arrow: { width: 180, height: 80, filled: true, strokeWidth: 4 },
    line: { width: 200, height: 20, filled: false, strokeWidth: 8 },
    star: { width: 120, height: 120, filled: true, strokeWidth: 4 },
    'speech-bubble': { width: 200, height: 140, filled: true, strokeWidth: 4 },
};
