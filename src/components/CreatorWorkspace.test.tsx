// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CreatorWorkspace, {
    type CreatorWorkspaceTab,
} from './CreatorWorkspace';

afterEach(cleanup);

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
    it('starts compact and expands the selected tool accessibly', () => {
        render(<WorkspaceHarness />);

        const toggle = screen.getByRole('button', { name: 'Expand tools' });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByText('Discovery panel')).not.toBeVisible();

        fireEvent.click(
            screen.getByRole('tab', { name: 'Images' })
        );

        expect(
            screen.getByRole('button', { name: 'Collapse tools' })
        ).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('Discovery panel')).toBeVisible();
        const panels = document.getElementById('creator-workspace-panels');
        expect(panels).toHaveClass(
            'lg:max-h-[min(52vh,35rem)]',
            'lg:overflow-y-auto'
        );
        expect(panels).not.toHaveClass('overflow-y-auto');
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
