const COMPLEX_SHAPING_CHARACTER =
    /(?:\p{Script=Devanagari}|\p{Script=Bengali}|\p{Script=Gurmukhi}|\p{Script=Gujarati}|\p{Script=Oriya}|\p{Script=Tamil}|\p{Script=Telugu}|\p{Script=Kannada}|\p{Script=Malayalam}|\p{Script=Arabic}|\p{Mark}|\p{Extended_Pictographic}|[\u200C\u200D])/u;

/**
 * These scripts and grapheme sequences must be sent to Canvas as complete
 * strings. Drawing UTF-16 code units individually breaks conjuncts, vowel
 * marks, Urdu joining, and emoji sequences.
 */
export function usesComplexTextShaping(text: string): boolean {
    return COMPLEX_SHAPING_CHARACTER.test(text);
}

export function getSafeLetterSpacing(
    text: string,
    requestedSpacing: number
): number {
    return usesComplexTextShaping(text) ? 0 : requestedSpacing;
}
