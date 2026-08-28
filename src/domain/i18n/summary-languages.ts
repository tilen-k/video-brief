export const DEFAULT_SUMMARY_LANGUAGE = "en" as const;

/** Supported output languages (ISO 639-1 primary codes). */
export const SUMMARY_LANGUAGES = [
  { code: "af", name: "Afrikaans" },
  { code: "ar", name: "Arabic" },
  { code: "az", name: "Azerbaijani" },
  { code: "be", name: "Belarusian" },
  { code: "bg", name: "Bulgarian" },
  { code: "bn", name: "Bengali" },
  { code: "bs", name: "Bosnian" },
  { code: "ca", name: "Catalan" },
  { code: "cs", name: "Czech" },
  { code: "cy", name: "Welsh" },
  { code: "da", name: "Danish" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "et", name: "Estonian" },
  { code: "eu", name: "Basque" },
  { code: "fa", name: "Persian" },
  { code: "fi", name: "Finnish" },
  { code: "fil", name: "Filipino" },
  { code: "fr", name: "French" },
  { code: "gl", name: "Galician" },
  { code: "gu", name: "Gujarati" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hr", name: "Croatian" },
  { code: "hu", name: "Hungarian" },
  { code: "hy", name: "Armenian" },
  { code: "id", name: "Indonesian" },
  { code: "is", name: "Icelandic" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "ka", name: "Georgian" },
  { code: "kk", name: "Kazakh" },
  { code: "km", name: "Khmer" },
  { code: "kn", name: "Kannada" },
  { code: "ko", name: "Korean" },
  { code: "lt", name: "Lithuanian" },
  { code: "lv", name: "Latvian" },
  { code: "mk", name: "Macedonian" },
  { code: "ml", name: "Malayalam" },
  { code: "mn", name: "Mongolian" },
  { code: "mr", name: "Marathi" },
  { code: "ms", name: "Malay" },
  { code: "my", name: "Burmese" },
  { code: "nb", name: "Norwegian Bokmål" },
  { code: "ne", name: "Nepali" },
  { code: "nl", name: "Dutch" },
  { code: "pa", name: "Punjabi" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "si", name: "Sinhala" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "sq", name: "Albanian" },
  { code: "sr", name: "Serbian" },
  { code: "sv", name: "Swedish" },
  { code: "sw", name: "Swahili" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "zh", name: "Chinese" },
] as const;

/** Picker order: English display names A→Z. */
export const SUMMARY_LANGUAGES_FOR_SELECT = [...SUMMARY_LANGUAGES].sort(
  (a, b) => a.name.localeCompare(b.name, "en"),
);

export type SummaryLanguageCode = (typeof SUMMARY_LANGUAGES)[number]["code"];

export const SUMMARY_LANGUAGE_CODES = SUMMARY_LANGUAGES.map(
  (entry) => entry.code,
) as [SummaryLanguageCode, ...SummaryLanguageCode[]];

const NAME_BY_CODE = new Map(
  SUMMARY_LANGUAGES.map((entry) => [entry.code, entry.name] as const),
);

export function getSummaryLanguageEnglishName(code: string): string {
  return NAME_BY_CODE.get(code as SummaryLanguageCode) ?? code;
}
