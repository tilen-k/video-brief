/**
 * Allow only same-origin relative paths for post-auth redirects.
 * Rejects protocol-relative, absolute, and backslash paths.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  fallback = "/",
): string {
  if (!raw) {
    return fallback;
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return fallback;
  }
  if (raw.includes("://")) {
    return fallback;
  }
  return raw;
}
