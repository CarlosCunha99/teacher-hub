import { spawnSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";

const repoRoot = path.resolve(__dirname, "../../..");

/** Prisma client configured for the test DATABASE_URL. */
export const testPrisma = new PrismaClient();

/**
 * Drops and recreates all application tables by running
 * `prisma migrate reset --force --skip-seed`. Intended for `beforeAll`/`afterAll`.
 * No-ops when `DATABASE_URL` is not set so this helper is safe to call from files
 * that also run without a live database.
 */
export async function resetDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const result = spawnSync("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
    cwd: repoRoot,
    encoding: "utf-8",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`prisma migrate reset failed with exit code ${result.status}`);
  }
}

// Delete order respects FK dependencies: children before parents.
const TABLES_IN_DELETE_ORDER = [
  "Like",
  "BoardItem",
  "ResourceYearLevel",
  "ResourceSubject",
  "Board",
  "Resource",
  "Identity",
  "Teacher",
  "YearLevel",
  "Subject",
];

/**
 * Truncates all application tables (row-level, identity reset, cascade) to keep
 * integration tests independent. Intended for `beforeEach`/`afterEach`.
 * No-ops when `DATABASE_URL` is not set.
 */
export async function truncateAll(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    return;
  }

  const quotedTables = TABLES_IN_DELETE_ORDER.map((table) => `"${table}"`).join(", ");
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE;`);
}
