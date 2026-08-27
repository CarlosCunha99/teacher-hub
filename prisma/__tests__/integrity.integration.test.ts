import { Provider } from "@prisma/client";
import { resetDatabase, testPrisma, truncateAll } from "./helpers/testDb";

const hasDb = !!process.env.DATABASE_URL;

async function createTeacher(overrides: Partial<{ email: string; displayName: string }> = {}) {
  return testPrisma.teacher.create({
    data: {
      email: overrides.email ?? `teacher-${Date.now()}-${Math.random()}@example.test`,
      displayName: overrides.displayName ?? "Test Teacher",
    },
  });
}

async function createResource(ownerId: string, overrides: Partial<{ title: string }> = {}) {
  return testPrisma.resource.create({
    data: {
      title: overrides.title ?? "Test Resource",
      description: "A resource used for integrity testing.",
      fileUrl: "https://example.test/resource.pdf",
      ownerId,
    },
  });
}

async function createBoard(ownerId: string) {
  return testPrisma.board.create({
    data: { ownerId, name: "Test Board" },
  });
}

const NON_EXISTENT_ID = "clnonexistent00000000000001";

describe.skipIf(!hasDb)("referential integrity", () => {
  beforeAll(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("rejects a Resource with a non-existent ownerId (FK violation)", async () => {
    await expect(
      testPrisma.resource.create({
        data: {
          title: "Orphaned Resource",
          description: "Should be rejected",
          fileUrl: "https://example.test/orphan.pdf",
          ownerId: NON_EXISTENT_ID,
        },
      })
    ).rejects.toMatchObject({ code: "P2003" });

    expect(await testPrisma.resource.count()).toBe(0);
  });

  it("rejects a BoardItem with a non-existent resourceId (FK violation)", async () => {
    const teacher = await createTeacher();
    const board = await createBoard(teacher.id);

    await expect(
      testPrisma.boardItem.create({
        data: { boardId: board.id, resourceId: NON_EXISTENT_ID },
      })
    ).rejects.toMatchObject({ code: "P2003" });

    expect(await testPrisma.boardItem.count()).toBe(0);
  });

  it("rejects a Like with a non-existent teacherId (FK violation)", async () => {
    const teacher = await createTeacher();
    const resource = await createResource(teacher.id);

    await expect(
      testPrisma.like.create({
        data: { teacherId: NON_EXISTENT_ID, resourceId: resource.id },
      })
    ).rejects.toMatchObject({ code: "P2003" });

    expect(await testPrisma.like.count()).toBe(0);
  });

  it("rejects a duplicate Like for the same (teacherId, resourceId) pair", async () => {
    const teacher = await createTeacher();
    const resource = await createResource(teacher.id);
    await testPrisma.like.create({ data: { teacherId: teacher.id, resourceId: resource.id } });

    await expect(
      testPrisma.like.create({ data: { teacherId: teacher.id, resourceId: resource.id } })
    ).rejects.toMatchObject({ code: "P2002" });

    expect(
      await testPrisma.like.count({ where: { teacherId: teacher.id, resourceId: resource.id } })
    ).toBe(1);
  });

  it("rejects a duplicate BoardItem for the same (boardId, resourceId) pair", async () => {
    const teacher = await createTeacher();
    const board = await createBoard(teacher.id);
    const resource = await createResource(teacher.id);
    await testPrisma.boardItem.create({ data: { boardId: board.id, resourceId: resource.id } });

    await expect(
      testPrisma.boardItem.create({ data: { boardId: board.id, resourceId: resource.id } })
    ).rejects.toMatchObject({ code: "P2002" });

    expect(
      await testPrisma.boardItem.count({
        where: { boardId: board.id, resourceId: resource.id },
      })
    ).toBe(1);
  });

  it("resolves concurrent duplicate Like requests to exactly one row", async () => {
    const teacher = await createTeacher();
    const resource = await createResource(teacher.id);

    const results = await Promise.allSettled([
      testPrisma.like.create({ data: { teacherId: teacher.id, resourceId: resource.id } }),
      testPrisma.like.create({ data: { teacherId: teacher.id, resourceId: resource.id } }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    // Either exactly one wins and one is rejected as a duplicate, or both succeed
    // because the implementation uses an idempotent upsert — either way, exactly
    // one row must exist afterwards.
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    if (rejected.length > 0) {
      expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: "P2002" });
    }

    const count = await testPrisma.like.count({
      where: { teacherId: teacher.id, resourceId: resource.id },
    });
    expect(count).toBe(1);
  });

  it("resolves concurrent duplicate BoardItem (save) requests to exactly one row", async () => {
    const teacher = await createTeacher();
    const board = await createBoard(teacher.id);
    const resource = await createResource(teacher.id);

    await Promise.allSettled([
      testPrisma.boardItem.create({ data: { boardId: board.id, resourceId: resource.id } }),
      testPrisma.boardItem.create({ data: { boardId: board.id, resourceId: resource.id } }),
    ]);

    const count = await testPrisma.boardItem.count({
      where: { boardId: board.id, resourceId: resource.id },
    });
    expect(count).toBe(1);
  });

  it("deleting a Resource cascades to its Likes and BoardItems (no dangling rows)", async () => {
    const teacher = await createTeacher();
    const board = await createBoard(teacher.id);
    const resource = await createResource(teacher.id);
    await testPrisma.like.create({ data: { teacherId: teacher.id, resourceId: resource.id } });
    await testPrisma.boardItem.create({ data: { boardId: board.id, resourceId: resource.id } });

    await testPrisma.resource.delete({ where: { id: resource.id } });

    expect(await testPrisma.like.count({ where: { resourceId: resource.id } })).toBe(0);
    expect(await testPrisma.boardItem.count({ where: { resourceId: resource.id } })).toBe(0);
  });

  it("deleting a Teacher cascades to their Boards, BoardItems, Resources, and Likes", async () => {
    const owner = await createTeacher();
    const otherTeacher = await createTeacher();
    const board = await createBoard(owner.id);
    const resource = await createResource(owner.id);
    await testPrisma.boardItem.create({ data: { boardId: board.id, resourceId: resource.id } });
    await testPrisma.like.create({ data: { teacherId: owner.id, resourceId: resource.id } });
    // A like from a different teacher on the same resource should also cascade
    // once the resource itself cascades from its owning teacher's deletion.
    await testPrisma.like.create({
      data: { teacherId: otherTeacher.id, resourceId: resource.id },
    });

    await testPrisma.teacher.delete({ where: { id: owner.id } });

    expect(await testPrisma.board.count({ where: { ownerId: owner.id } })).toBe(0);
    expect(await testPrisma.resource.count({ where: { ownerId: owner.id } })).toBe(0);
    expect(await testPrisma.boardItem.count({ where: { boardId: board.id } })).toBe(0);
    expect(await testPrisma.like.count({ where: { resourceId: resource.id } })).toBe(0);
  });

  it("rejects a ResourceSubject referencing a subjectId outside the approved reference data", async () => {
    const teacher = await createTeacher();
    const resource = await createResource(teacher.id);

    await expect(
      testPrisma.resourceSubject.create({
        data: { resourceId: resource.id, subjectId: NON_EXISTENT_ID },
      })
    ).rejects.toMatchObject({ code: "P2003" });

    expect(await testPrisma.resourceSubject.count()).toBe(0);
  });

  it("rejects a ResourceYearLevel referencing a yearLevelId outside the approved reference data", async () => {
    const teacher = await createTeacher();
    const resource = await createResource(teacher.id);

    await expect(
      testPrisma.resourceYearLevel.create({
        data: { resourceId: resource.id, yearLevelId: NON_EXISTENT_ID },
      })
    ).rejects.toMatchObject({ code: "P2003" });

    expect(await testPrisma.resourceYearLevel.count()).toBe(0);
  });

  it("rejects a duplicate Teacher email (unique constraint)", async () => {
    const teacher = await createTeacher({ email: "unique-check@example.test" });

    await expect(
      testPrisma.teacher.create({
        data: { email: teacher.email, displayName: "Duplicate Email" },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects a duplicate Identity (provider, providerAccountId) linked to two teachers", async () => {
    const teacherA = await createTeacher();
    const teacherB = await createTeacher();

    await testPrisma.identity.create({
      data: {
        provider: Provider.GOOGLE,
        providerAccountId: "shared-account-id",
        teacherId: teacherA.id,
      },
    });

    await expect(
      testPrisma.identity.create({
        data: {
          provider: Provider.GOOGLE,
          providerAccountId: "shared-account-id",
          teacherId: teacherB.id,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
