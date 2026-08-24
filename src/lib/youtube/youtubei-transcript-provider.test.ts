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
  tracks?: Array<{ language_code?: string; base_url?: string; kind?: string }>;
}) {
  getBasicInfo.mockResolvedValue({
    basic_info: {
      title: overrides?.title ?? "A video",
      author: "Channel",
      thumbnail: [],
      duration: 12,
      category: null,
    },
    captions: {
      caption_tracks: overrides?.tracks ?? [
        {
          language_code: "en",
          base_url: "https://www.youtube.com/api/timedtext?v=abc",
        },
      ],
    },
  });
  innertubeCreate.mockResolvedValue({ getBasicInfo });
}

describe("YoutubeiTranscriptProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("uses the same fetch for Innertube and captions", async () => {
    stubPlayerInfo();
    shimFetch.mockResolvedValue(new Response(json3, { status: 200 }));

    const result = await new YoutubeiTranscriptProvider().getEnglishTranscript(
      "dQw4w9WgXcQ",
    );

    expect(innertubeCreate).toHaveBeenCalledOnce();
    const createArg = innertubeCreate.mock.calls[0]?.[0] as {
      fetch: typeof fetch;
    };
    expect(typeof createArg.fetch).toBe("function");
    expect(shimFetch).toHaveBeenCalledOnce();
    expect(String(shimFetch.mock.calls[0]?.[0])).toContain("fmt=json3");
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
    });

    expect(innertubeCreate).toHaveBeenCalledOnce();
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
  });

  it("maps unexpected failures to provider_error", async () => {
    innertubeCreate.mockRejectedValue(new Error("boom"));

    await expect(
      new YoutubeiTranscriptProvider().getEnglishTranscript("dQw4w9WgXcQ"),
    ).rejects.toBeInstanceOf(TranscriptProviderError);
  });
});
