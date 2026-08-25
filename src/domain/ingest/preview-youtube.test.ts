import { describe, expect, it, vi } from "vitest";

import { previewYoutubeVideo } from "./preview-youtube";
import type { TranscriptProvider } from "@/lib/youtube/transcript-provider";

describe("previewYoutubeVideo", () => {
  it("returns metadata and familiarity gate without DB writes", async () => {
    const getVideoMetadata = vi.fn(async () => ({
      youtubeId: "dQw4w9WgXcQ",
      title: "Lecture",
      channelTitle: "Channel",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      durationSeconds: 120,
      youtubeCategoryId: "27",
    }));
    const provider = {
      getVideoMetadata,
      getEnglishTranscript: vi.fn(),
    } as unknown as TranscriptProvider;

    const result = await previewYoutubeVideo("dQw4w9WgXcQ", {
      transcriptProvider: provider,
    });

    expect(getVideoMetadata).toHaveBeenCalledWith("dQw4w9WgXcQ");
    expect(result.showFamiliarity).toBe(true);
    expect(result.title).toBe("Lecture");
  });

  it("sets showFamiliarity false for non-qualifying categories", async () => {
    const provider = {
      getVideoMetadata: vi.fn(async () => ({
        youtubeId: "dQw4w9WgXcQ",
        title: "Song",
        channelTitle: "Artist",
        thumbnailUrl: null,
        durationSeconds: 200,
        youtubeCategoryId: "10",
      })),
      getEnglishTranscript: vi.fn(),
    } as unknown as TranscriptProvider;

    const result = await previewYoutubeVideo("dQw4w9WgXcQ", {
      transcriptProvider: provider,
    });

    expect(result.showFamiliarity).toBe(false);
  });
});
