import { describe, expect, it } from 'vitest';
import {
    createEditorDraft,
    isMemeEditorDraftState,
    MAX_DRAFT_LOCAL_MEDIA_BYTES,
    type MemeEditorDraftState,
} from './editorDraft';

const validState: MemeEditorDraftState = {
    template: {
        image: 'data:image/png;base64,dGVtcGxhdGU=',
        displayName: 'Saved reaction',
        textBoxes: [
            {
                x: 20,
                y: 30,
                width: 400,
                height: 100,
                fontSize: 48,
                minFont: 12,
                align: 'center',
            },
        ],
    },
    texts: ['When the draft comes back'],
    textBoxes: [
        {
            x: 20,
            y: 30,
            width: 400,
            height: 100,
            fontSize: 48,
            minFont: 12,
            align: 'center',
        },
    ],
    textBoxRotations: [0],
    textSettings: [
        {
            fontSize: 48,
            color: '#ffffff',
            fontFamily: 'Impact',
            fontWeight: '900',
            letterSpacing: 0,
            textCase: 'normal',
            outline: { width: 2, color: '#000000' },
            shadow: {
                blur: 5,
                offsetX: 1,
                offsetY: 1,
                color: '#000000',
            },
        },
    ],
    imageOverlays: [
        {
            id: 'reaction-face',
            src: 'data:image/webp;base64,b3ZlcmxheQ==',
            label: 'Reaction face',
            animated: false,
            animationDecodePending: false,
            mimeType: 'image/webp',
            source: {
                provider: 'Wikimedia Commons',
                url: 'https://commons.wikimedia.org/wiki/File:Reaction.jpg',
                creator: 'Example photographer',
                licenseName: 'CC BY-SA 4.0',
                licenseUrl:
                    'https://creativecommons.org/licenses/by-sa/4.0/',
                rights: 'share-alike',
            },
            x: 24,
            y: 36,
            width: 160,
            height: 120,
            originalWidth: 320,
            originalHeight: 240,
            opacity: 0.85,
            rotation: 12,
            eraseStrokes: [
                {
                    points: [
                        { x: 4, y: 8 },
                        { x: 12, y: 16 },
                    ],
                    size: 18,
                    opacity: 0.5,
                },
            ],
        },
    ],
    shapeOverlays: [
        {
            id: 'attention-arrow',
            type: 'arrow',
            x: 80,
            y: 120,
            width: 180,
            height: 60,
            rotation: -8,
            strokeColor: '#ff0000',
            fillColor: '#ffcc00',
            strokeWidth: 6,
            filled: true,
            opacity: 0.9,
        },
    ],
    strokes: [
        {
            points: [
                { x: 10, y: 20 },
                { x: 30, y: 40 },
            ],
            color: '#ffffff',
            size: 8,
            eraser: false,
        },
    ],
    branding: {
        enabled: true,
        text: '@memecreator',
        position: 'bottom-right',
    },
};

function setDraftValue(
    target: unknown,
    path: readonly (string | number)[],
    value: unknown
): void {
    let container = target;

    for (const segment of path.slice(0, -1)) {
        if (typeof container !== 'object' || container === null) {
            throw new TypeError(`Cannot traverse draft path segment ${String(segment)}.`);
        }

        container = (container as Record<string | number, unknown>)[segment];
    }

    if (typeof container !== 'object' || container === null) {
        throw new TypeError('Cannot set a value on a non-object draft container.');
    }

    const finalSegment = path.at(-1);
    if (finalSegment === undefined) {
        throw new TypeError('A draft path must contain at least one segment.');
    }

    (container as Record<string | number, unknown>)[finalSegment] = value;
}

