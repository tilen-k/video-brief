import { z } from "zod";

export const GLOBAL_CONTEXT_KEYS = [
  "role",
  "background",
  "interests",
  "summary_style",
  "detail_level",
] as const;

export type GlobalContextKey = (typeof GLOBAL_CONTEXT_KEYS)[number];

export const summaryStyleSchema = z.enum(["concise", "structured", "narrative"]);
export const detailLevelSchema = z.enum(["brief", "balanced", "detailed"]);

const emptyToUndefined = (value: unknown) => {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }
  return value;
};

const optionalTrimmedString = (max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max).optional(),
  );

export const onboardingInputSchema = z.object({
  role: optionalTrimmedString(200),
  background: optionalTrimmedString(2000),
  interests: optionalTrimmedString(1000),
  summaryStyle: z.preprocess(
    emptyToUndefined,
    summaryStyleSchema.optional(),
  ),
  detailLevel: z.preprocess(
    emptyToUndefined,
    detailLevelSchema.optional(),
  ),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

/** Map form fields to persisted context key/value pairs (omit empties). */
export function onboardingToContextEntries(
  input: OnboardingInput,
): Array<{ key: GlobalContextKey; value: string }> {
  const entries: Array<{ key: GlobalContextKey; value: string }> = [];

  const push = (key: GlobalContextKey, value: string | undefined) => {
    const trimmed = value?.trim();
    if (trimmed) {
      entries.push({ key, value: trimmed });
    }
  };

  push("role", input.role);
  push("background", input.background);
  push("interests", input.interests);
  push("summary_style", input.summaryStyle);
  push("detail_level", input.detailLevel);

  return entries;
}
