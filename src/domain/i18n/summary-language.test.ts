import { describe, expect, it } from "vitest";

import {
  inferSummaryLanguageFromAcceptLanguage,
  languageCodesMatch,
  normalizeLanguageCode,
} from "@/domain/i18n/summary-language";
import {
  inferPrimaryCaptionLanguage,
  pickCaptionTrack,
} from "@/lib/youtube/pick-caption-track";

describe("summary-language helpers", () => {
  it("normalizes BCP-47 tags to primary subtags", () => {
    expect(normalizeLanguageCode("de-DE")).toBe("de");
    expect(normalizeLanguageCode("EN_us")).toBe("en");
  });

  it("matches language codes by primary subtag", () => {
    expect(languageCodesMatch("de-DE", "de")).toBe(true);
    expect(languageCodesMatch("en", "de")).toBe(false);
  });

  it("infers German from Accept-Language when supported", () => {
    expect(inferSummaryLanguageFromAcceptLanguage("de-DE,de;q=0.9,en;q=0.8")).toBe(
      "de",
    );
    expect(inferSummaryLanguageFromAcceptLanguage("en-US,en;q=0.9")).toBe("en");
    expect(inferSummaryLanguageFromAcceptLanguage(null)).toBe("en");
  });
});

describe("pickCaptionTrack", () => {
  const tracks = [
    { language_code: "en", kind: "asr", base_url: "https://en-asr" },
    { language_code: "de", base_url: "https://de" },
    { language_code: "fr", base_url: "https://fr" },
  ];

  it("prefers manual captions in the requested language", () => {
    expect(
      pickCaptionTrack(tracks, "de", "en")?.base_url,
    ).toBe("https://de");
  });

  it("falls back to the video primary language", () => {
    expect(
      pickCaptionTrack(
        [{ language_code: "en", base_url: "https://en" }],
        "de",
        "en",
      )?.base_url,
    ).toBe("https://en");
  });

  it("allows ASR when no manual track matches", () => {
    expect(
      pickCaptionTrack(
        [{ language_code: "en", kind: "asr", base_url: "https://en-asr" }],
        "en",
        "fr",
      )?.base_url,
    ).toBe("https://en-asr");
  });

  it("infers primary language from default audio track metadata", () => {
    expect(
      inferPrimaryCaptionLanguage({
        caption_tracks: [
          { language_code: "en" },
          { language_code: "de" },
        ],
        audio_tracks: [{ caption_track_indices: [1] }],
        default_audio_track_index: 0,
      }),
    ).toBe("de");
  });

  it("matches YouTube caption aliases for supported output codes", () => {
    expect(
      pickCaptionTrack(
        [{ language_code: "tl", base_url: "https://tl" }],
        "fil",
        null,
      )?.base_url,
    ).toBe("https://tl");
    expect(
      pickCaptionTrack(
        [{ language_code: "iw", base_url: "https://iw" }],
        "he",
        null,
      )?.base_url,
    ).toBe("https://iw");
    expect(
      pickCaptionTrack(
        [{ language_code: "no", base_url: "https://no" }],
        "nb",
        null,
      )?.base_url,
    ).toBe("https://no");
  });
});
