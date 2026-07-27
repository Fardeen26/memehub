import { describe, expect, it } from 'vitest';
import {
    getSafeLetterSpacing,
    usesComplexTextShaping,
} from './textShaping';

describe('complex-script text shaping', () => {
    it.each([
        'जब आइडिया आया',
        'বাংলা মিম',
        'ગુજરાતી મીમ',
        'தமிழ் மீம்',
        'తెలుగు మీమ్',
        'ಕನ್ನಡ ಮೀಮ್',
        'മലയാളം മീം',
        'ਪੰਜਾਬੀ ਮੀਮ',
        'یہ ایک میم ہے',
    ])('preserves %s as one shaped canvas run', (text) => {
        expect(usesComplexTextShaping(text)).toBe(true);
        expect(getSafeLetterSpacing(text, 5)).toBe(0);
    });

    it('keeps creator-selected letter spacing for Latin meme text', () => {
        expect(usesComplexTextShaping('ME WHEN THE BUILD PASSES')).toBe(false);
        expect(getSafeLetterSpacing('ME WHEN THE BUILD PASSES', 5)).toBe(5);
    });
});
