/**
 * Lookup table for converting English number words to their digit equivalents.
 * Used during title normalization so "Dune: Part Two" matches "DUNE PART 2".
 */
const wordToDigit: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

/**
 * Normalizes a movie title for fuzzy matching during reconciliation.
 *
 * Normalization steps:
 *   1. Lowercase the entire string
 *   2. Replace all punctuation with spaces (NOT remove — this is critical so
 *      "Spider-Man" becomes "spider man", not "spiderman")
 *   3. Collapse consecutive spaces into a single space
 *   4. Trim leading/trailing whitespace
 *   5. Convert number words to digits ("two" → "2")
 *
 * This allows matching across common partner data variations:
 *   - "DUNE PART 2" ↔ "Dune: Part Two"
 *   - "Spider-Man: Homecoming" ↔ "Spider Man - Homecoming"
 *
 * Important: Normalization is only used for matching — the original title
 * is always preserved in the database and displayed in the UI.
 */
export function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase();

  // Replace all non-word, non-space characters (punctuation) with spaces.
  // Using spaces (not empty string) preserves word boundaries: "Spider-Man" → "spider man"
  normalized = normalized.replace(/[^\w\s]/g, " ");

  // Collapse any runs of whitespace into a single space
  normalized = normalized.replace(/\s+/g, " ");

  normalized = normalized.trim();

  // Convert number words to digits so "Part Two" matches "Part 2"
  normalized = normalized
    .split(" ")
    .map((word) => wordToDigit[word] || word)
    .join(" ");

  return normalized;
}
