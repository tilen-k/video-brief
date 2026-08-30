import type { ModelTier } from "@/db/schema";

export type UsageErrorCode =
  | "quota_exceeded"
  | "rate_limit_exceeded"
  | "usage_unavailable"
  | "too_long"
  | "transcript_too_large";

export type UsageLimitScope = "user" | "global" | "ip";

export class UsageError extends Error {
  readonly code: UsageErrorCode;
  readonly scope?: UsageLimitScope;
  readonly tier?: ModelTier;

  constructor(
    code: UsageErrorCode,
    message: string,
    options?: { cause?: unknown; scope?: UsageLimitScope; tier?: ModelTier },
  ) {
    super(message, {
      cause: options?.cause instanceof Error ? options.cause : undefined,
    });
    this.name = "UsageError";
    this.code = code;
    this.scope = options?.scope;
    this.tier = options?.tier;
  }
}

/** Error codes that refund a generate slot (pre-LLM only). */
export const REFUNDABLE_ERROR_CODES = [
  "missing_captions",
  "too_long",
  "transcript_too_large",
] as const;

export type RefundableErrorCode = (typeof REFUNDABLE_ERROR_CODES)[number];

export function isRefundableErrorCode(code: string): code is RefundableErrorCode {
  return (REFUNDABLE_ERROR_CODES as readonly string[]).includes(code);
}
