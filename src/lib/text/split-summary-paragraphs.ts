export function splitSummaryParagraphs(text: string): string[] {
  const parts = text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [text.trim()];
}
