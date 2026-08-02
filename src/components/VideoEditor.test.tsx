// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VideoEditor from './VideoEditor';

const { renderFrame } = vi.hoisted(() => ({ renderFrame: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/video/export', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/video/export')>();
    return { ...actual, renderVideoProjectFrame: renderFrame };
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('VideoEditor', () => {
    it('renders the full desktop editor workspace before a video is chosen', () => {
        render(<VideoEditor />);

        expect(screen.getByRole('navigation', { name: 'Editor tools' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Edit text' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Upload video/ })).toBeInTheDocument();
    });

    it('redraws the preview when text changes or playback starts after a video loads', async () => {
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
            const element = originalCreateElement(tagName, options);
            if (tagName === 'video') {
                Object.defineProperties(element, {
                    duration: { value: 12 }, videoWidth: { value: 720 }, videoHeight: { value: 1280 },
                });
                Object.defineProperty(element, 'src', { set: () => setTimeout(() => element.onloadedmetadata?.(new Event('loadedmetadata'))) });
            }
            return element;
        });
        vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL: vi.fn() });
        Object.defineProperty(HTMLMediaElement.prototype, 'readyState', { configurable: true, get: () => HTMLMediaElement.HAVE_CURRENT_DATA });
        render(<VideoEditor />);
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(input, { target: { files: [new File(['video'], 'clip.mp4', { type: 'video/mp4' })] } });
        await waitFor(() => expect(screen.getByLabelText('Text content')).toBeEnabled());
        const video = document.querySelector('video')!;
        fireEvent.loadedData(video);
        renderFrame.mockClear();
        fireEvent.change(screen.getByLabelText('Text content'), { target: { value: 'Updated caption' } });
        await waitFor(() => expect(renderFrame).toHaveBeenCalled());
        renderFrame.mockClear();
        fireEvent.play(video);
        await waitFor(() => expect(renderFrame).toHaveBeenCalled());
    });
});
