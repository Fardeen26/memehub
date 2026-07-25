import { useState, useCallback } from 'react';

export interface FontConfig {
    name: string;
    weights: string[];
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
}

interface FontLoadState {
    loaded: boolean;
    loading: boolean;
    error: boolean;
}

const GOOGLE_FONTS_BASE_URL = 'https://fonts.googleapis.com/css2';

// Cache for loaded fonts to avoid duplicate requests
const loadedFonts = new Set<string>();
const fontLoadPromises = new Map<string, Promise<void>>();

export function getGoogleFontStylesheetUrl({
    name,
    weights,
    display = 'swap',
}: FontConfig): string {
    const familyParam = weights.length > 1
        ? `${name.replace(/\s+/g, '+')}:wght@${weights.join(';')}`
        : `${name.replace(/\s+/g, '+')}:wght@${weights[0]}`;

    return `${GOOGLE_FONTS_BASE_URL}?family=${familyParam}&display=${display}`;
}

function waitForFontStylesheet(fontUrl: string): Promise<void> {
    const existingLink = document.querySelector<HTMLLinkElement>(
        `link[href="${fontUrl}"]`
    );

    if (
        existingLink?.dataset.memehubFontLoaded === 'true' ||
        existingLink?.sheet
    ) {
        if (existingLink) existingLink.dataset.memehubFontLoaded = 'true';
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const link = existingLink ?? document.createElement('link');
        const handleLoad = () => {
            link.dataset.memehubFontLoaded = 'true';
            resolve();
        };
        const handleError = () => {
            if (!existingLink) link.remove();
            reject(new Error(`Failed to load font stylesheet: ${fontUrl}`));
        };

        link.addEventListener('load', handleLoad, { once: true });
        link.addEventListener('error', handleError, { once: true });

        if (!existingLink) {
            link.rel = 'stylesheet';
            link.href = fontUrl;
            link.crossOrigin = 'anonymous';
            link.dataset.memehubFontStylesheet = 'true';
            document.head.appendChild(link);
        }
    });
}

export function useFontLoader() {
    const [fontStates, setFontStates] = useState<Record<string, FontLoadState>>({});

    const loadFont = useCallback(async (fontConfig: FontConfig): Promise<void> => {
        const { name, weights } = fontConfig;
        const fontKey = `${name}-${weights.join('-')}`;

        // Return early if already loaded
        if (loadedFonts.has(fontKey)) {
            return;
        }

        // Return existing promise if already loading
        if (fontLoadPromises.has(fontKey)) {
            return fontLoadPromises.get(fontKey);
        }

        // Update state to show loading
        setFontStates(prev => ({
            ...prev,
            [fontKey]: { loaded: false, loading: true, error: false }
        }));

        const loadPromise = (async () => {
            try {
                await waitForFontStylesheet(
                    getGoogleFontStylesheetUrl(fontConfig)
                );

                if (document.fonts?.load) {
                    await Promise.all(
                        weights.map((weight) =>
                            document.fonts.load(`${weight} 20px "${name}"`)
                        )
                    );
                    await document.fonts.ready;
                }

                loadedFonts.add(fontKey);
                setFontStates(prev => ({
                    ...prev,
                    [fontKey]: { loaded: true, loading: false, error: false }
                }));
            } catch (error) {
                fontLoadPromises.delete(fontKey);
                setFontStates(prev => ({
                    ...prev,
                    [fontKey]: { loaded: false, loading: false, error: true }
                }));
                throw error;
            }
        })();

        fontLoadPromises.set(fontKey, loadPromise);
        return loadPromise;
    }, []);

    const preloadFont = useCallback((fontConfig: FontConfig) => {
        // Non-blocking preload
        loadFont(fontConfig).catch(() => {
            // Silently fail for preloads
        });
    }, [loadFont]);

    const getFontState = useCallback((fontName: string, weights: string[] = ['400']) => {
        const fontKey = `${fontName}-${weights.join('-')}`;
        return fontStates[fontKey] || { loaded: false, loading: false, error: false };
    }, [fontStates]);

    const isFontReady = useCallback((fontName: string, weights: string[] = ['400']) => {
        const fontKey = `${fontName}-${weights.join('-')}`;
        return loadedFonts.has(fontKey);
    }, []);

    return {
        loadFont,
        preloadFont,
        getFontState,
        isFontReady,
        fontStates
    };
}

export const INDIAN_SCRIPT_FONT_NAMES = [
    'Noto Sans Devanagari',
    'Noto Sans Bengali',
    'Noto Sans Gurmukhi',
    'Noto Sans Gujarati',
    'Noto Sans Tamil',
    'Noto Sans Telugu',
    'Noto Sans Kannada',
    'Noto Sans Malayalam',
    'Noto Nastaliq Urdu',
] as const;

export function getCanonicalFontFamily(fontFamily: string): string {
    return fontFamily === 'Source Sans Pro' ? 'Source Sans 3' : fontFamily;
}

// Pre-defined font configurations for commonly used fonts
export const FONT_CONFIGS: Record<string, FontConfig> = {
    'Impact': {
        name: 'Impact',
        weights: ['400'],
        display: 'swap'
    },
    'Anton': {
        name: 'Anton',
        weights: ['400'],
        display: 'swap'
    },
    'Oswald': {
        name: 'Oswald',
        weights: ['200', '300', '400', '500', '600', '700'],
        display: 'swap'
    },
    'Bebas Neue': {
        name: 'Bebas Neue',
        weights: ['400'],
        display: 'swap'
    },
    'Montserrat': {
        name: 'Montserrat',
        weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
        display: 'swap'
    },
    'Open Sans': {
        name: 'Open Sans',
        weights: ['300', '400', '500', '600', '700', '800'],
        display: 'swap'
    },
    'Lato': {
        name: 'Lato',
        weights: ['100', '300', '400', '700', '900'],
        display: 'swap'
    },
    'Poppins': {
        name: 'Poppins',
        weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
        display: 'swap'
    },
    'Source Sans 3': {
        name: 'Source Sans 3',
        weights: ['200', '300', '400', '500', '600', '700', '800', '900'],
        display: 'swap'
    },
    'Nunito': {
        name: 'Nunito',
        weights: ['200', '300', '400', '500', '600', '700', '800', '900'],
        display: 'swap'
    },
    'Inter': {
        name: 'Inter',
        weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
        display: 'swap'
    },
    'Work Sans': {
        name: 'Work Sans',
        weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
        display: 'swap'
    },
    'Roboto Condensed': {
        name: 'Roboto Condensed',
        weights: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
        display: 'swap'
    },
    'Noto Sans Devanagari': {
        name: 'Noto Sans Devanagari',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Sans Bengali': {
        name: 'Noto Sans Bengali',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Sans Gurmukhi': {
        name: 'Noto Sans Gurmukhi',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Sans Gujarati': {
        name: 'Noto Sans Gujarati',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Sans Tamil': {
        name: 'Noto Sans Tamil',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Sans Telugu': {
        name: 'Noto Sans Telugu',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Sans Kannada': {
        name: 'Noto Sans Kannada',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Sans Malayalam': {
        name: 'Noto Sans Malayalam',
        weights: ['400', '700'],
        display: 'swap'
    },
    'Noto Nastaliq Urdu': {
        name: 'Noto Nastaliq Urdu',
        weights: ['400', '700'],
        display: 'swap'
    }
};

export default useFontLoader;
