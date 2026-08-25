import pino from "pino";
import pretty from "pino-pretty";

const isTest = process.env.VITEST === "true";
const isProd = process.env.NODE_ENV === "production";
const prettyEnabled =
  !isTest &&
  process.env.LOG_PRETTY !== "0" &&
  (process.env.LOG_PRETTY === "1" || !isProd);

const level = isTest
  ? "silent"
  : (process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"));

export const logger = pino(
  {
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  prettyEnabled
    ? pretty({
        colorize: true,
        translateTime: "SYS:HH:MM:ss.l",
        ignore: "pid,hostname",
        sync: true,
      })
    : undefined,
);

const MAX_ERR_CHARS = 500;
const MAX_COMPLETION_CHARS = 4_000;

function clip(value: string, max = MAX_ERR_CHARS): string {
  const redacted = value.replace(/:\/\/[^/@]+@/g, "://***@");
  if (redacted.length <= max) {
    return redacted;
  }
  return `${redacted.slice(0, max)}…`;
}

/** Shorten SDK JSON-parse messages that embed the raw completion. */
function shortenCauseMessage(message: string): string {
  const stripped = message
    .replace(/^JSON parsing failed:\s*/i, "")
    .replace(/^Text:\s*[\s\S]*?\nError message:\s*/i, "")
    .replace(/^SyntaxError:\s*/i, "");
  return clip(stripped.trim() || message);
}

type ErrorWithText = Error & {
  text?: unknown;
  finishReason?: unknown;
  response?: { id?: unknown };
};

function asErrorWithExtras(error: unknown): ErrorWithText | null {
  return error instanceof Error ? (error as ErrorWithText) : null;
}

function completionFromError(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current != null; depth++) {
    const err = asErrorWithExtras(current);
    if (err && typeof err.text === "string" && err.text.length > 0) {
      return err.text;
    }
    current = err?.cause;
  }
  return undefined;
}

function finishReasonFromError(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current != null; depth++) {
    const err = asErrorWithExtras(current);
    if (err && typeof err.finishReason === "string") {
      return err.finishReason;
    }
    current = err?.cause;
  }
  return undefined;
}

function responseIdFromError(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6 && current != null; depth++) {
    const err = asErrorWithExtras(current);
    const id = err?.response?.id;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
    current = err?.cause;
  }
  return undefined;
}

/**
 * Structured fields for logs. Prefer a readable cause chain over nested blobs.
 */
export function errorFields(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) {
    return { err: clip(String(error)) };
  }

  const chain: string[] = [];
  let current: Error | undefined = error;
  for (let depth = 0; depth < 5 && current; depth++) {
    const message =
      depth === 0 ? clip(current.message) : shortenCauseMessage(current.message);
    chain.push(`${current.name}: ${message}`);
    current = current.cause instanceof Error ? current.cause : undefined;
  }

  const fields: Record<string, string> = {
    err: chain[0]!,
  };
  if (chain[1]) fields.cause = chain[1];
  if (chain[2]) fields.cause2 = chain[2];
  if (chain.length > 3) fields.causeDeep = chain.slice(3).join(" ← ");

  return fields;
}

/** LLM-stage fields: cause chain plus raw completion when the SDK exposed it. */
export function llmErrorFields(error: unknown): Record<string, string> {
  const fields = errorFields(error);
  const completion = completionFromError(error);
  if (completion !== undefined) {
    fields.completion = clip(completion, MAX_COMPLETION_CHARS);
  }
  const finishReason = finishReasonFromError(error);
  if (finishReason !== undefined) {
    fields.finishReason = finishReason;
  }
  const responseId = responseIdFromError(error);
  if (responseId !== undefined) {
    fields.responseId = responseId;
  }
  return fields;
}
