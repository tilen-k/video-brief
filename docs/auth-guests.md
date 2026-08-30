# Auth and guests

First visit creates an **anonymous Supabase session**. Guests can Preview and Generate like signed-in users; library rows and usage attach to that same auth user id.

## Guest

Convert keeps `auth.users.id` **stable**:


| Path             | Mechanism                             |
| ---------------- | ------------------------------------- |
| Email / password | `updateUser` on the anonymous session |
| Google           | `linkIdentity`                        |


After convert, `syncProfileAfterConvert` updates `profiles` (email, display name). Guests skip the onboarding gate.

Soft email confirmation (the product allows use before verify).

## Why same `user.id`

Library entries, analyses, and `usage_events` are keyed by `user_id`. Preserving the id on convert means:

- No merge/migration of videos when someone signs up mid-session
- Usage history stays on the same account
- RLS policies keep working without special “guest transfer” logic



## Product “guest” vs anonymous flag

Supabase may keep `is_anonymous` true briefly while an email is already attached (convert in progress). The app treats **guest** as anonymous **and** no email yet (`isGuestUser`), so UI (account, onboarding redirects) stays correct during convert.

## Code entry points


| Concern                     | File                                  |
| --------------------------- | ------------------------------------- |
| Anonymous / guest helpers   | `src/domain/auth/is-anonymous.ts`     |
| Onboarding gate             | `src/domain/auth/needs-onboarding.ts` |
| Convert + Google link       | `src/lib/actions/auth.ts`             |
| Profile sync after convert  | `src/domain/auth/convert-profile.ts`  |
| Session refresh / redirects | `src/lib/supabase/middleware.ts`      |


