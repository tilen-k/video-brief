---
name: youtube-ingest
description: Ingest a YouTube URL into VideoBrief — validate URL, fetch metadata and English transcript via TranscriptProvider, upsert per-user user_videos row, set analysis state. Use when adding videos or changing transcript/metadata fetch.
---

# YouTube ingest

## Flow

```text
URL → parse youtubeId
  → upsert stub user_videos + personalized_analyses (pending / fetching)
  → redirect to workspace
  → TranscriptProvider.getEnglishTranscript(youtubeId)  (always — no shared cache skip)
  → upsert metadata + transcript segments
  → set analysis state (fetching → classifying | failed)
  → continue domain pipeline (classify → awaiting? → generate)
```

Re-pasting the same URL refreshes **that user's** row (refetch + touch updated_at).

## Rules

- English captions only; if unavailable → `failed` + clear user error
- No Whisper / uploads / other sites
- Use `youtubei.js` behind `TranscriptProvider` (swappable for proxy later)
- **Always** call provider on ingest/re-paste — no cross-user or global transcript cache
- One row per `(user_id, youtube_id)`
- Do not block the library paste action on YouTube fetch; workspace owns fetch + errors

## Player (workspace)

`react-youtube` only for sync: current time → active section; click → `seekTo`.

## Checklist

- [ ] URL validation
- [ ] Re-paste refreshes existing user_videos row
- [ ] EN transcript missing → error state (+ metadata row when provider returns it)
- [ ] Provider interface not hardcoded to one transport in callers
- [ ] Unit tests mock `TranscriptProvider`
