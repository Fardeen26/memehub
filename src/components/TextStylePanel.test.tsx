// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TextStylePanel from './TextStylePanel';

describe('TextStylePanel', () => {
    it('resets the currently selected text layer to its normal style', () => {
        const onResetStyle = vi.fn();

        render(
            <TextStylePanel
                activeTextIndex={4}
                textCount={5}
                onApplyPreset={vi.fn()}
                onResetStyle={onResetStyle}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Reset text style' })
        );

        expect(onResetStyle).toHaveBeenCalledWith(4);
        expect(
            screen.getByText('Text style reset to normal')
        ).toBeInTheDocument();
    });
});
