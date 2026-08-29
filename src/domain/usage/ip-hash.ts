import { createHmac } from "node:crypto";

const DEV_FALLBACK_SALT = "dev-usage-ip";

export function hashClientIp(ip: string): string {
  const salt = process.env.USAGE_IP_HASH_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "development") {
      return createHmac("sha256", DEV_FALLBACK_SALT)
        .update(ip)
        .digest("hex")
        .slice(0, 16);
    }
    throw new Error("USAGE_IP_HASH_SALT is not set");
  }

  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 16);
}
