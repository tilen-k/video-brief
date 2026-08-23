import pino from "pino";

export const logger = pino({
  level:
    process.env.VITEST === "true"
      ? "silent"
      : (process.env.LOG_LEVEL ??
        (process.env.NODE_ENV === "production" ? "info" : "debug")),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
});

const MAX_ERR_CHARS = 400;

function clip(value: string): string {
  if (value.length <= MAX_ERR_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_ERR_CHARS)}…`;
}

export function errorFields(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) {
    return { errMessage: clip(String(error)) };
  }

  const fields: Record<string, string> = {
    errName: error.name,
    errMessage: clip(error.message),
  };

  if (error.cause instanceof Error) {
    fields.errCauseName = error.cause.name;
    fields.errCauseMessage = clip(error.cause.message);
  } else if (error.cause != null) {
    fields.errCauseMessage = clip(String(error.cause));
  }

  return fields;
}
