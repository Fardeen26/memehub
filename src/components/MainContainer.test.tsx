// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SelectedProvider from '@/context/SelectedContext';
import MainContainer from './MainContainer';

vi.mock('./DynamicMemeEditor', () => ({
    default: ({
        onReset,
        template,
    }: {
        onReset: () => void;
        template: { displayName?: string };
    }) => (
        <div>
            <p>Editor open</p>
            <p>{template.displayName}</p>
            <button type="button" onClick={onReset}>
                Leave editor
            </button>
        </div>
    ),
}));

vi.mock('./TemplateSelector', () => ({
    default: ({ onSelect }: { onSelect: (key: string) => void }) => (
        <div>
            <p>Template gallery</p>
            <button type="button" onClick={() => onSelect('fresh-template')}>
                Use fresh template
            </button>
        </div>
    ),
}));

describe('MainContainer navigation', () => {
    afterEach(cleanup);

    it('opens templates immediately without draft recovery controls or confirmation', () => {
        const confirm = vi.spyOn(window, 'confirm');
        render(
            <SelectedProvider>
                <MainContainer
                    templates={{
                        'fresh-template': {
                            image: 'data:image/png;base64,ZnJlc2g=',
                            displayName: 'Fresh template',
                            textBoxes: [],
                        },
                    }}
                />
            </SelectedProvider>
        );

        expect(screen.getByText('Template gallery')).toBeInTheDocument();
        expect(screen.queryByText(/saved draft/i)).not.toBeInTheDocument();
        expect(confirm).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Use fresh template' }));

        expect(screen.getByText('Editor open')).toBeInTheDocument();
        expect(screen.getByText('Fresh template')).toBeInTheDocument();
        expect(confirm).not.toHaveBeenCalled();
    });
});
