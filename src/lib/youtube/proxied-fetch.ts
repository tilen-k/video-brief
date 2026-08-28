import {
  fetch as undiciFetch,
  ProxyAgent,
  type RequestInit as UndiciRequestInit,
} from "undici";

import { TranscriptProviderError } from "@/lib/youtube/transcript-provider";
import {
  getYoutubeProxyConfig,
  newProxySessionId,
  stickyProxyUrl,
  type YoutubeProxyConfig,
} from "@/lib/youtube/youtube-proxy-url";

export type YoutubeFetchSession = {
  fetch: typeof fetch;
  close: () => Promise<void>;
};

function createStickyProxyAgent(config: YoutubeProxyConfig, sessionId: string): ProxyAgent {
  const sticky = new URL(stickyProxyUrl(config.url, sessionId, config.country));
  const origin = `${sticky.protocol}//${sticky.host}`;
  const user = decodeURIComponent(sticky.username);
  const password = decodeURIComponent(sticky.password);
  if (!user) {
    return new ProxyAgent(origin);
  }

  const token = `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
  return new ProxyAgent({ uri: origin, token });
}

function isRequestLike(input: unknown): input is Request {
  return (
    typeof input === "object" &&
    input !== null &&
    "url" in input &&
    typeof (input as Request).url === "string"
  );
}

function toUndiciFetchArgs(
  input: RequestInfo | URL,
  init?: RequestInit,
): { url: string; init: UndiciRequestInit } {
  if (typeof input === "string") {
    return { url: input, init: { ...(init as UndiciRequestInit | undefined) } };
  }
  if (input instanceof URL) {
    return { url: input.href, init: { ...(init as UndiciRequestInit | undefined) } };
  }
  if (!isRequestLike(input)) {
    throw new TypeError("Unsupported fetch input");
  }

  const method = init?.method ?? input.method;
  const headers = init?.headers ?? input.headers;
  const body = init?.body ?? input.body ?? undefined;
  const redirect = init?.redirect ?? input.redirect;
  const undiciInit: UndiciRequestInit = {
    method,
    headers,
    redirect,
  };
  if (body != null && body !== "") {
    undiciInit.body = body as UndiciRequestInit["body"];
    undiciInit.duplex = "half";
  }
  return { url: input.url, init: undiciInit };
}

function fetchViaProxy(agent: ProxyAgent): typeof fetch {
  return async (input, init) => {
    const { url, init: undiciInit } = toUndiciFetchArgs(input, init);
    const response = await undiciFetch(url, {
      ...undiciInit,
      dispatcher: agent,
    });
    return response as unknown as Response;
  };
}

/**
 * When YOUTUBE_PROXY_URL is set, use undici fetch + ProxyAgent (not Next/global
 * fetch, which can drop `dispatcher`). One sticky session per ingest.
 */
export function createYoutubeFetch(
  baseFetch: typeof fetch,
  sessionId: string = newProxySessionId(),
): YoutubeFetchSession {
  const config = getYoutubeProxyConfig();
  if (!config) {
    return { fetch: baseFetch, close: async () => undefined };
  }

  const agent = createStickyProxyAgent(config, sessionId);
  return {
    fetch: fetchViaProxy(agent),
    close: () => agent.close(),
  };
}

export function shouldRetryTranscriptFetch(
  error: unknown,
  proxyConfigured: boolean,
): boolean {
  if (!proxyConfigured) {
    return false;
  }
  if (
    error instanceof TranscriptProviderError &&
    error.code === "missing_captions"
  ) {
    return false;
  }
  return true;
}
