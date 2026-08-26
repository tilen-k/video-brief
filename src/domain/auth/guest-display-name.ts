/** Stable guest label from auth user id (e.g. guesta1b2c3d4). */
export function guestDisplayName(userId: string): string {
  const hex = userId.replace(/-/g, "").slice(0, 8);
  return `guest${hex}`;
}
