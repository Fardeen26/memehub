'use client';

import { useRef, type ReactNode } from 'react';
import { Flame, FolderHeart, Layers3, Palette, Send } from 'lucide-react';

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
    icon: typeof Palette;
}> = [
    { id: 'discover', label: 'Images', icon: Flame },
    { id: 'styles', label: 'Text', icon: Palette },
    { id: 'assets', label: 'My assets', icon: FolderHeart },
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

    return (
        <section className="overflow-hidden rounded-xl border border-[#6a7bd1]/35 bg-[#11121a] shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
            <div className="flex min-h-11 items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/65">
                    Tools
                </p>
                <button
                    type="button"
                    aria-controls="creator-workspace-panels"
                    aria-expanded={!collapsed}
                    onClick={() => onCollapsedChange(!collapsed)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/75 transition-colors hover:border-[#6a7bd1]/45 hover:bg-[#6a7bd1]/15 hover:text-white"
                >
                    {collapsed ? 'Expand tools' : 'Collapse tools'}
                </button>
            </div>

            <div
                role="tablist"
                aria-label="Creator workspace"
                className="grid grid-cols-5 border-b border-white/10 bg-black/25"
            >
                {TABS.map(({ id, label, icon: Icon }, index) => {
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
                            aria-selected={selected}
                            aria-controls={`creator-panel-${id}`}
                            tabIndex={selected ? 0 : -1}
                            onClick={() => selectTab(id)}
                            onKeyDown={(event) => {
                                let nextIndex: number | null = null;
                                if (event.key === 'ArrowRight') {
                                    nextIndex = (index + 1) % TABS.length;
                                } else if (event.key === 'ArrowLeft') {
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
                            className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 border-r border-white/10 px-0.5 py-1.5 text-[9px] font-medium transition-colors last:border-r-0 sm:flex-row sm:gap-1.5 sm:px-1 sm:text-xs ${
                                selected
                                    ? 'bg-[#6a7bd1] text-white'
                                    : 'text-white/55 hover:bg-white/5 hover:text-white'
                            }`}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>

            <div
                id="creator-workspace-panels"
                hidden={collapsed}
                className="lg:max-h-[min(52vh,35rem)] lg:overflow-y-auto lg:overscroll-contain"
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
