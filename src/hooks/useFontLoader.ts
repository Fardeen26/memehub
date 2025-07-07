import { useState, useCallback } from 'react';

interface FontConfig {
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

export function useFontLoader() {
    const [fontStates, setFontStates] = useState<Record<string, FontLoadState>>({});

    const loadFont = useCallback(async (fontConfig: FontConfig): Promise<void> => {
        const { name, weights, display = 'swap' } = fontConfig;
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

        const loadPromise = new Promise<void>((resolve, reject) => {
            try {
                // Create font URL
                const familyParam = weights.length > 1
                    ? `${name.replace(/\s+/g, '+')}:wght@${weights.join(';')}`
                    : `${name.replace(/\s+/g, '+')}:wght@${weights[0]}`;

                const fontUrl = `${GOOGLE_FONTS_BASE_URL}?family=${familyParam}&display=${display}`;

                // Check if link already exists
                const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
                if (existingLink) {
                    loadedFonts.add(fontKey);
                    setFontStates(prev => ({
                        ...prev,
                        [fontKey]: { loaded: true, loading: false, error: false }
                    }));
                    resolve();
                    return;
                }

                // Create and append link element
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fontUrl;
                link.crossOrigin = 'anonymous';

                link.onload = () => {
                    loadedFonts.add(fontKey);
                    setFontStates(prev => ({
                        ...prev,
                        [fontKey]: { loaded: true, loading: false, error: false }
                    }));
                    resolve();
                };

                link.onerror = () => {
                    setFontStates(prev => ({
                        ...prev,
                        [fontKey]: { loaded: false, loading: false, error: true }
                    }));
                    reject(new Error(`Failed to load font: ${name}`));
                };

                document.head.appendChild(link);

                // Preload the font for better performance
                if ('fonts' in document) {
                    const fontFaces = weights.map(weight =>
                        new FontFace(name, `url(${fontUrl})`, { weight, display })
                    );

                    Promise.all(fontFaces.map(fontFace => {
                        document.fonts?.add(fontFace);
                        return fontFace.load();
                    })).then(() => {
                        // Font is ready
                    }).catch(() => {
                        // Font load failed, but fallback will work
                    });
                }

            } catch (error) {
                setFontStates(prev => ({
                    ...prev,
                    [fontKey]: { loaded: false, loading: false, error: true }
                }));
                reject(error);
            }
        });

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
    'Source Sans Pro': {
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
    }
};

export default useFontLoader; 