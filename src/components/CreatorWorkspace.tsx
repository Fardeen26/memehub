'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    Flame,
    FolderHeart,
    Layers3,
    Palette,
    PanelLeftOpen,
    Send,
} from 'lucide-react';

export type CreatorWorkspaceTab =
    | 'discover'
    | 'styles'
    | 'assets'
    | 'layers'
    | 'export';

type CreatorWorkspaceProps = {
    activeTab: CreatorWorkspaceTab;
    onTabChange: (tab: CreatorWorkspaceTab) => void;
    collapsed: boolean;
    onCollapsedChange: (collapsed: boolean) => void;
    discover: ReactNode;
    styles: ReactNode;
    assets: ReactNode;
    layers: ReactNode;
    exportPanel: ReactNode;
};

const TABS: Array<{
    id: CreatorWorkspaceTab;
    label: string;
    railLabel?: string;
    icon: typeof Palette;
}> = [
    { id: 'discover', label: 'Images', icon: Flame },
    { id: 'styles', label: 'Text', icon: Palette },
    {
        id: 'assets',
        label: 'My assets',
        railLabel: 'Assets',
        icon: FolderHeart,
    },
    { id: 'layers', label: 'Layers', icon: Layers3 },
    { id: 'export', label: 'Export', icon: Send },
];

export default function CreatorWorkspace({
    activeTab,
    onTabChange,
    collapsed,
    onCollapsedChange,
    discover,
    styles,
    assets,
    layers,
    exportPanel,
}: CreatorWorkspaceProps) {
    const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [verticalTabs, setVerticalTabs] = useState(false);
    const panels: Record<CreatorWorkspaceTab, ReactNode> = {
        discover,
        styles,
        assets,
        layers,
        export: exportPanel,
    };

    const selectTab = (tab: CreatorWorkspaceTab) => {
        onTabChange(tab);
        onCollapsedChange(false);
    };

    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const syncOrientation = () => setVerticalTabs(mediaQuery.matches);
        syncOrientation();
        mediaQuery.addEventListener('change', syncOrientation);
        return () =>
            mediaQuery.removeEventListener('change', syncOrientation);
    }, []);

    return (
        <section
            className={`overflow-hidden rounded-xl border border-white/10 bg-[#15151c] shadow-[0_14px_36px_rgba(0,0,0,0.24)] lg:grid lg:min-h-0 lg:max-h-[calc(100dvh-7rem)] lg:grid-rows-[auto_minmax(0,1fr)] ${
                collapsed
                    ? 'lg:grid-cols-1'
                    : 'lg:grid-cols-[64px_minmax(0,1fr)]'
            }`}
        >
            <div
                className={`flex min-h-11 items-center justify-between gap-3 border-b border-white/10 px-3 py-2 ${
                    collapsed
                        ? 'lg:col-span-1 lg:justify-center lg:px-1'
                        : 'lg:col-span-2'
                }`}
            >
                <p
                    className={`text-xs font-semibold uppercase tracking-[0.12em] text-white/65 ${
                        collapsed ? 'lg:sr-only' : ''
                    }`}
                >
                    Tools
                </p>
                <button
                    type="button"
                    aria-controls="creator-workspace-panels"
                    aria-expanded={!collapsed}
                    onClick={() => onCollapsedChange(!collapsed)}
                    className={`rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/75 transition-colors hover:border-[#6a7bd1]/45 hover:bg-[#6a7bd1]/15 hover:text-white ${
                        collapsed
                            ? 'lg:flex lg:h-8 lg:w-8 lg:items-center lg:justify-center lg:px-0 lg:py-0'
                            : ''
                    }`}
                    title={collapsed ? 'Expand tools' : 'Collapse tools'}
                >
                    {collapsed ? (
                        <>
                            <PanelLeftOpen
                                className="hidden h-4 w-4 lg:block"
                                aria-hidden="true"
                            />
                            <span className="lg:sr-only">Expand tools</span>
                        </>
                    ) : (
                        'Collapse tools'
                    )}
                </button>
            </div>

            <div
                role="tablist"
                aria-label="Creator workspace"
                aria-orientation={verticalTabs ? 'vertical' : 'horizontal'}
                className="grid grid-cols-5 border-b border-white/10 bg-black/25 lg:auto-rows-[72px] lg:grid-cols-1 lg:content-start lg:border-b-0 lg:border-r"
            >
                {TABS.map(({ id, label, railLabel, icon: Icon }, index) => {
                    const selected = activeTab === id;
                    return (
                        <button
                            key={id}
                            ref={(element) => {
                                tabRefs.current[index] = element;
                            }}
                            id={`creator-tab-${id}`}
                            type="button"
                            role="tab"
                            aria-label={label}
                            aria-selected={selected}
                            aria-controls={`creator-panel-${id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => selectTab(id)}
                            onKeyDown={(event) => {
                                let nextIndex: number | null = null;
                                if (
                                    (!verticalTabs &&
                                        event.key === 'ArrowRight') ||
                                    (verticalTabs &&
                                        event.key === 'ArrowDown')
                                ) {
                                    nextIndex = (index + 1) % TABS.length;
                                } else if (
                                    (!verticalTabs &&
                                        event.key === 'ArrowLeft') ||
                                    (verticalTabs && event.key === 'ArrowUp')
                                ) {
                                    nextIndex =
                                        (index - 1 + TABS.length) %
                                        TABS.length;
                                } else if (event.key === 'Home') {
                                    nextIndex = 0;
                                } else if (event.key === 'End') {
                                    nextIndex = TABS.length - 1;
                                }

                                if (nextIndex === null) return;
                                event.preventDefault();
                                selectTab(TABS[nextIndex].id);
                                tabRefs.current[nextIndex]?.focus();
                            }}
                            className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 border-r border-white/10 px-0.5 py-1.5 text-[9px] font-medium transition-colors last:border-r-0 sm:flex-row sm:gap-1.5 sm:px-1 sm:text-xs lg:h-[72px] lg:min-h-0 lg:flex-col lg:gap-1.5 lg:border-b lg:border-r-0 lg:px-1 lg:text-[10px] lg:last:border-b-0 ${
                                selected
                                    ? 'bg-[#6a7bd1] text-white'
                                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5 lg:h-[18px] lg:w-[18px] lg:shrink-0" />
                            <span className="lg:whitespace-nowrap lg:leading-none">
                                {railLabel ?? label}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div
                id="creator-workspace-panels"
                hidden={collapsed}
                className="max-h-[55vh] overflow-y-auto overscroll-contain lg:min-h-0 lg:max-h-none lg:overflow-y-auto"
            >
                {TABS.map(({ id }) => (
                    <div
                        key={id}
                        id={`creator-panel-${id}`}
                        role="tabpanel"
                        aria-labelledby={`creator-tab-${id}`}
                        hidden={activeTab !== id}
                        className={activeTab === id ? 'p-3' : 'hidden'}
                    >
                        {panels[id]}
                    </div>
                ))}
            </div>
        </section>
    );
}
