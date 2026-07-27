// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CreatorExportPanel from './CreatorExportPanel';

afterEach(cleanup);

describe('CreatorExportPanel', () => {
    it('defaults to a lossless original export with fit mode', () => {
        render(
            <CreatorExportPanel
                isExporting={false}
                onExport={vi.fn()}
                onCopy={vi.fn()}
            />
        );

        expect(screen.getByRole('radio', { name: 'Original size' })).toBeChecked();
        expect(screen.getByRole('combobox', { name: 'Image format' })).toHaveValue(
            'png'
        );
        expect(screen.getByRole('radio', { name: 'Fit entire meme' })).toBeChecked();
        expect(
            screen.getByRole('button', { name: 'Export original PNG' })
        ).toBeInTheDocument();
    });

    it('builds an explicit platform export request from creator choices', () => {
        const onExport = vi.fn();
        render(
            <CreatorExportPanel
                isExporting={false}
                onExport={onExport}
                onCopy={vi.fn()}
            />
        );

        fireEvent.click(
            screen.getByRole('radio', { name: 'Instagram portrait' })
        );
        fireEvent.change(screen.getByRole('combobox', { name: 'Image format' }), {
            target: { value: 'jpeg' },
        });
        fireEvent.click(screen.getByRole('radio', { name: 'Fill and crop edges' }));
        fireEvent.change(screen.getByRole('slider', { name: 'Image quality' }), {
            target: { value: '84' },
        });
        fireEvent.click(
            screen.getByRole('button', {
                name: 'Export instagram portrait JPEG',
            })
        );

        expect(onExport).toHaveBeenCalledWith({
            profileId: 'instagram-portrait',
            format: 'jpeg',
            placement: 'cover',
            quality: 0.84,
            backgroundColor: '#111111',
        });
    });
});
