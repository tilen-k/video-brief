"use client";

import { useEffect, useRef, useState } from "react";

type YoutubePlayer = {
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

const POLL_MS = 250;

export function usePlayerSync() {
  const playerRef = useRef<YoutubePlayer | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) {
        return;
      }
      const next = player.getCurrentTime();
      if (typeof next === "number" && Number.isFinite(next)) {
        setCurrentTime(next);
      }
    }, POLL_MS);

    return () => window.clearInterval(id);
  }, []);

  return {
    currentTime,
    onReady: (player: YoutubePlayer) => {
      playerRef.current = player;
    },
    seekTo: (seconds: number) => {
      playerRef.current?.seekTo(seconds, true);
    },
  };
}
