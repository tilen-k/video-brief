import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output } from "ai";

import { analysisConfig } from "@/domain/analysis/config";
import { generateSectionsSchema } from "@/domain/analysis/schemas";
import { getSummaryLanguageEnglishName } from "@/domain/i18n/summary-languages";
import { languageCodesMatch } from "@/domain/i18n/summary-language";
import { llmErrorFields, logger } from "@/lib/logger";

import {
  AIProviderError,
  type AIProvider,
  type GenerateSectionsInput,
} from "./provider";

const { maxSections } = analysisConfig.generate;

export const GENERATE_SYSTEM = `You write a personalized overview and timed section notes of a YouTube video from its transcript.
Respond with a JSON object only: {"summary":"...","sections":[{"title":"...","startTime":0,"endTime":45,"body":"..."},{"title":"...","startTime":45,"endTime":120,"body":"..."}]}
summary is a standalone overview the viewer can read instead of watching (about 1500–2000 characters total).
Write the summary as multiple short paragraphs separated by blank lines (\\n\\n) — paragraph count follows the per-video length preference in the user prompt.
Each section needs a title, startTime and endTime in seconds from the start of the video, and a body for seek/highlight.
startTime and endTime are absolute timestamps (not durations). endTime must be greater than startTime.
Every startTime and endTime must be within 0 and the video duration (inclusive) — never invent times past the end of the video.
Use the transcript [seconds] markers as the time source (integer seconds from the start of the video).
Write synthesized prose in complete sentences — summarize ideas, arguments, and takeaways.
Do not quote the transcript verbatim, reproduce dialogue line-by-line, or list who said what.
For interviews, debates, or Q&A, explain the main positions and conclusions rather than repeating answers.
Stay faithful to the transcript — do not invent facts that are not in the source.
Write the summary and every section title and body in the requested output language.
When the transcript language differs from the output language, translate faithfully while preserving meaning.
Use the viewer's per-video prefs only to change depth, framing, formality, and length — not to add unrelated content.
Return 1–${maxSections} sections that cover the video in chronological order by startTime. Short videos may have a single section.`;

function formatDurationClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function durationLabel(seconds: number | null): string {
  if (seconds == null) {
    return "unknown";
  }
  return `${seconds} seconds (${formatDurationClock(seconds)}). All startTime/endTime values must be between 0 and ${seconds}`;
}

export function summaryParagraphCount(summaryLength: number): number {
  if (summaryLength <= 40) {
    return 2;
  }
  if (summaryLength <= 70) {
    return 3;
  }
  return 4;
}

export function summaryParagraphGuidance(summaryLength: number): string {
  const count = summaryParagraphCount(summaryLength);
  return `Write the summary as ${count} short paragraphs separated by blank lines (\\n\\n). Each paragraph should be 2–4 sentences.`;
}

export function buildGeneratePrompt(input: GenerateSectionsInput): string {
  const { prefs } = input;
  const outputLanguageName = getSummaryLanguageEnglishName(input.outputLanguage);
  const transcriptLanguageName = getSummaryLanguageEnglishName(
    input.transcriptLanguage,
  );
  const translationNote = languageCodesMatch(
    input.transcriptLanguage,
    input.outputLanguage,
  )
    ? null
    : "The transcript is not in the output language — translate while staying faithful to the source.";
  const familiarityLine =
    prefs.familiarity != null
      ? `Familiarity with topic (0–100, Novice←→Expert): ${prefs.familiarity}`
      : null;

  return `Title: ${input.title}
Channel: ${input.channelTitle ?? "unknown"}
Duration: ${durationLabel(input.durationSeconds)}
Output language: ${outputLanguageName} (${input.outputLanguage})
Transcript language: ${transcriptLanguageName} (${input.transcriptLanguage})
${translationNote ? `${translationNote}\n` : ""}${familiarityLine ? `${familiarityLine}\n` : ""}Requested length (0–100, Short←→Long): ${prefs.summaryLength}
Requested tone (0–100, Formal←→Casual): ${prefs.summaryTone}
${summaryParagraphGuidance(prefs.summaryLength)}

Transcript:
${input.transcriptSubset}`;
}

function requireApiKey(): string {
  const apiKey = process.env[analysisConfig.model.apiKeyEnv];
  if (!apiKey) {
    throw new AIProviderError(`${analysisConfig.model.apiKeyEnv} is not set`);
  }
  return apiKey;
}

function createModel(apiKey: string, modelId: string) {
  const openrouter = createOpenRouter({
    apiKey,
    compatibility: "strict",
    appName: "VideoBrief",
    appUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://videobrief.app",
  });
  return openrouter(modelId, {
    plugins: [{ id: "response-healing" }],
  });
}

export class OpenRouterAIProvider implements AIProvider {
  private readonly modelId: string;
  private readonly maxOutputTokens: number;

  constructor(
    modelId: string = analysisConfig.models.basicId,
    maxOutputTokens: number = analysisConfig.modelTiers.basic.maxOutputTokens,
  ) {
    this.modelId = modelId;
    this.maxOutputTokens = maxOutputTokens;
  }

  async generateSections(input: GenerateSectionsInput) {
    const model = createModel(requireApiKey(), this.modelId);
    const started = Date.now();
    const log = logger.child({
      stage: "generate",
      modelId: this.modelId,
      transcriptChars: input.transcriptSubset.length,
    });

    try {
      const { output } = await generateText({
        model,
        output: Output.object({
          name: "Sections",
          description:
            "JSON object with a summary string and a sections array of title, startTime, endTime, body",
          schema: generateSectionsSchema,
        }),
        system: GENERATE_SYSTEM,
        prompt: buildGeneratePrompt(input),
        timeout: analysisConfig.model.timeoutMs,
        maxRetries: analysisConfig.model.maxRetries,
        maxOutputTokens: this.maxOutputTokens,
      });

      if (output == null) {
        throw new AIProviderError("Model returned no structured output");
      }

      const parsed = generateSectionsSchema.parse(output);
      log.info({ llmMs: Date.now() - started }, "llm.ok");
      return parsed;
    } catch (error) {
      log.warn(
        { llmMs: Date.now() - started, ...llmErrorFields(error) },
        "llm.err",
      );
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError("Could not generate sections for this video", {
        cause: error,
      });
    }
  }
}
