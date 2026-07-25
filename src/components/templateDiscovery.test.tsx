// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectedProvider from '@/context/SelectedContext';
import type { Template } from '@/types/template';
import TemplateSearch from './TemplateSearch';
import TemplateSelector from './TemplateSelector';

vi.mock('@/hooks/useTrendingTemplates', () => ({
    useTrendingTemplates: () => ({
        templates: {},
        loading: false,
        error: null,
        refetch: vi.fn(),
    }),
}));

afterEach(() => {
    cleanup();
});

const exampleTemplate: Template = {
    image: 'https://example.com/distracted-boyfriend.jpg',
    displayName: 'Distracted Boyfriend',
    textBoxes: [],
};

function renderWithSelectedProvider(children: React.ReactNode) {
    return render(<SelectedProvider>{children}</SelectedProvider>);
}

describe('TemplateSelector', () => {
    it('renders template choices as focusable semantic buttons with meaningful names', () => {
        const onSelect = vi.fn();

        renderWithSelectedProvider(
            <TemplateSelector
                templates={{ 'distracted-boyfriend': exampleTemplate }}
                onSelect={onSelect}
            />
        );

        const templateButton = screen.getByRole('button', {
            name: 'Use Distracted Boyfriend template',
        });

        expect(templateButton).toHaveAttribute('type', 'button');
        templateButton.focus();
        expect(templateButton).toHaveFocus();

        fireEvent.click(templateButton);
        expect(onSelect).toHaveBeenCalledOnce();
        expect(onSelect).toHaveBeenCalledWith('distracted-boyfriend');
    });
});

describe('TemplateSearch', () => {
    it('gives the template search field an accessible label', () => {
        renderWithSelectedProvider(<TemplateSearch />);

        expect(
            screen.getByRole('textbox', { name: 'Search meme templates' })
        ).toBeInTheDocument();
    });

    it('keeps the custom-template workflow available when no templates match', async () => {
        renderWithSelectedProvider(<TemplateSearch />);

        fireEvent.change(screen.getByPlaceholderText('search templates'), {
            target: { value: 'no-template-can-match-this-query' },
        });

        fireEvent.click(
            await screen.findByRole('button', { name: 'Use Custom Template' })
        );

        expect(
            screen.getByRole('dialog', { name: 'Upload Custom Template' })
        ).toBeInTheDocument();
    });

    it('clears an empty-result search and restores the template gallery', async () => {
        renderWithSelectedProvider(<TemplateSearch />);

        const searchInput = screen.getByPlaceholderText('search templates');
        fireEvent.change(searchInput, {
            target: { value: 'no-template-can-match-this-query' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));

        expect(searchInput).toHaveValue('');
        expect(
            await screen.findByRole('button', {
                name: 'Use Modi g Poster template',
            })
        ).toBeInTheDocument();
    });
});
