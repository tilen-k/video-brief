"use client";

import YouTube, { type YouTubeEvent, type YouTubeProps } from "react-youtube";

type WorkspacePlayerProps = {
  youtubeId: string;
  onReady: (player: {
    getCurrentTime: () => number;
    seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  }) => void;
};

const opts: YouTubeProps["opts"] = {
  width: "100%",
  height: "100%",
  playerVars: {
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
  },
};

export function WorkspacePlayer({ youtubeId, onReady }: WorkspacePlayerProps) {
  const handleReady = (event: YouTubeEvent) => {
    onReady(event.target);
  };

  return (
    <div className="aspect-video w-full bg-muted">
      <YouTube
        videoId={youtubeId}
        opts={opts}
        onReady={handleReady}
        className="h-full w-full"
        iframeClassName="h-full w-full"
      />
    </div>
  );
}
