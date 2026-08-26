import { afterEach, describe, expect, it, vi } from "vitest";

const getBasicInfo = vi.fn();
const innertubeCreate = vi.fn();
const shimFetch = vi.fn();
const undiciFetchMock = vi.hoisted(() => vi.fn<typeof fetch>());

vi.mock("youtubei.js", () => ({
  Innertube: {
    create: innertubeCreate,
  },
  Platform: {
    shim: {
      fetch: (...args: Parameters<typeof fetch>) => shimFetch(...args),
    },
  },
}));

vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return {
    ...actual,
    fetch: undiciFetchMock,
  };
});

import { YoutubeiTranscriptProvider } from "@/lib/youtube/youtubei-transcript-provider";
import { TranscriptProviderError } from "@/lib/youtube/transcript-provider";

const json3 = JSON.stringify({
  events: [
    {
      tStartMs: 0,
      dDurationMs: 1000,
      segs: [{ utf8: "Hello" }],
    },
  ],
});

function stubPlayerInfo(overrides?: {
  title?: string;
  category?: string | null;
  tracks?: Array<{ language_code?: string; base_url?: string; kind?: string }>;
  /** Simulate WEB getBasicInfo failure (transcript path falls back to IOS metadata). */
  webFails?: boolean;
}) {
  getBasicInfo.mockImplementation(
    async (_id: string, options?: { client?: string }) => {
      const client = options?.client ?? "WEB";

      if (client === "WEB" && overrides?.webFails) {
        throw new Error("WEB unavailable");
      }

      const isCaptionClient = client === "IOS";
      return {
        basic_info: {
          title: overrides?.title ?? "A video",
          author: "Channel",
          thumbnail: [],
          duration: 12,
          // Only WEB returns PlayerMicroformat.category.
          category: isCaptionClient
            ? null
            : (overrides?.category ?? "Education"),
        },
        captions: {
          caption_tracks: isCaptionClient
            ? (overrides?.tracks ?? [
                {
                  language_code: "en",
                  base_url: "https://www.youtube.com/api/timedtext?v=abc",
                },
              ])
            : [],
        },
      };
    },
  );
  innertubeCreate.mockResolvedValue({ getBasicInfo });
}

function expectClients(clients: string[]) {
  const called = getBasicInfo.mock.calls.map(
    (call) => (call[1] as { client?: string } | undefined)?.client,
  );
  expect(called).toEqual(clients);
}

describe("YoutubeiTranscriptProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses WEB metadata + IOS captions with the same fetch session", async () => {
    stubPlayerInfo();
    shimFetch.mockResolvedValue(new Response(json3, { status: 200 }));

    const result = await new YoutubeiTranscriptProvider().getEnglishTranscript(
      "dQw4w9WgXcQ",
    );

    expect(innertubeCreate).toHaveBeenCalledOnce();
    expectClients(["WEB", "IOS"]);
    const createArg = innertubeCreate.mock.calls[0]?.[0] as {
      fetch: typeof fetch;
    };
    expect(typeof createArg.fetch).toBe("function");
    expect(shimFetch).toHaveBeenCalledOnce();
    expect(String(shimFetch.mock.calls[0]?.[0])).toContain("fmt=json3");
    expect(result.metadata.youtubeCategoryId).toBe("Education");
    expect(result.segments).toEqual([
      { startMs: 0, endMs: 1000, text: "Hello" },
    ]);
  });

  it("attaches a proxy dispatcher to caption fetch when configured", async () => {
    vi.stubEnv("YOUTUBE_PROXY_URL", "http://myuser:s3cret@p.webshare.io:80");
    stubPlayerInfo();
    undiciFetchMock.mockResolvedValue(new Response(json3, { status: 200 }));

    await new YoutubeiTranscriptProvider().getEnglishTranscript("dQw4w9WgXcQ");

    expect(shimFetch).not.toHaveBeenCalled();
    expect(undiciFetchMock).toHaveBeenCalledOnce();
    expect(undiciFetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ dispatcher: expect.anything() }),
    );
    const createArg = innertubeCreate.mock.calls[0]?.[0] as {
      fetch: typeof fetch;
    };
    expect(createArg.fetch).not.toBe(shimFetch);
    expect(typeof createArg.fetch).toBe("function");
  });

  it("does not retry missing English captions", async () => {
    vi.stubEnv("YOUTUBE_PROXY_URL", "http://myuser:s3cret@p.webshare.io:80");
    stubPlayerInfo({ tracks: [] });

    await expect(
      new YoutubeiTranscriptProvider().getEnglishTranscript("dQw4w9WgXcQ"),
    ).rejects.toMatchObject({
      name: "TranscriptProviderError",
      code: "missing_english_captions",
      metadata: expect.objectContaining({ youtubeCategoryId: "Education" }),
    });

    expect(innertubeCreate).toHaveBeenCalledOnce();
    expectClients(["WEB", "IOS"]);
  });

  it("falls back to IOS metadata when WEB fails", async () => {
    stubPlayerInfo({ webFails: true });
    shimFetch.mockResolvedValue(new Response(json3, { status: 200 }));

    const result = await new YoutubeiTranscriptProvider().getEnglishTranscript(
      "dQw4w9WgXcQ",
    );

    expect(result.metadata).toEqual({
      youtubeId: "dQw4w9WgXcQ",
      title: "A video",
      channelTitle: "Channel",
      thumbnailUrl: null,
      durationSeconds: 12,
      youtubeCategoryId: null,
    });
    expect(result.segments).toHaveLength(1);
  });

  it("retries once with a new session when the proxy fetch fails", async () => {
    vi.stubEnv("YOUTUBE_PROXY_URL", "http://myuser:s3cret@p.webshare.io:80");
    stubPlayerInfo();
    innertubeCreate.mockReset();
    innertubeCreate
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce({ getBasicInfo });
    undiciFetchMock.mockResolvedValue(new Response(json3, { status: 200 }));

    const result = await new YoutubeiTranscriptProvider().getEnglishTranscript(
      "dQw4w9WgXcQ",
    );

    expect(innertubeCreate).toHaveBeenCalledTimes(2);
    expect(result.metadata.title).toBe("A video");
    expect(result.metadata.youtubeCategoryId).toBe("Education");
  });

  it("maps unexpected failures to provider_error", async () => {
    innertubeCreate.mockRejectedValue(new Error("boom"));

    await expect(
      new YoutubeiTranscriptProvider().getEnglishTranscript("dQw4w9WgXcQ"),
    ).rejects.toBeInstanceOf(TranscriptProviderError);
  });

  it("loads metadata via WEB without fetching captions", async () => {
    stubPlayerInfo({ category: "Science & Technology" });

    const result = await new YoutubeiTranscriptProvider().getVideoMetadata(
      "dQw4w9WgXcQ",
    );

    expectClients(["WEB"]);
    expect(result).toEqual({
      youtubeId: "dQw4w9WgXcQ",
      title: "A video",
      channelTitle: "Channel",
      thumbnailUrl: null,
      durationSeconds: 12,
      youtubeCategoryId: "Science & Technology",
    });
    expect(shimFetch).not.toHaveBeenCalled();
    expect(undiciFetchMock).not.toHaveBeenCalled();
  });
});
