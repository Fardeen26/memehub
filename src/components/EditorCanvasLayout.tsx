import type { ComponentPropsWithoutRef } from 'react';

type EditorCanvasLayoutProps = ComponentPropsWithoutRef<'div'> & {
    toolsCollapsed?: boolean;
};

export function EditorCanvasLayout({
    className = '',
    toolsCollapsed = false,
    ...props
}: EditorCanvasLayoutProps) {
    const desktopColumns = toolsCollapsed
        ? 'lg:grid-cols-[64px_minmax(0,1fr)_minmax(260px,290px)]'
        : 'lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(260px,290px)]';

    return (
        <div
            data-testid="editor-canvas-layout"
            className={`grid w-full items-start gap-3 ${desktopColumns} lg:gap-4 ${className}`}
            {...props}
        />
    );
}

export function EditorToolsPanel({
    className = '',
    ...props
}: ComponentPropsWithoutRef<'aside'>) {
    return (
        <aside
            aria-label="Editor tools"
            className={`min-w-0 lg:col-start-1 lg:row-start-1 ${className}`}
            {...props}
        />
    );
}

export function EditorCanvasStage({
    className = '',
    ...props
}: ComponentPropsWithoutRef<'section'>) {
    return (
        <section
            aria-label="Meme canvas"
            className={`min-w-0 lg:col-start-2 lg:row-start-1 ${className}`}
            {...props}
        />
    );
}

export function EditorInspectorPanel({
    className = '',
    ...props
}: ComponentPropsWithoutRef<'aside'>) {
    return (
        <aside
            aria-label="Properties inspector"
            className={`min-w-0 lg:col-start-3 lg:row-start-1 ${className}`}
            {...props}
        />
    );
}
