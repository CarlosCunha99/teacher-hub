import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://localhost:5432/teacher_hub";

type Database = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __teacherHubDb__: Database | undefined;
}

function createDb(): Database {
  const client = postgres(DATABASE_URL, {
    prepare: false,
  });

  return drizzle(client, { schema });
}

export const db = globalThis.__teacherHubDb__ ?? createDb();

if (process.env.NODE_ENV !== "production") {
  globalThis.__teacherHubDb__ = db;
}
