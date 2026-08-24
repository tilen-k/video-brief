"use client";

import NextTopLoader from "nextjs-toploader";

export function NavigationProgress() {
  return (
    <NextTopLoader
      color="var(--sync)"
      height={2}
      showSpinner={false}
      shadow={false}
    />
  );
}
