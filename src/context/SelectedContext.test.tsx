// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEditorDraft, type MemeEditorDraftState } from '@/lib/editorDraft';
import {
    deleteActiveMemeDraft,
    saveActiveMemeDraft,
} from '@/lib/memeDraft';
import useSelected from '@/hooks/useSelected';
import SelectedProvider from './SelectedContext';

const savedState: MemeEditorDraftState = {
    template: {
        image: 'data:image/png;base64,cmVjb3Zlcnk=',
        displayName: 'Recovered project',
        textBoxes: [],
    },
    texts: [],
    textBoxes: [],
    textBoxRotations: [],
    textSettings: [],
    imageOverlays: [],
    shapeOverlays: [],
    strokes: [],
};

function SelectionProbe() {
    const { selected, customTemplate } = useSelected();

    return (
        <div>
            <span data-testid="selected">{selected || 'none'}</span>
            <span data-testid="template">{customTemplate?.displayName || 'none'}</span>
        </div>
    );
}

describe('SelectedProvider draft recovery', () => {
    beforeEach(async () => {
        await deleteActiveMemeDraft();
    });

    it('does not automatically reveal a valid saved project after refresh', async () => {
        await saveActiveMemeDraft(createEditorDraft(savedState, 100));

        render(
            <SelectedProvider>
                <SelectionProbe />
            </SelectedProvider>
        );

        expect(screen.getByTestId('selected')).toHaveTextContent('none');
        expect(screen.getByTestId('template')).toHaveTextContent('none');
    });
});
