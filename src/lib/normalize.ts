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

export function normalizeTitle(title: string): string {
  let normalized = title.toLowerCase();
  // Replace all punctuation with spaces (so "Spider-Man" becomes "Spider Man", not "SpiderMan")
  normalized = normalized.replace(/[^\w\s]/g, " ");
  // Replace multiple spaces with single space
  normalized = normalized.replace(/\s+/g, " ");
  // Trim whitespace
  normalized = normalized.trim();
  // Convert number words to digits
  normalized = normalized
    .split(" ")
    .map((word) => wordToDigit[word] || word)
    .join(" ");
  return normalized;
}
