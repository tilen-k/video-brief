import { languageCodesMatch, normalizeLanguageCode } from "@/domain/i18n/summary-language";

export type CaptionTrackLike = {
  language_code?: string;
  kind?: string;
};

type AudioTrackLike = {
  caption_track_indices?: number[];
  default_caption_track_index?: number;
};

type CaptionsLike = {
  caption_tracks?: CaptionTrackLike[];
  audio_tracks?: AudioTrackLike[];
  default_audio_track_index?: number;
};

export function inferPrimaryCaptionLanguage(
  captions: CaptionsLike | null | undefined,
): string | null {
  const tracks = captions?.caption_tracks ?? [];
  if (tracks.length === 0) {
    return null;
  }

  const audioTracks = captions?.audio_tracks ?? [];
  const defaultAudioIndex = captions?.default_audio_track_index ?? 0;
  const defaultAudio = audioTracks[defaultAudioIndex] ?? audioTracks[0];
  if (defaultAudio) {
    const captionIndex =
      defaultAudio.default_caption_track_index ??
      defaultAudio.caption_track_indices?.[0];
    if (captionIndex != null) {
      const track = tracks[captionIndex];
      const code = normalizeLanguageCode(track?.language_code);
      if (code) {
        return code;
      }
    }
  }

  const manualTrack = tracks.find((track) => track.kind !== "asr");
  return (
    normalizeLanguageCode(manualTrack?.language_code) ??
    normalizeLanguageCode(tracks[0]?.language_code)
  );
}

export function pickCaptionTrack<T extends CaptionTrackLike>(
  tracks: T[],
  preferredLanguage: string,
  primaryLanguage: string | null,
): T | undefined {
  const tryLanguage = (language: string | null, allowAsr: boolean): T | undefined => {
    if (!language) {
      return undefined;
    }
    if (!allowAsr) {
      return tracks.find(
        (track) =>
          languageCodesMatch(track.language_code, language) && track.kind !== "asr",
      );
    }
    return tracks.find((track) => languageCodesMatch(track.language_code, language));
  };

  return (
    tryLanguage(preferredLanguage, false) ??
    tryLanguage(primaryLanguage, false) ??
    tryLanguage(preferredLanguage, true) ??
    tryLanguage(primaryLanguage, true)
  );
}
