export type WorkspaceStatusClientError =
  | "unauthenticated"
  | "onboarding"
  | "not_found";

export function pathForWorkspaceStatusError(
  error: WorkspaceStatusClientError,
  userVideoId: string,
): string {
  switch (error) {
    case "unauthenticated":
      return `/login?next=/library/${userVideoId}`;
    case "onboarding":
      return "/onboarding";
    case "not_found":
      return "/library";
  }
}
