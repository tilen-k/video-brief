/** 11-char YouTube video id. */
export const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/;

/**
 * Extract a YouTube video id from common URL shapes or a bare id.
 * Returns null when the input is not a recognizable YouTube video.
 */
export function parseYoutubeId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (YOUTUBE_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  const youtubeHosts = new Set([
    "youtube.com",
    "m.youtube.com",
    "music.youtube.com",
    "youtube-nocookie.com",
  ]);

  if (!youtubeHosts.has(host)) {
    return null;
  }

  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v") ?? "";
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  const embedMatch = url.pathname.match(
    /^\/(?:embed|shorts|live|v)\/([\w-]{11})\/?$/,
  );
  if (embedMatch?.[1] && YOUTUBE_ID_PATTERN.test(embedMatch[1])) {
    return embedMatch[1];
  }

  return null;
}
