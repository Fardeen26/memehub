import { describe, expect, it } from 'vitest';
import {
    buildMemeSearchPlan,
    isMemeSearchIntent,
    type MemeSearchIntent,
} from './memeSearchPlanner';
import { countSearchWords } from './searchText';

describe('meme search planner', () => {
    it('preserves the submitted query while normalizing the resolved search text', () => {
        const query = '  ＣＪＰ\u00a0 protest \n lathi  charge  ';

        const plan = buildMemeSearchPlan(query, 'moment');

        expect(plan.originalQuery).toBe(query);
        expect(plan.resolvedQuery).toBe('CJP protest lathi charge');
        expect(plan.providerQueries[0]).toBe('CJP protest lathi charge');
        expect(plan.providerQueries).toContain(
            'CJP protest lathi charge current event'
        );
    });

    it('shows a normalized correction as the resolved query without losing the original', () => {
        const plan = buildMemeSearchPlan(
            'darmendra pardhan',
            'moment',
            '  Dharmendra   Pradhan  '
        );

        expect(plan.originalQuery).toBe('darmendra pardhan');
        expect(plan.resolvedQuery).toBe('Dharmendra Pradhan');
        expect(plan.providerQueries[0]).toBe('Dharmendra Pradhan');
        expect(plan.providerQueries).not.toContain('darmendra pardhan');
    });

    it('falls back to the submitted query when a correction is blank', () => {
        const plan = buildMemeSearchPlan('  protest  ', 'moment', ' \n ');

        expect(plan.resolvedQuery).toBe('protest');
    });

    it.each<{
        intent: MemeSearchIntent;
        requiredTerms: RegExp[];
    }>([
        {
            intent: 'reaction',
            requiredTerms: [/\breaction\b/i, /\bexpression\b/i],
        },
        {
            intent: 'cutout',
            requiredTerms: [/\btransparent png\b/i, /\bcutout\b/i],
        },
        {
            intent: 'template',
            requiredTerms: [/\bblank meme template\b/i],
        },
    ])(
        'adds meme-creator terms to $intent provider queries',
        ({ intent, requiredTerms }) => {
            const queries = buildMemeSearchPlan(
                'confused politician',
                intent
            ).providerQueries;

            for (const term of requiredTerms) {
                expect(queries.some((query) => term.test(query))).toBe(true);
            }
        }
    );

    it('prioritizes creator-heavy social sources for social searches', () => {
        const queries = buildMemeSearchPlan(
            'budget speech reactions',
            'social'
        ).providerQueries;

        expect(queries[0]).toContain('site:reddit.com');
        expect(queries[0]).toContain('site:x.com');
        expect(queries[0]).toContain('site:instagram.com');
        expect(queries[0]).toContain('budget speech reactions');
    });

    it('progressively relaxes trailing context to a reusable two-token query', () => {
        const candidates = buildMemeSearchPlan(
            'cjp protest lathi charge',
            'moment'
        ).reusableCandidates;

        expect(candidates).toEqual([
            'cjp protest lathi charge',
            'cjp protest lathi',
            'cjp protest',
        ]);
    });

    it('strips meme and freshness filler before making reusable candidates', () => {
        const candidates = buildMemeSearchPlan(
            'latest viral CJP protest lathi charge meme today',
            'moment'
        ).reusableCandidates;

        expect(candidates).toEqual([
            'CJP protest lathi charge',
            'CJP protest lathi',
            'CJP protest',
        ]);
        expect(candidates.join(' ')).not.toMatch(
            /\b(?:latest|viral|meme|today)\b/i
        );
    });

    it('keeps query lists bounded, unique, and free of empty entries', () => {
        const longQuery =
            'one two three four five six seven eight nine ten eleven twelve';
        const plan = buildMemeSearchPlan(longQuery, 'social');
        const fillerOnly = buildMemeSearchPlan(
            ' latest viral meme memes today ',
            'template'
        );

        expect(plan.providerQueries.length).toBeLessThanOrEqual(6);
        expect(plan.reusableCandidates.length).toBeLessThanOrEqual(6);
        expect(plan.reusableCandidates.at(-1)).toBe('one two');

        for (const candidates of [
            plan.providerQueries,
            plan.reusableCandidates,
            fillerOnly.providerQueries,
            fillerOnly.reusableCandidates,
        ]) {
            expect(candidates.every((candidate) => candidate.trim().length > 0))
                .toBe(true);
            expect(
                new Set(
                    candidates.map((candidate) => candidate.toLowerCase())
                ).size
            ).toBe(candidates.length);
        }
    });

    it.each<MemeSearchIntent>([
        'moment',
        'reaction',
        'cutout',
        'template',
        'social',
    ])(
        'keeps every $intent provider query inside the 50-word API boundary',
        (intent) => {
            const coreQuery = Array.from(
                { length: 50 },
                (_, index) => `topic${index + 1}`
            ).join(' ');
            const queries = buildMemeSearchPlan(
                coreQuery,
                intent
            ).providerQueries;

            expect(queries.length).toBeGreaterThan(0);
            expect(
                queries.every(
                    (candidate) => countSearchWords(candidate) <= 50
                )
            ).toBe(true);
            expect(queries.every((candidate) => candidate.includes('topic1')))
                .toBe(true);
        }
    );

    it('validates supported intents and rejects unsupported ones', () => {
        expect(
            [
                'moment',
                'reaction',
                'cutout',
                'template',
                'social',
            ].every(isMemeSearchIntent)
        ).toBe(true);
        expect(isMemeSearchIntent('trending')).toBe(false);
        expect(isMemeSearchIntent(null)).toBe(false);
        expect(() =>
            buildMemeSearchPlan(
                'election reaction',
                'trending' as MemeSearchIntent
            )
        ).toThrow('Unsupported meme search intent: trending');
    });
});
