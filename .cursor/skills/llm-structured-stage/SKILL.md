---
name: llm-structured-stage
description: Implement a VideoBrief AI pipeline stage with Vercel AI SDK, Claude Haiku, and Zod-validated structured output. Use when adding or changing video understanding, context questions, or personalized summary generation.
---

# LLM structured stage

## Pattern

```text
domain function
  → AIProvider method (Vercel AI SDK + Claude Haiku)
  → structured output
  → Zod.parse (throw/map on failure)
  → return typed result for persistence
```

## Steps

1. Define Zod schema for the stage output (chapters, timestamps, questions, etc.).
2. Add/extend method on `AIProvider` — do not call Anthropic directly from UI/actions.
3. Prompt with only needed context (prefer intermediate analysis over raw full transcript when available).
4. Validate before any DB write.
5. Unit-test schema + mocked provider responses with Vitest.

## Rules

- Default model: Claude Haiku for MVP
- Skip context questions already answered in stored user context
- Personalization changes emphasis/depth — do not invent unrelated facts
- Never persist unvalidated model JSON
