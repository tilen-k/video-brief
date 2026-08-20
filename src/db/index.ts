import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Server-only Drizzle client.
 * Requires DATABASE_URL (Supabase pooler connection string recommended).
 */
export function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = postgres(url, {
    prepare: false,
    max: 1,
  });

  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
