export type TransformableBox = {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
};

export function isMobileCanvas(): boolean {
    if (typeof window === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );
}

export function getTransformableAtPosition(
    x: number,
    y: number,
    items: TransformableBox[]
): { index: number; handle: string } {
    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const isMobile = isMobileCanvas();
        const rotationHandleSize = isMobile ? 60 : 50;
        const rotationHandleX = item.x + item.width / 2;
        const rotationHandleY = item.y - 35;
        const distToRotationHandle = Math.hypot(x - rotationHandleX, y - rotationHandleY);
        if (distToRotationHandle <= rotationHandleSize / 2) {
            return { index: i, handle: 'rotate' };
        }

        const handleSize = 60;
        const handles = [
            { name: 'nw', x: item.x - handleSize / 2, y: item.y - handleSize / 2 },
            { name: 'ne', x: item.x + item.width - handleSize / 2, y: item.y - handleSize / 2 },
            { name: 'sw', x: item.x - handleSize / 2, y: item.y + item.height - handleSize / 2 },
            { name: 'se', x: item.x + item.width - handleSize / 2, y: item.y + item.height - handleSize / 2 },
            { name: 'n', x: item.x + item.width / 2 - handleSize / 2, y: item.y - handleSize / 2 },
            { name: 's', x: item.x + item.width / 2 - handleSize / 2, y: item.y + item.height - handleSize / 2 },
            { name: 'w', x: item.x - handleSize / 2, y: item.y + item.height / 2 - handleSize / 2 },
            { name: 'e', x: item.x + item.width - handleSize / 2, y: item.y + item.height / 2 - handleSize / 2 },
        ];

        for (const handle of handles) {
            if (
                x >= handle.x &&
                x <= handle.x + handleSize &&
                y >= handle.y &&
                y <= handle.y + handleSize
            ) {
                return { index: i, handle: handle.name };
            }
        }

        if (x >= item.x && x <= item.x + item.width && y >= item.y && y <= item.y + item.height) {
            return { index: i, handle: 'move' };
        }
    }
    return { index: -1, handle: '' };
}

export function drawTransformableSelection(
    ctx: CanvasRenderingContext2D,
    box: TransformableBox
): void {
    const isMobile = isMobileCanvas();
    const handleSize = 60;
    const rotationHandleSize = isMobile ? 60 : 50;

    const handles = [
        { x: box.x - handleSize / 2, y: box.y - handleSize / 2 },
        { x: box.x + box.width - handleSize / 2, y: box.y - handleSize / 2 },
        { x: box.x - handleSize / 2, y: box.y + box.height - handleSize / 2 },
        { x: box.x + box.width - handleSize / 2, y: box.y + box.height - handleSize / 2 },
        { x: box.x + box.width / 2 - handleSize / 2, y: box.y - handleSize / 2 },
        { x: box.x + box.width / 2 - handleSize / 2, y: box.y + box.height - handleSize / 2 },
        { x: box.x - handleSize / 2, y: box.y + box.height / 2 - handleSize / 2 },
        { x: box.x + box.width - handleSize / 2, y: box.y + box.height / 2 - handleSize / 2 },
    ];

    ctx.save();
    ctx.strokeStyle = '#6a7bd1';
    ctx.lineWidth = isMobile ? 4 : 3;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(box.x, box.y, box.width, box.height);
    ctx.restore();

    handles.forEach((handle) => {
        ctx.save();
        ctx.fillStyle = '#6a7bd1';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = isMobile ? 4 : 3;
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
        ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        ctx.restore();
    });

    const rotationHandleX = box.x + box.width / 2;
    const rotationHandleY = box.y - 35;

    ctx.save();
    ctx.strokeStyle = '#6a7bd1';
    ctx.lineWidth = isMobile ? 5 : 4;
    ctx.beginPath();
    ctx.moveTo(box.x + box.width / 2, box.y);
    ctx.lineTo(rotationHandleX, rotationHandleY);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#6a7bd1';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = isMobile ? 4 : 3;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(rotationHandleX, rotationHandleY, rotationHandleSize / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${isMobile ? 24 : 20}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↻', rotationHandleX, rotationHandleY);
    ctx.restore();
}

export function applyResizeHandle(
    handle: string,
    deltaX: number,
    deltaY: number,
    start: { width: number; height: number; x: number; y: number },
    minSize = 20
): { width: number; height: number; x: number; y: number } {
    let newWidth = start.width;
    let newHeight = start.height;
    let newX = start.x;
    let newY = start.y;

    switch (handle) {
        case 'se':
            newWidth = Math.max(minSize, start.width + deltaX);
            newHeight = Math.max(minSize, start.height + deltaY);
            break;
        case 'sw':
            newWidth = Math.max(minSize, start.width - deltaX);
            newHeight = Math.max(minSize, start.height + deltaY);
            newX = start.x + deltaX;
            break;
        case 'ne':
            newWidth = Math.max(minSize, start.width + deltaX);
            newHeight = Math.max(minSize, start.height - deltaY);
            newY = start.y + deltaY;
            break;
        case 'nw':
            newWidth = Math.max(minSize, start.width - deltaX);
            newHeight = Math.max(minSize, start.height - deltaY);
            newX = start.x + deltaX;
            newY = start.y + deltaY;
            break;
        case 'n':
            newHeight = Math.max(minSize, start.height - deltaY);
            newY = start.y + deltaY;
            break;
        case 's':
            newHeight = Math.max(minSize, start.height + deltaY);
            break;
        case 'w':
            newWidth = Math.max(minSize, start.width - deltaX);
            newX = start.x + deltaX;
            break;
        case 'e':
            newWidth = Math.max(minSize, start.width + deltaX);
            break;
        default:
            break;
    }

    return { width: newWidth, height: newHeight, x: newX, y: newY };
}
