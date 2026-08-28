export type UsageErrorCode = "quota_exceeded" | "usage_unavailable" | "too_long";

export class UsageError extends Error {
  readonly code: UsageErrorCode;

  constructor(code: UsageErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, {
      cause: options?.cause instanceof Error ? options.cause : undefined,
    });
    this.name = "UsageError";
    this.code = code;
  }
}

/** Error codes that refund a monthly paste slot (pre-LLM only). */
export const REFUNDABLE_ERROR_CODES = [
  "missing_captions",
  "too_long",
] as const;

export type RefundableErrorCode = (typeof REFUNDABLE_ERROR_CODES)[number];

export function isRefundableErrorCode(code: string): code is RefundableErrorCode {
  return (REFUNDABLE_ERROR_CODES as readonly string[]).includes(code);
}
