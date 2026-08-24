---
name: llm-structured-stage
description: Implement a VideoBrief AI pipeline stage with Vercel AI SDK and Zod-validated structured output. Use when adding or changing classify or personalized section generation.
---

# LLM structured stage

## Pattern

```text
domain function
  → AIProvider method (Vercel AI SDK; model from analysisConfig)
  → structured output
  → Zod.parse (throw/map on failure)
  → return typed result for persistence
```

## Steps

1. Define Zod schema for the stage (`classifyVideo` or `generateSections`).
2. Add/extend method on `AIProvider` — do not call a vendor SDK from UI/actions.
3. Prompt with only needed context (classify: metadata + short excerpt; generate: transcript subset + profile + per-video prefs).
4. Validate before any DB write.
5. Unit-test schema + mocked provider responses with Vitest.

## Rules

- Default model: `analysisConfig.model.defaultId`
- Classify: `isEducational`, `confidence`, `topic?`. YouTube category is a hint only; ambiguous → prefer educational. **No** section skeleton. **No** LLM-invented questions.
- Per-video prefs are 0–100 integers on the analysis row (set at paste)
- `generateSections` returns `{ summary, sections: { title, startTime, endTime, body }[] }`
- Personalization changes emphasis/depth — do not invent unrelated facts
- Never persist unvalidated model JSON
