/**
 * Narrow auth-user shape so domain does not import @supabase/supabase-js.
 * Email identity is treated as "has a password" (no magic-link in MVP).
 * Missing identity/provider lists fail closed (assume a password exists).
 */
export type PasswordProbeUser = {
  identities?: Array<{ provider?: string | null }> | null;
  app_metadata?: {
    provider?: string;
    providers?: unknown;
  } | null;
};

export function userHasPassword(user: PasswordProbeUser): boolean {
  const identities = user.identities;
  const providers = user.app_metadata?.providers;
  const singularProvider = user.app_metadata?.provider;
  const hasIdentityList = Array.isArray(identities);
  const hasProviderList = Array.isArray(providers);

  if (hasIdentityList && identities.some((identity) => identity.provider === "email")) {
    return true;
  }

  if (hasProviderList && providers.includes("email")) {
    return true;
  }

  if (singularProvider === "email") {
    return true;
  }

  if (hasIdentityList || hasProviderList) {
    return false;
  }

  return true;
}
