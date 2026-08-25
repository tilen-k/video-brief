---
name: youtube-ingest
description: Ingest a YouTube URL into VideoBrief — Preview metadata, then Generate (upsert per-user user_videos, enqueue analysis). Use when adding videos or changing transcript/metadata fetch.
---

# YouTube ingest

## Flow

```text
URL → parse youtubeId
  → Preview: TranscriptProvider.getVideoMetadata (no DB, no usage)
  → Generate: upsert stub + prefs + new runId (pending) + usage + enqueue
  → redirect /library/[userVideoId]
  → worker: TranscriptProvider.getEnglishTranscript(youtubeId)
  → upsert metadata + transcript segments → generating → generate
```

Re-Generate on the same URL refreshes **that user's** row (refetch + new run_id).

## Rules

- Preview is metadata only; English captions are required at Generate/worker fetch
- No Whisper / uploads / other sites
- Use `youtubei.js` behind `TranscriptProvider`. Optional `YOUTUBE_PROXY_URL` is transport-only
- **Always** call provider on Generate/re-run — no cross-user or global transcript cache
- One row per `(user_id, youtube_id)`
- Do not block Generate on transcript fetch; the worker owns fetch + errors

## Player (workspace)

`react-youtube` only for sync: current time → active section; click → `seekTo`.

## Checklist

- [ ] URL validation
- [ ] Preview has no DB/usage side effects
- [ ] Re-Generate refreshes existing user_videos row
- [ ] EN transcript missing → error state (+ metadata row when provider returns it)
- [ ] Provider interface not hardcoded to one transport in callers
- [ ] Unit tests mock `TranscriptProvider`
