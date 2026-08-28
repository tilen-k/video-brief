import { afterEach, describe, expect, it, vi } from "vitest";

const undiciFetchMock = vi.hoisted(() =>
  vi.fn<typeof fetch>(async () => new Response("ok")),
);

vi.mock("undici", async (importOriginal) => {
  const actual = await importOriginal<typeof import("undici")>();
  return {
    ...actual,
    fetch: undiciFetchMock,
  };
});

import {
  createYoutubeFetch,
  shouldRetryTranscriptFetch,
} from "@/lib/youtube/proxied-fetch";
import { TranscriptProviderError } from "@/lib/youtube/transcript-provider";

describe("createYoutubeFetch", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    undiciFetchMock.mockClear();
  });

  it("returns the base fetch when no proxy is configured", async () => {
    vi.stubEnv("YOUTUBE_PROXY_URL", "");
    const baseFetch = vi.fn(async () => new Response("ok"));
    const session = createYoutubeFetch(baseFetch);
    expect(session.fetch).toBe(baseFetch);
    await session.close();
  });

  it("uses undici fetch with a dispatcher when a gateway is set", async () => {
    vi.stubEnv("YOUTUBE_PROXY_URL", "http://myuser:s3cret@p.webshare.io:80");
    vi.stubEnv("YOUTUBE_PROXY_COUNTRY", "us");

    const baseFetch = vi.fn(async () => new Response("ok"));
    const session = createYoutubeFetch(baseFetch, "847291");
    expect(session.fetch).not.toBe(baseFetch);

    await session.fetch("https://www.youtube.com/youtubei/v1/player");

    expect(baseFetch).not.toHaveBeenCalled();
    expect(undiciFetchMock).toHaveBeenCalledOnce();
    expect(undiciFetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ dispatcher: expect.anything() }),
    );

    await session.close();
  });

  it("unwraps a Request object so undici receives a URL string", async () => {
    vi.stubEnv("YOUTUBE_PROXY_URL", "http://myuser:s3cret@p.webshare.io:80");
    const session = createYoutubeFetch(
      vi.fn(async () => new Response("ok")),
      "847291",
    );

    await session.fetch(
      new Request("https://www.youtube.com/youtubei/v1/player", {
        method: "POST",
      }),
      { body: "{\"context\":{}}" },
    );

    expect(undiciFetchMock.mock.calls[0]?.[0]).toBe(
      "https://www.youtube.com/youtubei/v1/player",
    );
    expect(undiciFetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        dispatcher: expect.anything(),
      }),
    );

    await session.close();
  });
});

describe("shouldRetryTranscriptFetch", () => {
  it("does not retry when no proxy is configured", () => {
    expect(shouldRetryTranscriptFetch(new Error("blocked"), false)).toBe(false);
  });

  it("does not retry missing captions", () => {
    expect(
      shouldRetryTranscriptFetch(
        new TranscriptProviderError(
          "missing_captions",
          "This video has no captions in your chosen language or the video's original language.",
        ),
        true,
      ),
    ).toBe(false);
  });

  it("retries other failures when a proxy is configured", () => {
    expect(shouldRetryTranscriptFetch(new Error("ECONNRESET"), true)).toBe(
      true,
    );
  });
});
