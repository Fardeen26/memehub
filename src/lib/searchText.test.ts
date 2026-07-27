import { describe, expect, it } from 'vitest';
import {
    countSearchWords,
    extractSearchWords,
    truncateSearchWords,
} from './searchText';

describe('search text helpers', () => {
    it('keeps Unicode combining marks attached to their visible word', () => {
        expect(extractSearchWords('धर्मेंद्र प्रधान की प्रतिक्रिया')).toEqual([
            'धर्मेंद्र',
            'प्रधान',
            'की',
            'प्रतिक्रिया',
        ]);
        expect(countSearchWords('धर्मेंद्र प्रधान की प्रतिक्रिया')).toBe(4);
    });

    it.each([
        ['Bengali', 'বাংলা প্রতিবাদ', ['বাংলা', 'প্রতিবাদ']],
        ['Tamil', 'தமிழ் அரசியல்', ['தமிழ்', 'அரசியல்']],
        ['Telugu', 'తెలుగు వార్తలు', ['తెలుగు', 'వార్తలు']],
        ['Hindi joiner', 'क्‍षत्रिय प्रतिक्रिया', ['क्‍षत्रिय', 'प्रतिक्रिया']],
    ])('keeps $0 script words intact', (_label, query, expected) => {
        expect(extractSearchWords(query as string)).toEqual(expected);
    });

    it('truncates at a whole Unicode word without damaging its marks', () => {
        expect(
            truncateSearchWords(
                'धर्मेंद्र प्रधान की ताज़ा प्रतिक्रिया',
                3
            )
        ).toBe('धर्मेंद्र प्रधान की');
    });
});
