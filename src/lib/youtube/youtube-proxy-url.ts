import { randomInt } from "node:crypto";

export type YoutubeProxyConfig = {
  url: string;
  country: string | null;
};

const COUNTRY_RE = /^[a-z]{2}$/i;

function readTrimmed(env: NodeJS.Dict<string>, key: string): string | undefined {
  const value = env[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Parse YouTube proxy env. Unset URL → no proxy (typical local).
 * Invalid URL/country throws so a bad Vercel env fails ingest instead of going direct.
 */
export function parseYoutubeProxyConfig(
  env: NodeJS.Dict<string>,
): YoutubeProxyConfig | null {
  const rawUrl = readTrimmed(env, "YOUTUBE_PROXY_URL");
  if (!rawUrl) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("YOUTUBE_PROXY_URL must be a valid http(s) proxy URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("YOUTUBE_PROXY_URL must use http or https");
  }
  if (!parsed.hostname) {
    throw new Error("YOUTUBE_PROXY_URL must include a hostname");
  }

  const rawCountry = readTrimmed(env, "YOUTUBE_PROXY_COUNTRY");
  if (rawCountry && !COUNTRY_RE.test(rawCountry)) {
    throw new Error("YOUTUBE_PROXY_COUNTRY must be a 2-letter ISO code");
  }

  return {
    url: parsed.toString(),
    country: rawCountry ? rawCountry.toLowerCase() : null,
  };
}

export function getYoutubeProxyConfig(): YoutubeProxyConfig | null {
  return parseYoutubeProxyConfig(process.env);
}

export function newProxySessionId(): string {
  return String(randomInt(1, 2_147_483_647));
}

/**
 * Webshare backbone sticky session: `{user}-{country?}-{sessionId}` as username.
 * If the gateway username already contains `-`, it is treated as fully targeted
 * (e.g. `user-GB-1`) and left unchanged — appending another session id breaks auth.
 * No-op when the gateway has no username (IP auth).
 */
export function stickyProxyUrl(
  gatewayUrl: string,
  sessionId: string,
  country?: string | null,
): string {
  const url = new URL(gatewayUrl);
  const user = decodeURIComponent(url.username);
  if (!user) {
    return url.toString();
  }
  if (user.includes("-")) {
    return url.toString();
  }

  const parts = [user];
  if (country) {
    parts.push(country);
  }
  parts.push(sessionId);
  url.username = parts.join("-");
  return url.toString();
}
