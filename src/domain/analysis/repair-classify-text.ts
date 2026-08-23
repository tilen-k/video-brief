import { classifyVideoSchema } from "./schemas";

function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

/**
 * Recover classify output when a model returns JSON-ish or
 * `true, high, topic` instead of an object.
 */
export function repairClassifyText(text: string) {
  const trimmed = stripMarkdownFence(text);
  if (!trimmed) {
    return null;
  }

  try {
    return classifyVideoSchema.parse(JSON.parse(trimmed));
  } catch {
    // fall through
  }

  const csv = trimmed.match(
    /^(true|false)\s*,\s*(high|medium|low)\s*(?:,\s*(.+))?$/i,
  );
  if (!csv) {
    return null;
  }

  const topic = csv[3]?.trim().replace(/[.]+$/, "");
  return classifyVideoSchema.parse({
    isEducational: csv[1]!.toLowerCase() === "true",
    confidence: csv[2]!.toLowerCase(),
    ...(topic ? { topic } : {}),
  });
}
