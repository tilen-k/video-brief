"use client";

import { useTopLoader } from "nextjs-toploader";
import { useEffect, useRef } from "react";

/** Starts the top bar while a leaving-the-page Server Action is pending. */
export function useTopLoaderOnPending(pending: boolean) {
  const loader = useTopLoader();
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    if (!pending) {
      return;
    }
    loaderRef.current.start();
    return () => {
      loaderRef.current.done();
    };
  }, [pending]);
}
