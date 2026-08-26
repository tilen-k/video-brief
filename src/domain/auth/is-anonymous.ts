/** True when the Supabase session is an anonymous (guest) user. */
export function isAnonymousUser(
  user: { is_anonymous?: boolean } | null | undefined,
): boolean {
  return user?.is_anonymous === true;
}

/**
 * Product “guest”: anonymous and not yet attaching an email (convert in progress
 * may keep is_anonymous until email confirm, but email is already set).
 */
export function isGuestUser(
  user:
    | { is_anonymous?: boolean; email?: string | null }
    | null
    | undefined,
): boolean {
  return isAnonymousUser(user) && !user?.email;
}