describe('editor draft schema', () => {
    it('creates a versioned active draft from the complete editor scene', () => {
        expect(createEditorDraft(validState, 1234)).toEqual({
            schemaVersion: 1,
            updatedAt: 1234,
            state: validState,
        });
    });

    it('accepts a complete editor scene and rejects mismatched text collections', () => {
        expect(isMemeEditorDraftState(validState)).toBe(true);
        expect(
            isMemeEditorDraftState({
                ...validState,
                textBoxRotations: [],
            })
        ).toBe(false);
    });

    it('accepts legacy drafts without branding and rejects malformed branding', () => {
        const legacyState: MemeEditorDraftState = { ...validState };
        delete legacyState.branding;

        expect(isMemeEditorDraftState(legacyState)).toBe(true);
        expect(
            isMemeEditorDraftState({
                ...validState,
                branding: {
                    enabled: true,
                    text: '@creator',
                    position: 'middle',
                },
            })
        ).toBe(false);
    });

    it('accepts a local discovered canvas template and rejects remote or mismatched copies', () => {
        const canvasTemplate = {
            image: 'data:image/jpeg;base64,dGVtcGxhdGU=',
            displayName: 'Discovered reaction',
            textBoxes: structuredClone(validState.template.textBoxes),
            mimeType: 'image/jpeg',
            source: structuredClone(validState.imageOverlays[0].source),
        };
        const discoveredState = {
            ...structuredClone(validState),
            canvasTemplate,
        };

        expect(isMemeEditorDraftState(discoveredState)).toBe(true);

        const remoteCopy = structuredClone(discoveredState);
        remoteCopy.canvasTemplate.image =
            'https://upload.wikimedia.org/remote-template.jpg';
        expect(isMemeEditorDraftState(remoteCopy)).toBe(false);

        const mismatchedRights = structuredClone(discoveredState);
        mismatchedRights.canvasTemplate.source!.licenseName =
            'CC BY-ND 4.0';
        mismatchedRights.canvasTemplate.source!.rights = 'editable';
        expect(isMemeEditorDraftState(mismatchedRights)).toBe(false);
    });

    it('accepts hidden creator layers and rejects non-boolean visibility', () => {
        const hiddenState = structuredClone(validState);
        hiddenState.textSettings[0].visible = false;
        hiddenState.imageOverlays[0].visible = false;
        hiddenState.shapeOverlays[0].visible = false;

        expect(isMemeEditorDraftState(hiddenState)).toBe(true);

        const malformedState = structuredClone(hiddenState) as unknown as {
            imageOverlays: Array<{ visible: unknown }>;
        };
        malformedState.imageOverlays[0].visible = 'hidden';

        expect(isMemeEditorDraftState(malformedState)).toBe(false);
    });

    it('preserves a bounded media source and rejects malformed provenance', () => {
        expect(isMemeEditorDraftState(validState)).toBe(true);

        const unsafeUrl = structuredClone(validState);
        unsafeUrl.imageOverlays[0].source!.url = 'javascript:alert(1)';
        expect(isMemeEditorDraftState(unsafeUrl)).toBe(false);

        const unknownRights = structuredClone(validState);
        unknownRights.imageOverlays[0].source!.rights = 'probably-free' as never;
        expect(isMemeEditorDraftState(unknownRights)).toBe(false);

        const remoteSourceCopy = structuredClone(validState);
        remoteSourceCopy.imageOverlays[0].src =
            'https://upload.wikimedia.org/remote-only.jpg';
        expect(isMemeEditorDraftState(remoteSourceCopy)).toBe(false);

        const missingAttribution = structuredClone(validState);
        missingAttribution.imageOverlays[0].source!.creator = '';
        missingAttribution.imageOverlays[0].source!.creditLine = 'N/A';
        missingAttribution.imageOverlays[0].source!.attributionRequired = true;
        expect(isMemeEditorDraftState(missingAttribution)).toBe(false);

        const mismatchedLicense = structuredClone(validState);
        mismatchedLicense.imageOverlays[0].source!.licenseName = 'CC BY-ND 4.0';
        mismatchedLicense.imageOverlays[0].source!.rights = 'editable';
        expect(isMemeEditorDraftState(mismatchedLicense)).toBe(false);

        const mismatchedLocalMime = structuredClone(validState);
        mismatchedLocalMime.imageOverlays[0].mimeType = 'image/jpeg';
        expect(isMemeEditorDraftState(mismatchedLocalMime)).toBe(false);

        const animatedSourceFallback = structuredClone(validState);
        animatedSourceFallback.imageOverlays[0].animated = true;
        animatedSourceFallback.imageOverlays[0].animatedSrc =
            'https://example.com/remote-fallback.gif';
        animatedSourceFallback.imageOverlays[0].animationDecodePolicy = 'giphy';
        animatedSourceFallback.imageOverlays[0].animationStartMs = 123;
        expect(isMemeEditorDraftState(animatedSourceFallback)).toBe(false);
    });

    it('preserves honest web-search provenance without pretending the rights are known', () => {
        const webSourceState = structuredClone(validState) as unknown as {
            imageOverlays: Array<Record<string, unknown>>;
        };
        webSourceState.imageOverlays[0].source = {
            provider: 'SearXNG',
            url: 'https://example-news.test/cjp-protest',
            creator: 'example-news.test',
            licenseName: 'Rights not verified',
            rights: 'unknown',
            usageTerms: 'Check the original publisher before reuse.',
        };

        expect(isMemeEditorDraftState(webSourceState)).toBe(true);

        const legacyHttpPublisher = structuredClone(webSourceState);
        (
            legacyHttpPublisher.imageOverlays[0].source as Record<
                string,
                unknown
            >
        ).url = 'http://legacy-news.test/cjp-protest';
        expect(isMemeEditorDraftState(legacyHttpPublisher)).toBe(true);

        const disguisedLicensedCopy = structuredClone(webSourceState);
        (
            disguisedLicensedCopy.imageOverlays[0].source as Record<
                string,
                unknown
            >
        ).rights = 'editable';
        expect(isMemeEditorDraftState(disguisedLicensedCopy)).toBe(false);
    });

    it('still accepts bounded animated media when it has no licensed-image provenance', () => {
        const animatedState = structuredClone(validState);
        delete animatedState.imageOverlays[0].source;
        animatedState.imageOverlays[0].src =
            'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==';
        animatedState.imageOverlays[0].mimeType = 'image/gif';
        animatedState.imageOverlays[0].animated = true;
        animatedState.imageOverlays[0].animatedSrc =
            'https://media.giphy.com/media/example/giphy.gif';
        animatedState.imageOverlays[0].animationDecodePolicy = 'giphy';

        expect(isMemeEditorDraftState(animatedState)).toBe(true);
    });

    it.each([
        [
            'template display name',
            ['template', 'displayName'],
            null,
        ],
        [
            'template text box coordinate',
            ['template', 'textBoxes', 0, 'x'],
            Number.NaN,
        ],
        [
            'editable text box alignment',
            ['textBoxes', 0, 'align'],
            'justify',
        ],
        [
            'text settings case',
            ['textSettings', 0, 'textCase'],
            'titlecase',
        ],
        [
            'text settings outline',
            ['textSettings', 0, 'outline'],
            null,
        ],
        [
            'text settings shadow offset',
            ['textSettings', 0, 'shadow', 'offsetX'],
            Number.POSITIVE_INFINITY,
        ],
        [
            'image overlay dimensions',
            ['imageOverlays', 0, 'originalWidth'],
            Number.NaN,
        ],
        [
            'image overlay optional fields',
            ['imageOverlays', 0, 'animated'],
            'yes',
        ],
        [
            'image overlay animated source',
            ['imageOverlays', 0, 'animatedSrc'],
            42,
        ],
        [
            'image overlay decode policy',
            ['imageOverlays', 0, 'animationDecodePolicy'],
            'unbounded',
        ],
        [
            'image erase stroke point',
            ['imageOverlays', 0, 'eraseStrokes', 0, 'points', 0, 'y'],
            null,
        ],
        [
            'shape type',
            ['shapeOverlays', 0, 'type'],
            'hexagon',
        ],
        [
            'shape filled flag',
            ['shapeOverlays', 0, 'filled'],
            1,
        ],
        [
            'drawing stroke point',
            ['strokes', 0, 'points', 0, 'x'],
            Number.NEGATIVE_INFINITY,
        ],
    ] as const)('rejects an invalid %s', (_label, path, invalidValue) => {
        const candidate = structuredClone(validState);
        setDraftValue(candidate, path, invalidValue);

        expect(isMemeEditorDraftState(candidate)).toBe(false);
    });

    it('requires creator branding to have only its exact supported fields', () => {
        expect(
            isMemeEditorDraftState({
                ...validState,
                branding: {
                    ...validState.branding,
                    untrustedMarkup: '<script>',
                },
            })
        ).toBe(false);
    });

    it('rejects grossly oversized editor collections', () => {
        const candidate = structuredClone(validState);
        const textBox = candidate.textBoxes[0];
        const textSettings = candidate.textSettings[0];

        candidate.texts = Array.from({ length: 10_001 }, () => 'text');
        candidate.textBoxes = Array.from({ length: 10_001 }, () => textBox);
        candidate.textBoxRotations = Array.from({ length: 10_001 }, () => 0);
        candidate.textSettings = Array.from(
            { length: 10_001 },
            () => textSettings
        );

        expect(isMemeEditorDraftState(candidate)).toBe(false);
    });

    it('rejects an aggregate of local media that would make draft recovery unsafe', () => {
        const candidate = structuredClone(validState);
        const bytesPerOverlay = Math.ceil(
            MAX_DRAFT_LOCAL_MEDIA_BYTES / 100
        );
        const sharedPayload = `data:image/webp;base64,${'A'.repeat(
            Math.ceil((bytesPerOverlay * 4) / 3)
        )}`;
        candidate.imageOverlays = Array.from(
            { length: 101 },
            (_, index) => ({
                ...structuredClone(validState.imageOverlays[0]),
                id: `large-local-overlay-${index}`,
                src: sharedPayload,
            })
        );

        expect(isMemeEditorDraftState(candidate)).toBe(false);
    });

    it('rejects sparse collections whose missing entries would break recovery', () => {
        const candidate = structuredClone(validState);
        candidate.texts = new Array(1);

        expect(isMemeEditorDraftState(candidate)).toBe(false);
    });
});
