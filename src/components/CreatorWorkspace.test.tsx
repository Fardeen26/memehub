// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CreatorWorkspace, {
    type CreatorWorkspaceTab,
} from './CreatorWorkspace';

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

function DiscoveryPanelHarness() {
    const [query, setQuery] = useState('');
    return (
        <>
            <p>Discovery panel</p>
            <input
                aria-label="Discovery query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
            />
        </>
    );
}

function WorkspaceHarness() {
    const [activeTab, setActiveTab] =
        useState<CreatorWorkspaceTab>('discover');
    const [collapsed, setCollapsed] = useState(true);

    return (
        <CreatorWorkspace
            activeTab={activeTab}
            onTabChange={setActiveTab}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            discover={<DiscoveryPanelHarness />}
            styles={<p>Style panel</p>}
            assets={<p>Asset panel</p>}
            layers={<p>Layer panel</p>}
            exportPanel={<p>Export panel</p>}
        />
    );
}

describe('CreatorWorkspace keyboard navigation', () => {
    it('memoizes the workspace shell so canvas drag updates do not rerender it', () => {
        expect(
            (CreatorWorkspace as unknown as { $$typeof?: symbol }).$$typeof
        ).toBe(Symbol.for('react.memo'));
    });

    it('renders as a desktop tool rail with a scrollable panel', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => ({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }))
        );
        render(<WorkspaceHarness />);

        expect(
            screen.getByRole('tablist', { name: 'Creator workspace' })
        ).toHaveAttribute('aria-orientation', 'vertical');
        expect(
            screen.getByRole('tablist', { name: 'Creator workspace' })
        ).toHaveClass(
            'lg:grid-cols-1',
            'lg:auto-rows-[72px]',
            'lg:content-start'
        );
        expect(
            screen.getByRole('tablist', { name: 'Creator workspace' })
        ).not.toHaveClass('lg:auto-rows-fr');

        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(5);
        tabs.forEach((tab) => {
            expect(tab).toHaveClass(
                'lg:h-[72px]',
                'lg:flex-col',
                'lg:gap-1.5'
            );
            expect(tab.querySelector('span')).toHaveClass(
                'lg:whitespace-nowrap',
                'lg:leading-none'
            );
            expect(tab.querySelector('svg')).toHaveClass(
                'lg:h-[18px]',
                'lg:w-[18px]',
                'lg:shrink-0'
            );
        });
        expect(
            screen.getByRole('tab', { name: 'My assets' })
        ).toHaveTextContent('Assets');
    });

    it('starts compact and expands the selected tool accessibly', () => {
        render(<WorkspaceHarness />);

        const toggle = screen.getByRole('button', { name: 'Expand tools' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(toggle.closest('section')).toHaveClass('lg:grid-cols-1');
        expect(screen.getByText('Discovery panel')).not.toBeVisible();

        fireEvent.click(
            screen.getByRole('tab', { name: 'Images' })
        );

        expect(
            screen.getByRole('button', { name: 'Collapse tools' })
        ).toHaveAttribute('aria-expanded', 'true');
        expect(
            screen.getByRole('button', { name: 'Collapse tools' }).closest(
                'section'
            )
        ).toHaveClass('lg:grid-cols-[64px_minmax(0,1fr)]');
        expect(screen.getByText('Discovery panel')).toBeVisible();
        const panels = document.getElementById('creator-workspace-panels');
        expect(panels).toHaveClass(
            'max-h-[55vh]',
            'overflow-y-auto',
            'lg:min-h-0',
            'lg:overflow-y-auto'
        );
    });

    it('moves focus and selection with horizontal arrow keys', () => {
        render(<WorkspaceHarness />);

        const discoverTab = screen.getByRole('tab', { name: 'Images' });
        discoverTab.focus();
        fireEvent.keyDown(discoverTab, { key: 'ArrowRight' });

        const stylesTab = screen.getByRole('tab', { name: 'Text' });
        expect(stylesTab).toHaveFocus();
        expect(stylesTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Style panel')).toBeInTheDocument();
    });

    it('supports vertical arrow keys for the desktop tool rail', () => {
        vi.stubGlobal(
            'matchMedia',
            vi.fn(() => ({
                matches: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            }))
        );
        render(<WorkspaceHarness />);

        const discoverTab = screen.getByRole('tab', { name: 'Images' });
        discoverTab.focus();
        fireEvent.keyDown(discoverTab, { key: 'ArrowDown' });

        expect(screen.getByRole('tab', { name: 'Text' })).toHaveFocus();
        fireEvent.keyDown(screen.getByRole('tab', { name: 'Text' }), {
            key: 'ArrowUp',
        });
        expect(discoverTab).toHaveFocus();
    });

    it('supports Home and End without trapping creators on one panel', () => {
        render(<WorkspaceHarness />);

        const stylesTab = screen.getByRole('tab', { name: 'Text' });
        stylesTab.focus();
        fireEvent.keyDown(stylesTab, { key: 'End' });

        const exportTab = screen.getByRole('tab', { name: 'Export' });
        expect(exportTab).toHaveFocus();
        expect(exportTab).toHaveAttribute('aria-selected', 'true');

        fireEvent.keyDown(exportTab, { key: 'Home' });
        const discoverTab = screen.getByRole('tab', { name: 'Images' });
        expect(discoverTab).toHaveFocus();
        expect(discoverTab).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByText('Discovery panel')).toBeInTheDocument();
    });

    it('keeps discovery results alive while a creator checks another workspace', () => {
        render(<WorkspaceHarness />);

        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));
        fireEvent.change(
            screen.getByRole('textbox', { name: 'Discovery query' }),
            { target: { value: 'Dharmendra Pradhan' } }
        );
        fireEvent.click(screen.getByRole('tab', { name: 'Layers' }));
        fireEvent.click(screen.getByRole('tab', { name: 'Images' }));

        expect(
            screen.getByRole('textbox', { name: 'Discovery query' })
        ).toHaveValue('Dharmendra Pradhan');
    });
});
