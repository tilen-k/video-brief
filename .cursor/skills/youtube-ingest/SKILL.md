---
name: youtube-ingest
description: Ingest a YouTube URL into VideoBrief — validate URL, fetch metadata and English transcript via TranscriptProvider, upsert shared cache, set analysis state. Use when adding videos or changing transcript/metadata fetch.
---

# YouTube ingest

## Flow

```text
URL → parse youtubeId
  → upsert shared videos row
  → TranscriptProvider.getEnglishTranscript(youtubeId)
  → upsert video_transcripts
  → set analysis state (fetching_transcript → analyzing | failed)
  → continue domain pipeline
```

## Rules

- English captions only; if unavailable → `failed` + clear user error
- No Whisper / uploads / other sites
- Use `youtubei.js` behind `TranscriptProvider` (swappable for proxy later)
- Reuse existing shared transcript when `youtubeId` already cached
- Create per-user library row + personalized analysis record separately

## Player (workspace)

`react-youtube` only for sync: current time → active section; click → `seekTo`.

## Checklist

- [ ] URL validation
- [ ] Shared cache hit path tested
- [ ] EN transcript missing → error state
- [ ] Provider interface not hardcoded to one transport in callers
- [ ] Unit tests mock `TranscriptProvider`
