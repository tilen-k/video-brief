export type WorkspaceStatusClientError =
  | "unauthenticated"
  | "onboarding"
  | "not_found";

export function pathForWorkspaceStatusError(
  error: WorkspaceStatusClientError,
  userVideoId: string,
): string {
  void userVideoId;
  switch (error) {
    case "unauthenticated":
      return "/auth/guest?next=/";
    case "onboarding":
      return "/onboarding";
    case "not_found":
      return "/";
  }
}
