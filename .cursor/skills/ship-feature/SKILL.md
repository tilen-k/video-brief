---
name: ship-feature
description: >-
  Orchestrate shipping a substantial VideoBrief feature: optional architect
  plan, implement, mechanical checks, then reviewer / verifier / security
  subagents. Use when the user says ship-feature, /ship-feature, or asks to
  design-implement-review a non-trivial feature end-to-end.
---

# Ship feature

Orchestrate a substantial change. Specialists **diagnose**; the main agent **implements**. Do not ask readonly specialists to edit production code.

## When to use

Use for new domain/data/pipeline/auth surfaces or multi-file features.

Skip for copy, CSS, or single-field tweaks — implement directly instead.

## Steps

### 0. Classify

- **Needs architect** if it introduces or changes: domain boundaries, per-user data model, analysis states, Server Action vs route, authz model, or AI pipeline stages (`classifyVideo` / `generateSections`).
- **Needs security** if it touches: auth, RLS, Server Actions writes, user-owned rows, service role, or AI/tool trust boundaries.
- **UI changed** if pages/forms/layouts/i18n on screens change — the human tests that in the browser (see `.cursor/rules/90-ui-verification.mdc`). Agents do not.

### 1. Architect (when needed)

Delegate to the `architect` subagent with the feature goal and any constraints from the user.

Show the plan to the user if there are open questions. Do not implement until blocking questions are resolved (or the user says to proceed).

### 2. Implement

Main agent implements against the plan (or against the request if architect was skipped).

Prefer existing skills when relevant:

- `add-server-action`
- `drizzle-table-rls`
- `youtube-ingest`
- `llm-structured-stage`
- `.agents/skills/ai-sdk` for AI SDK usage

### 3. Mechanical checks

```bash
pnpm type-check
pnpm lint
pnpm test
```

Fix failures before specialist review.

### 4. Reviewer

Delegate to the `reviewer` subagent. Pass: what was built, key paths, and that it should inspect the git diff.

### 5. Verifier

Delegate to the `verifier` subagent. Pass: claimed behavior and whether UI changed.

Do not start `pnpm dev` or use browser tools for UI. Note UI flows for the human to click through. No Playwright.

### 6. Security (when needed)

Delegate to the `security` subagent for auth/data/AI trust changes.

Optional: user may also run built-in `/review-security` — do not block on it unless asked.

### 7. Fix and re-check

Main agent fixes **Critical** and **High** findings that are valid.

Re-run verifier (and security if it had Critical/High) after substantive fixes.

Do not expand scope into unrelated refactors.

### 8. Final report

```text
SHIPPED — <feature>

Done
- …

Architect decisions (if any)
- …

Findings fixed
- …

Deferred / residual
- …

Verified
- type-check / lint / test: …
- UI for human: … (or N/A)
```

## Trust boundary

| Role | Writes production code? |
|------|-------------------------|
| Main agent | Yes |
| architect / reviewer / verifier / security | No (`readonly`) |

Verifier may write tests only if the user explicitly asks.

## Invocation examples

- `/ship-feature` paste YouTube URL into library and start analysis
- Ship onboarding persistence end-to-end
- Design then build context-questions stage
