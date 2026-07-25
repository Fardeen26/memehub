// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
    deleteSavedSource,
    listSavedSources,
    saveSource,
    SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH,
    SOURCE_INBOX_MAX_CONTEXT_LENGTH,
    SOURCE_INBOX_MAX_PUBLISHER_LENGTH,
    SOURCE_INBOX_MAX_TITLE_LENGTH,
    SOURCE_INBOX_MAX_URL_LENGTH,
    SOURCE_INBOX_STORAGE_KEY,
} from './sourceInbox';

describe('creator source inbox', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('saves an attributed source locally and updates a duplicate instead of cloning it', () => {
        const first = saveSource({
            title: 'Dharmendra Pradhan protest coverage',
            url: 'https://example.com/story',
            publisher: 'Example News',
            kind: 'news',
            context: 'जनता पार्टी',
        });
        const updated = saveSource({
            title: 'Updated title',
            url: 'https://example.com/story',
            publisher: 'Example News',
            kind: 'news',
            context: 'Cockroach protest',
        });

        expect(updated.id).toBe(first.id);
        expect(listSavedSources()).toEqual([
            expect.objectContaining({
                title: 'Updated title',
                url: 'https://example.com/story',
                context: 'Cockroach protest',
            }),
        ]);
    });

    it('rejects script and non-web URLs', () => {
        expect(() =>
            saveSource({
                title: 'Unsafe',
                url: 'javascript:alert(1)',
                publisher: 'Unknown',
                kind: 'social',
            })
        ).toThrow('Enter a valid http or https source link.');
    });

    it('ignores rehydrated records with a script URL or an unknown kind', () => {
        const validSource = {
            id: 'source-valid',
            title: 'Valid source',
            url: 'https://example.com/valid',
            publisher: 'Example',
            kind: 'news',
            savedAt: Date.now(),
        };
        localStorage.setItem(
            SOURCE_INBOX_STORAGE_KEY,
            JSON.stringify([
                validSource,
                {
                    ...validSource,
                    id: 'source-script',
                    url: 'javascript:alert(1)',
                },
                {
                    ...validSource,
                    id: 'source-unknown-kind',
                    kind: 'sponsored',
                },
            ])
        );

        expect(listSavedSources()).toEqual([validSource]);
    });

    it('ignores rehydrated records with unsafe optional images, unreasonable dates, or oversized strings', () => {
        const validSource = {
            id: 'source-valid',
            title: 'Valid source',
            url: 'https://example.com/valid',
            publisher: 'Example',
            kind: 'image',
            imageUrl: 'https://example.com/preview.jpg',
            savedAt: Date.now(),
        };
        localStorage.setItem(
            SOURCE_INBOX_STORAGE_KEY,
            JSON.stringify([
                validSource,
                {
                    ...validSource,
                    id: 'source-unsafe-image',
                    imageUrl: 'data:image/svg+xml,<svg></svg>',
                },
                {
                    ...validSource,
                    id: 'source-future',
                    savedAt: Date.now() + 2 * 24 * 60 * 60 * 1000,
                },
                {
                    ...validSource,
                    id: 'source-oversized',
                    title: 'x'.repeat(SOURCE_INBOX_MAX_TITLE_LENGTH + 1),
                },
            ])
        );

        expect(listSavedSources()).toEqual([validSource]);
    });

    it('bounds text fields when saving a new source', () => {
        const saved = saveSource({
            title: `  ${'t'.repeat(SOURCE_INBOX_MAX_TITLE_LENGTH + 20)}  `,
            url: 'https://example.com/story',
            publisher: `  ${'p'.repeat(
                SOURCE_INBOX_MAX_PUBLISHER_LENGTH + 20
            )}  `,
            kind: 'social',
            context: `  ${'c'.repeat(
                SOURCE_INBOX_MAX_CONTEXT_LENGTH + 20
            )}  `,
        });

        expect(saved.title).toHaveLength(SOURCE_INBOX_MAX_TITLE_LENGTH);
        expect(saved.publisher).toHaveLength(
            SOURCE_INBOX_MAX_PUBLISHER_LENGTH
        );
        expect(saved.context).toHaveLength(SOURCE_INBOX_MAX_CONTEXT_LENGTH);
        expect(saved.title).not.toMatch(/\s$/);
        expect(saved.publisher).not.toMatch(/\s$/);
        expect(saved.context).not.toMatch(/\s$/);
    });

    it('rejects oversized source and image URLs', () => {
        const oversizedUrl = `https://example.com/${'x'.repeat(
            SOURCE_INBOX_MAX_URL_LENGTH
        )}`;

        expect(() =>
            saveSource({
                title: 'Oversized source URL',
                url: oversizedUrl,
                publisher: 'Example',
                kind: 'news',
            })
        ).toThrow('Source links must be 2,048 characters or fewer.');

        expect(() =>
            saveSource({
                title: 'Oversized image URL',
                url: 'https://example.com/story',
                publisher: 'Example',
                kind: 'image',
                imageUrl: oversizedUrl,
            })
        ).toThrow('Source links must be 2,048 characters or fewer.');
    });

    it('saves a bounded reusable-image attribution snapshot', () => {
        const saved = saveSource({
            title: 'Licensed image',
            url: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
            publisher: 'Wikimedia Commons',
            kind: 'image',
            creator: `  ${'c'.repeat(
                SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH + 20
            )}  `,
            licenseName: `  ${'l'.repeat(
                SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH + 20
            )}  `,
            licenseUrl:
                'https://creativecommons.org/licenses/by-sa/4.0/#terms',
            rights: 'share-alike',
            creditLine: 'Photo: Example Archive',
            attributionRequired: true,
            usageTerms: 'Creative Commons Attribution-ShareAlike 4.0',
            restrictions: 'Personality rights may apply',
        });

        expect(saved).toEqual(
            expect.objectContaining({
                creator: 'c'.repeat(SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH),
                licenseName: 'l'.repeat(
                    SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH
                ),
                licenseUrl:
                    'https://creativecommons.org/licenses/by-sa/4.0/',
                rights: 'share-alike',
                creditLine: 'Photo: Example Archive',
                attributionRequired: true,
                usageTerms: 'Creative Commons Attribution-ShareAlike 4.0',
                restrictions: 'Personality rights may apply',
            })
        );
        expect(listSavedSources()).toEqual([saved]);
    });

    it('ignores rehydrated attribution snapshots with unsafe licenses or unknown rights', () => {
        const validSource = {
            id: 'source-valid-attribution',
            title: 'Licensed image',
            url: 'https://commons.wikimedia.org/wiki/File:Example.jpg',
            publisher: 'Wikimedia Commons',
            kind: 'image',
            creator: 'Example creator',
            licenseName: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            rights: 'share-alike',
            savedAt: Date.now(),
        };
        localStorage.setItem(
            SOURCE_INBOX_STORAGE_KEY,
            JSON.stringify([
                validSource,
                {
                    ...validSource,
                    id: 'source-script-license',
                    licenseUrl: 'javascript:alert(1)',
                },
                {
                    ...validSource,
                    id: 'source-unknown-rights',
                    rights: 'probably-free',
                },
                {
                    ...validSource,
                    id: 'source-oversized-creator',
                    creator: 'x'.repeat(
                        SOURCE_INBOX_MAX_ATTRIBUTION_LENGTH + 1
                    ),
                },
            ])
        );

        expect(listSavedSources()).toEqual([validSource]);
    });

    it('deletes a saved source without touching the rest of the inbox', () => {
        const first = saveSource({
            title: 'First',
            url: 'https://example.com/first',
            publisher: 'Example',
            kind: 'news',
        });
        saveSource({
            title: 'Second',
            url: 'https://example.com/second',
            publisher: 'Example',
            kind: 'news',
        });

        deleteSavedSource(first.id);

        expect(listSavedSources().map((source) => source.title)).toEqual([
            'Second',
        ]);
    });
});
