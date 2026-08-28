export type BillingErrorCode =
  | "billing_unavailable"
  | "already_pro"
  | "subscription_in_progress"
  | "no_customer"
  | "not_found";

export class BillingError extends Error {
  readonly code: BillingErrorCode;

  constructor(code: BillingErrorCode, message: string) {
    super(message);
    this.name = "BillingError";
    this.code = code;
  }
}
