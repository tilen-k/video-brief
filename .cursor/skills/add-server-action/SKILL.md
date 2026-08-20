---
name: add-server-action
description: Scaffold a thin Next.js Server Action with Zod validation, Supabase auth, and a domain-function call. Use when adding mutations, form actions, or new server-side write paths in VideoBrief.
---

# Add Server Action

## Pattern

```text
'use server'
  → Zod parse input
  → createServerClient / get user (never trust client user_id)
  → authorize
  → call src/domain/...
  → revalidatePath / return { ok, data | error }
```

## Steps

1. Define Zod schema in `src/lib/validations/` or next to the action.
2. Create `src/app/.../actions.ts` (or `src/lib/actions/`) with `'use server'`.
3. Resolve session via `@supabase/ssr` server client.
4. Call domain logic — no business rules inside the action.
5. Wire UI with RHF + shadcn, or `useActionState` if progressive enhancement fits.
6. If the client needs status polling, expose a read path and TanStack Query key.

## Checklist

- [ ] Input validated with Zod
- [ ] User derived server-side
- [ ] RLS-compatible writes (user id from session)
- [ ] Domain function owns the work
- [ ] Paths revalidated
- [ ] No service-role key in client bundles
