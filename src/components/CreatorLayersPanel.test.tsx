// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import {
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TextSettings } from '@/types/editor';
import CreatorLayersPanel from './CreatorLayersPanel';

const settings: TextSettings = {
    fontSize: 42,
    color: '#ffffff',
    fontFamily: 'Impact',
    fontWeight: '900',
    letterSpacing: 0,
    textCase: 'uppercase',
    backgroundColor: 'transparent',
    backgroundRadius: 0,
    outline: { width: 1, color: '#000000' },
    shadow: {
        blur: 5,
        offsetX: 1,
        offsetY: 1,
        color: '#000000',
    },
};

function TextLayerHarness() {
    const [texts, setTexts] = useState([
        { id: 'text-a', text: 'Layer A', settings },
        { id: 'text-b', text: 'Layer B', settings },
        { id: 'text-c', text: 'Layer C', settings },
    ]);

    return (
        <CreatorLayersPanel
            texts={texts}
            images={[]}
            shapes={[]}
            selectedTextIndex={-1}
            selectedImageIndex={-1}
            selectedShapeIndex={-1}
            originalTextCount={0}
            onSelectText={vi.fn()}
            onSelectImage={vi.fn()}
            onSelectShape={vi.fn()}
            onToggleText={vi.fn()}
            onToggleImage={vi.fn()}
            onToggleShape={vi.fn()}
            onDuplicateText={vi.fn()}
            onDuplicateImage={vi.fn()}
            onDuplicateShape={vi.fn()}
            onMoveText={(index, direction) => {
                const nextIndex =
                    direction === 'forward' ? index + 1 : index - 1;
                setTexts((current) => {
                    const next = [...current];
                    [next[index], next[nextIndex]] = [
                        next[nextIndex],
                        next[index],
                    ];
                    return next;
                });
            }}
            onMoveImage={vi.fn()}
            onMoveShape={vi.fn()}
            onDeleteText={vi.fn()}
            onDeleteImage={vi.fn()}
            onDeleteShape={vi.fn()}
        />
    );
}

afterEach(cleanup);

describe('CreatorLayersPanel', () => {
    it('keeps keyboard focus attached to the same text layer after reordering', async () => {
        render(<TextLayerHarness />);
        const moveLayerA = screen.getByRole('button', {
            name: 'Bring Custom text 1 forward',
        });
        moveLayerA.focus();

        fireEvent.click(moveLayerA);

        await waitFor(() =>
            expect(document.activeElement).toHaveAccessibleName(
                'Bring Custom text 2 forward'
            )
        );
        const focusedRow = (
            document.activeElement as HTMLElement
        ).closest('[data-layer-id]') as HTMLElement;
        expect(focusedRow).toHaveAttribute('data-layer-id', 'text-a');
        expect(within(focusedRow).getByText('Layer A')).toBeInTheDocument();
        expect(within(focusedRow).queryByText('Layer B')).not.toBeInTheDocument();
    });

    it('keeps compact license details available for a discovered background', () => {
        render(
            <CreatorLayersPanel
                texts={[]}
                images={[]}
                shapes={[]}
                selectedTextIndex={-1}
                selectedImageIndex={-1}
                selectedShapeIndex={-1}
                originalTextCount={0}
                backgroundLabel="Licensed reaction photo"
                backgroundSource={{
                    provider: 'Wikimedia Commons',
                    url: 'https://commons.wikimedia.org/wiki/File:Reaction.jpg',
                    creator: 'Example photographer',
                    creditLine: 'Photo: Example Archive / Creator',
                    licenseName: 'CC BY-SA 4.0',
                    licenseUrl:
                        'https://creativecommons.org/licenses/by-sa/4.0/',
                    rights: 'share-alike',
                    usageTerms:
                        'Creative Commons Attribution-ShareAlike 4.0',
                    restrictions: 'Personality rights may apply',
                }}
                onSelectText={vi.fn()}
                onSelectImage={vi.fn()}
                onSelectShape={vi.fn()}
                onToggleText={vi.fn()}
                onToggleImage={vi.fn()}
                onToggleShape={vi.fn()}
                onDuplicateText={vi.fn()}
                onDuplicateImage={vi.fn()}
                onDuplicateShape={vi.fn()}
                onMoveText={vi.fn()}
                onMoveImage={vi.fn()}
                onMoveShape={vi.fn()}
                onDeleteText={vi.fn()}
                onDeleteImage={vi.fn()}
                onDeleteShape={vi.fn()}
            />
        );

        expect(screen.getByText('Licensed reaction photo')).toBeInTheDocument();
        expect(screen.getByText('CC BY-SA 4.0')).toBeInTheDocument();
        expect(
            screen.getByText('Photo: Example Archive / Creator')
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                'Creative Commons Attribution-ShareAlike 4.0'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByText('Personality rights may apply')
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', {
                name: 'Open background image source',
            })
        ).toHaveAttribute(
            'href',
            'https://commons.wikimedia.org/wiki/File:Reaction.jpg'
        );
    });

    it('marks an unknown-rights web background as a warning and shows its terms', () => {
        render(
            <CreatorLayersPanel
                texts={[]}
                images={[]}
                shapes={[]}
                selectedTextIndex={-1}
                selectedImageIndex={-1}
                selectedShapeIndex={-1}
                originalTextCount={0}
                backgroundLabel="Current event photo"
                backgroundSource={{
                    provider: 'SearXNG',
                    url: 'https://publisher.example/current-event',
                    creator: 'publisher.example',
                    licenseName: 'Rights not verified',
                    rights: 'unknown',
                    usageTerms:
                        'Check the original publisher before reuse.',
                }}
                onSelectText={vi.fn()}
                onSelectImage={vi.fn()}
                onSelectShape={vi.fn()}
                onToggleText={vi.fn()}
                onToggleImage={vi.fn()}
                onToggleShape={vi.fn()}
                onDuplicateText={vi.fn()}
                onDuplicateImage={vi.fn()}
                onDuplicateShape={vi.fn()}
                onMoveText={vi.fn()}
                onMoveImage={vi.fn()}
                onMoveShape={vi.fn()}
                onDeleteText={vi.fn()}
                onDeleteImage={vi.fn()}
                onDeleteShape={vi.fn()}
            />
        );

        const rightsBadge = screen.getByText('Rights not verified');
        expect(rightsBadge).toHaveClass('border-amber-400/30');
        expect(rightsBadge).not.toHaveClass('border-emerald-400/25');
        expect(screen.getByText('Rights warning')).toBeInTheDocument();
        expect(
            screen.getByText('Check the original publisher before reuse.')
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/licensed/i)
        ).not.toBeInTheDocument();
    });
});
