import {
  getTeacherByUsername,
  getPublishedResourcesByTeacher,
  getShareableBoardsByTeacher,
} from "@/lib/teachers";

// Per contract.md "Resolved ambiguities" #5, DAL unit tests exercise the real
// in-memory data source (no `@/lib/db` module exists yet for this ticket).
// "ada" is a username confirmed present in the seeded in-memory data source.
const KNOWN_USERNAME = "ada";
const UNKNOWN_USERNAME = "definitely-does-not-exist-xyz-000";
const UNKNOWN_TEACHER_ID = "definitely-does-not-exist-teacher-id-xyz-000";

describe("getTeacherByUsername", () => {
  it("returns a Teacher object with name, bio, and joinedAt for an existing username", async () => {
    const teacher = await getTeacherByUsername(KNOWN_USERNAME);

    expect(teacher).not.toBeNull();
    expect(typeof teacher?.name).toBe("string");
    expect(teacher?.name.length).toBeGreaterThan(0);
    expect(typeof teacher?.bio).toBe("string");
    expect(typeof teacher?.joinedAt).toBe("string");
    expect(teacher?.username).toBe(KNOWN_USERNAME);
  });

  it("returns null for an unknown username", async () => {
    const teacher = await getTeacherByUsername(UNKNOWN_USERNAME);

    expect(teacher).toBeNull();
  });
});

describe("getPublishedResourcesByTeacher", () => {
  it("returns only resources with status 'published' for the teacher", async () => {
    const teacher = await getTeacherByUsername(KNOWN_USERNAME);
    expect(teacher).not.toBeNull();

    const resources = await getPublishedResourcesByTeacher(teacher!.id);

    expect(Array.isArray(resources)).toBe(true);
    for (const resource of resources) {
      expect(resource.status).toBe("published");
      expect(resource.teacherId).toBe(teacher!.id);
    }
  });

  it("returns an empty array when the teacher has no published resources", async () => {
    const resources = await getPublishedResourcesByTeacher(UNKNOWN_TEACHER_ID);

    expect(resources).toEqual([]);
  });
});

describe("getShareableBoardsByTeacher", () => {
  it("returns only boards with shareable === true for the teacher", async () => {
    const teacher = await getTeacherByUsername(KNOWN_USERNAME);
    expect(teacher).not.toBeNull();

    const boards = await getShareableBoardsByTeacher(teacher!.id);

    expect(Array.isArray(boards)).toBe(true);
    for (const board of boards) {
      expect(board.shareable).toBe(true);
      expect(board.teacherId).toBe(teacher!.id);
    }
  });

  it("returns an empty array when the teacher has no shareable boards", async () => {
    const boards = await getShareableBoardsByTeacher(UNKNOWN_TEACHER_ID);

    expect(boards).toEqual([]);
  });
});
