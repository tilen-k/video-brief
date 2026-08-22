"use client";

import YouTube, { type YouTubeProps } from "react-youtube";

type WorkspacePlayerProps = {
  youtubeId: string;
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

export function WorkspacePlayer({ youtubeId }: WorkspacePlayerProps) {
  return (
    <div className="aspect-video w-full bg-muted">
      <YouTube
        videoId={youtubeId}
        opts={opts}
        className="h-full w-full"
        iframeClassName="h-full w-full"
      />
    </div>
  );
}
