import { describe, expect, it } from "vitest";

import { pathForWorkspaceStatusError } from "./status-navigation";

describe("pathForWorkspaceStatusError", () => {
  const id = "11111111-1111-1111-1111-111111111111";

  it("sends unauthenticated users through guest bootstrap to home", () => {
    expect(pathForWorkspaceStatusError("unauthenticated", id)).toBe(
      "/auth/guest?next=/",
    );
  });

  it("sends onboarding users to onboarding", () => {
    expect(pathForWorkspaceStatusError("onboarding", id)).toBe("/onboarding");
  });

  it("sends not_found to home", () => {
    expect(pathForWorkspaceStatusError("not_found", id)).toBe("/");
  });
});
