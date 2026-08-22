import { describe, expect, it } from "vitest";

import { pathForWorkspaceStatusError } from "./status-navigation";

describe("pathForWorkspaceStatusError", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("sends expired sessions back to login with the workspace next path", () => {
    expect(pathForWorkspaceStatusError("unauthenticated", id)).toBe(
      `/login?next=/library/${id}`,
    );
  });

  it("sends incomplete onboarding to onboarding", () => {
    expect(pathForWorkspaceStatusError("onboarding", id)).toBe("/onboarding");
  });

  it("sends missing or not-owned rows to the library", () => {
    expect(pathForWorkspaceStatusError("not_found", id)).toBe("/library");
  });
});
