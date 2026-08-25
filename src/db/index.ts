import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
  postgresSql?: Sql;
  drizzleDb?: Db;
};

function formatDbConnectError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : "";

  if (
    code === "ENETUNREACH" ||
    message.includes("ENETUNREACH") ||
    message.includes("network is unreachable")
  ) {
    return new Error(
      "DATABASE_URL points at an IPv6-only direct host (db.*.supabase.co:5432) " +
        "that this network cannot reach. In Supabase Dashboard → Connect, copy the " +
        "Transaction pooler URI (*.pooler.supabase.com:6543, user postgres.<project_ref>) " +
        "into DATABASE_URL. See .env.example.",
      { cause: error instanceof Error ? error : undefined },
    );
  }

  return error instanceof Error ? error : new Error(message);
}

function isAnalysisWorkerProcess(): boolean {
  return (
    process.env.ANALYSIS_WORKER === "1" ||
    process.env.npm_lifecycle_event === "worker" ||
    process.env.npm_lifecycle_event === "worker:prod"
  );
}

/**
 * Drizzle client for the Next.js app and the analysis worker.
 * Requires DATABASE_URL — prefer Supabase Transaction pooler (IPv4).
 */
export function createDb(): Db {
  if (globalForDb.drizzleDb) {
    return globalForDb.drizzleDb;
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  try {
    const client =
      globalForDb.postgresSql ??
      postgres(url, {
        prepare: false,
        max: isAnalysisWorkerProcess() ? 4 : 1,
      });

    const db = drizzle(client, { schema });

    globalForDb.postgresSql = client;
    globalForDb.drizzleDb = db;

    return db;
  } catch (error) {
    throw formatDbConnectError(error);
  }
}

export type { Db };
