import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";

import { analysisConfig } from "@/domain/analysis/config";
import { repairClassifyText } from "@/domain/analysis/repair-classify-text";
import {
  classifyVideoSchema,
  generateSectionsSchema,
} from "@/domain/analysis/schemas";
import { errorFields, logger } from "@/lib/logger";

import {
  AIProviderError,
  type AIProvider,
  type ClassifyVideoInput,
  type GenerateSectionsInput,
} from "./provider";

const { maxSections, maxOutputTokens } = analysisConfig.generate;

const CLASSIFY_SYSTEM = `You classify a YouTube video for an education-first, personalized summary product.
Respond with a JSON object only — no prose, no CSV, no markdown.
Shape: {"isEducational":true,"confidence":"high","topic":"short noun phrase"}
confidence must be one of: high, medium, low.
Omit topic when none fits.
YouTube category is a hint only — do not treat it as ground truth.
If the video might teach or explain something, set isEducational true.
If confidence is low or the label is ambiguous, still prefer educational.
Do not invent facts. Do not emit sections, questions, domains, or extra keys.`;

const GENERATE_SYSTEM = `You write personalized section summaries of a YouTube video from its transcript.
Respond with a JSON object only: {"sections":[{"title":"...","startTime":0,"endTime":12,"body":"..."}]}
Each section needs a title, startTime and endTime in seconds, and a body.
Stay faithful to the transcript — do not invent facts that are not in the source.
Use the viewer's profile and per-video prefs only to change depth, framing, and length — not to add unrelated content.
Return 1–${maxSections} sections that cover the video. Short videos may have a single section.`;

function durationLabel(seconds: number | null): string {
  return seconds != null ? `${seconds} seconds` : "unknown";
}

function buildClassifyPrompt(input: ClassifyVideoInput): string {
  return `Title: ${input.title}
Channel: ${input.channelTitle ?? "unknown"}
Duration: ${durationLabel(input.durationSeconds)}
YouTube category id (hint only): ${input.youtubeCategoryId ?? "unknown"}

Transcript excerpt:
${input.transcriptExcerpt}`;
}

function buildGeneratePrompt(input: GenerateSectionsInput): string {
  const { profile, prefs, classification } = input;
  const subjects = profile.subjects?.join(", ") || "none given";

  return `Title: ${input.title}
Channel: ${input.channelTitle ?? "unknown"}
Duration: ${durationLabel(input.durationSeconds)}
Educational: ${classification.isEducational}
Topic: ${classification.topic ?? "none"}
Viewer year of birth: ${profile.yearOfBirth ?? "unknown"}
Education level: ${profile.educationLevel ?? "unknown"}
Subjects of interest: ${subjects}
Summary style default: ${profile.summaryStyle ?? "none"}
Familiarity with topic: ${prefs.familiarity ?? "not specified"}
Requested length: ${prefs.summaryLength ?? "not specified"}

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

  constructor(modelId: string = analysisConfig.models.basicId) {
    this.modelId = modelId;
  }

  async classifyVideo(input: ClassifyVideoInput) {
    const model = createModel(requireApiKey(), this.modelId);
    const started = Date.now();
    const log = logger.child({
      stage: "classify",
      modelId: this.modelId,
      excerptChars: input.transcriptExcerpt.length,
    });

    try {
      const { output } = await generateText({
        model,
        output: Output.object({
          name: "Classification",
          description:
            "JSON object with isEducational, confidence, and optional topic",
          schema: classifyVideoSchema,
        }),
        system: CLASSIFY_SYSTEM,
        prompt: buildClassifyPrompt(input),
        temperature: 0,
        timeout: analysisConfig.model.timeoutMs,
        maxRetries: analysisConfig.model.maxRetries,
      });

      if (output == null) {
        throw new AIProviderError("Model returned no structured output");
      }

      const parsed = classifyVideoSchema.parse(output);
      log.info({ llmMs: Date.now() - started }, "llm.ok");
      return parsed;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        const repaired = repairClassifyText(error.text);
        if (repaired) {
          log.info(
            { llmMs: Date.now() - started, repaired: true },
            "llm.ok",
          );
          return repaired;
        }
      }

      log.warn(
        { llmMs: Date.now() - started, ...errorFields(error) },
        "llm.err",
      );
      if (error instanceof AIProviderError) {
        throw error;
      }
      throw new AIProviderError("Could not classify this video", {
        cause: error,
      });
    }
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
            "JSON object with a sections array of title, startTime, endTime, body",
          schema: generateSectionsSchema,
        }),
        system: GENERATE_SYSTEM,
        prompt: buildGeneratePrompt(input),
        timeout: analysisConfig.model.timeoutMs,
        maxRetries: analysisConfig.model.maxRetries,
        maxOutputTokens,
      });

      if (output == null) {
        throw new AIProviderError("Model returned no structured output");
      }

      const parsed = generateSectionsSchema.parse(output);
      log.info({ llmMs: Date.now() - started }, "llm.ok");
      return parsed;
    } catch (error) {
      log.warn(
        { llmMs: Date.now() - started, ...errorFields(error) },
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
