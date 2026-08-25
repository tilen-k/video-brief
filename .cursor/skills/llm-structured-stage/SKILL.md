---
name: llm-structured-stage
description: Implement a VideoBrief AI generate stage with Vercel AI SDK and Zod-validated structured output. Use when adding or changing personalized section generation.
---

# LLM structured stage

## Pattern

```text
domain function
  → AIProvider.generateSections (Vercel AI SDK; model from analysisConfig)
  → structured output
  → Zod.parse (throw/map on failure)
  → return typed result for persistence
```

## Steps

1. Define Zod schema for generate (`generateSections`).
2. Add/extend method on `AIProvider` — do not call a vendor SDK from UI/actions.
3. Prompt with transcript subset + per-video prefs (length, tone, familiarity if set).
4. Validate before any DB write.
5. Unit-test schema + mocked provider responses with Vitest.

## Rules

- Default model: `analysisConfig.model.defaultId`
- No `classifyVideo` / classification stage
- Per-video prefs are 0–100 integers on the analysis row (set at Generate); familiarity may be null
- `generateSections` returns `{ summary, sections: { title, startTime, endTime, body }[] }`
- Personalization changes emphasis/depth/tone — do not invent unrelated facts
- Never persist unvalidated model JSON
