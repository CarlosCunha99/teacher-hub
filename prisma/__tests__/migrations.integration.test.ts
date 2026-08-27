import { spawnSync } from "child_process";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { resetDatabase } from "./helpers/testDb";

const repoRoot = path.resolve(__dirname, "../..");
const hasDb = !!process.env.DATABASE_URL;

const EXPECTED_TABLES = [
  "Teacher",
  "Identity",
  "Resource",
  "Subject",
  "YearLevel",
  "ResourceSubject",
  "ResourceYearLevel",
  "Board",
  "BoardItem",
  "Like",
];

function toSnakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

describe.skipIf(!hasDb)("prisma migration lifecycle", () => {
  const client = new PrismaClient();

  afterAll(async () => {
    await resetDatabase();
    await client.$disconnect();
  });

  it("migrate deploy applies cleanly to an empty database and creates all 10 tables", async () => {
    await resetDatabase();

    const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: process.env,
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);

    const tables = await client.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
    );
    const tableNames = tables.map((t) => t.table_name.toLowerCase());

    for (const expected of EXPECTED_TABLES) {
      const matchesExact = tableNames.includes(expected.toLowerCase());
      const matchesSnakeCase = tableNames.includes(toSnakeCase(expected));
      expect(matchesExact || matchesSnakeCase).toBe(true);
    }
  }, 60_000);

  it("migrate reset leaves no partial state — reset without seed yields zero rows", async () => {
    await resetDatabase();

    const teacher = await client.teacher.create({
      data: { email: "reset-check@example.test", displayName: "Reset Check" },
    });
    await client.resource.create({
      data: {
        title: "Temp Resource",
        description: "Should not survive a reset",
        fileUrl: "https://example.test/temp.pdf",
        ownerId: teacher.id,
      },
    });

    expect(await client.teacher.count()).toBeGreaterThan(0);
    expect(await client.resource.count()).toBeGreaterThan(0);

    const result = spawnSync("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: process.env,
    });

    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);

    expect(await client.teacher.count()).toBe(0);
    expect(await client.resource.count()).toBe(0);
  }, 60_000);
});
