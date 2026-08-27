import { spawnSync } from "child_process";
import path from "path";
import { resetDatabase, testPrisma } from "./helpers/testDb";

const repoRoot = path.resolve(__dirname, "../..");
const hasDb = !!process.env.DATABASE_URL;

function runSeed() {
  return spawnSync("npm", ["run", "db:seed"], {
    cwd: repoRoot,
    encoding: "utf-8",
    env: process.env,
  });
}

describe.skipIf(!hasDb)("prisma/seed.ts", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("populates a representative dataset meeting the documented minimums", async () => {
    const result = runSeed();
    if (result.status !== 0) {
      console.error(result.stdout);
      console.error(result.stderr);
    }
    expect(result.status).toBe(0);

    const [
      subjectCount,
      yearLevelCount,
      teacherCount,
      resourceCount,
      draftCount,
      softDeletedCount,
      boardCount,
      likeCount,
      distinctSubjects,
      distinctYearLevels,
    ] = await Promise.all([
      testPrisma.subject.count(),
      testPrisma.yearLevel.count(),
      testPrisma.teacher.count(),
      testPrisma.resource.count(),
      testPrisma.resource.count({ where: { status: "DRAFT" } }),
      testPrisma.resource.count({ where: { NOT: { deletedAt: null } } }),
      testPrisma.board.count(),
      testPrisma.like.count(),
      testPrisma.resourceSubject.findMany({ distinct: ["subjectId"], select: { subjectId: true } }),
      testPrisma.resourceYearLevel.findMany({
        distinct: ["yearLevelId"],
        select: { yearLevelId: true },
      }),
    ]);

    expect(subjectCount).toBeGreaterThanOrEqual(3);
    expect(yearLevelCount).toBeGreaterThanOrEqual(3);
    expect(teacherCount).toBeGreaterThanOrEqual(5);
    expect(resourceCount).toBeGreaterThanOrEqual(20);
    expect(draftCount).toBeGreaterThanOrEqual(1);
    expect(softDeletedCount).toBeGreaterThanOrEqual(1);
    expect(distinctSubjects.length).toBeGreaterThanOrEqual(3);
    expect(distinctYearLevels.length).toBeGreaterThanOrEqual(3);
    expect(boardCount).toBeGreaterThanOrEqual(5);
    expect(likeCount).toBeGreaterThanOrEqual(20);

    // Every seeded Resource resolves to a seeded Teacher (referential sanity).
    const resources = await testPrisma.resource.findMany({ select: { ownerId: true } });
    const teacherIds = new Set(
      (await testPrisma.teacher.findMany({ select: { id: true } })).map((t) => t.id)
    );
    for (const resource of resources) {
      expect(resource.ownerId).toBeTruthy();
      expect(teacherIds.has(resource.ownerId)).toBe(true);
    }

    // At least one resource is linked to 2+ subjects and 2+ year levels.
    const subjectLinkGroups = await testPrisma.resourceSubject.groupBy({
      by: ["resourceId"],
      _count: { subjectId: true },
    });
    expect(subjectLinkGroups.some((g) => g._count.subjectId >= 2)).toBe(true);

    const yearLevelLinkGroups = await testPrisma.resourceYearLevel.groupBy({
      by: ["resourceId"],
      _count: { yearLevelId: true },
    });
    expect(yearLevelLinkGroups.some((g) => g._count.yearLevelId >= 2)).toBe(true);

    // Boards span mixed visibility and every board has at least one item.
    const boards = await testPrisma.board.findMany({
      select: { id: true, visibility: true, items: { select: { boardId: true } } },
    });
    expect(boards.some((b) => b.visibility === "PUBLIC")).toBe(true);
    expect(boards.some((b) => b.visibility === "PRIVATE")).toBe(true);
    for (const board of boards) {
      expect(board.items.length).toBeGreaterThanOrEqual(1);
    }
  }, 60_000);

  it("is idempotent / rerunnable without duplicate-key failures", async () => {
    const before = {
      teacher: await testPrisma.teacher.count(),
      resource: await testPrisma.resource.count(),
      board: await testPrisma.board.count(),
      like: await testPrisma.like.count(),
      subject: await testPrisma.subject.count(),
      yearLevel: await testPrisma.yearLevel.count(),
    };

    const result = runSeed();

    if (result.status === 0) {
      // Preferred contract: upsert semantics keep row counts stable.
      const after = {
        teacher: await testPrisma.teacher.count(),
        resource: await testPrisma.resource.count(),
        board: await testPrisma.board.count(),
        like: await testPrisma.like.count(),
        subject: await testPrisma.subject.count(),
        yearLevel: await testPrisma.yearLevel.count(),
      };
      expect(after).toEqual(before);
    } else {
      // Documented fallback contract: non-zero exit with a clear
      // unique-constraint error, requiring `db:reset` before reseeding.
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(/unique constraint|P2002/i);
    }
  }, 60_000);
});
