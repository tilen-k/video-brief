import { describe, expect, it } from "vitest";

import {
  parseYoutubeProxyConfig,
  stickyProxyUrl,
} from "@/lib/youtube/youtube-proxy-url";

const GATEWAY = "http://myuser:s3cret@p.webshare.io:80";

describe("parseYoutubeProxyConfig", () => {
  it("returns null when YOUTUBE_PROXY_URL is unset or blank", () => {
    expect(parseYoutubeProxyConfig({})).toBeNull();
    expect(parseYoutubeProxyConfig({ YOUTUBE_PROXY_URL: "  " })).toBeNull();
  });

  it("parses a gateway URL and optional country", () => {
    expect(
      parseYoutubeProxyConfig({
        YOUTUBE_PROXY_URL: GATEWAY,
        YOUTUBE_PROXY_COUNTRY: "US",
      }),
    ).toEqual({
      url: "http://myuser:s3cret@p.webshare.io/",
      country: "us",
    });
  });

  it("rejects a non-http URL", () => {
    expect(() =>
      parseYoutubeProxyConfig({ YOUTUBE_PROXY_URL: "socks5://p.webshare.io:80" }),
    ).toThrow(/http or https/);
  });

  it("rejects a malformed country", () => {
    expect(() =>
      parseYoutubeProxyConfig({
        YOUTUBE_PROXY_URL: GATEWAY,
        YOUTUBE_PROXY_COUNTRY: "usa",
      }),
    ).toThrow(/2-letter/);
  });
});

describe("stickyProxyUrl", () => {
  it("appends a numeric session id to the username", () => {
    const sticky = stickyProxyUrl(GATEWAY, "847291");
    const parsed = new URL(sticky);
    expect(decodeURIComponent(parsed.username)).toBe("myuser-847291");
    expect(decodeURIComponent(parsed.password)).toBe("s3cret");
    expect(parsed.hostname).toBe("p.webshare.io");
    expect(parsed.protocol).toBe("http:");
  });

  it("inserts country before the session id", () => {
    const sticky = stickyProxyUrl(GATEWAY, "847291", "us");
    expect(decodeURIComponent(new URL(sticky).username)).toBe(
      "myuser-us-847291",
    );
  });

  it("leaves already-targeted usernames unchanged", () => {
    const targeted = "http://myuser-GB-1:s3cret@p.webshare.io:80";
    const sticky = stickyProxyUrl(targeted, "847291", "us");
    expect(decodeURIComponent(new URL(sticky).username)).toBe("myuser-GB-1");
  });

  it("leaves IP-auth URLs unchanged", () => {
    const direct = "http://p.webshare.io:80";
    expect(stickyProxyUrl(direct, "847291", "us")).toBe("http://p.webshare.io/");
  });
});
