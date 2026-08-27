import type { Teacher, Resource, Board } from "@/lib/teachers";

// Per contract.md "Resolved ambiguities" #5, DAL unit tests may mock
// `@/lib/teachers-data` or exercise the real in-memory store. Here we mock the
// data source explicitly so we can seed fixtures with published+draft
// resources, shareable+private boards, and records owned by *another*
// teacher, and prove that the DAL functions in `@/lib/teachers` forward the
// correct teacherId and apply the correct status/shareable filter rather than
// merely passing through whatever the data source happens to return.
vi.mock("@/lib/teachers-data", () => ({
  findTeacherByUsername: vi.fn(),
  findResourcesByTeacher: vi.fn(),
  findBoardsByTeacher: vi.fn(),
}));

import {
  getTeacherByUsername,
  getPublishedResourcesByTeacher,
  getShareableBoardsByTeacher,
} from "@/lib/teachers";
import {
  findTeacherByUsername,
  findResourcesByTeacher,
  findBoardsByTeacher,
} from "@/lib/teachers-data";

const mockFindTeacherByUsername = vi.mocked(findTeacherByUsername);
const mockFindResourcesByTeacher = vi.mocked(findResourcesByTeacher);
const mockFindBoardsByTeacher = vi.mocked(findBoardsByTeacher);

const KNOWN_TEACHER: Teacher = {
  id: "t1",
  username: "ada",
  name: "Ada Lovelace",
  bio: "Maths teacher exploring computing with her students.",
  joinedAt: "2024-01-15T00:00:00Z",
};

const OTHER_TEACHER_ID = "t2";

// Fixtures seeded across two teachers, with mixed status/shareable values, so
// exclusion assertions cannot pass on an accidentally-empty array.
const ALL_RESOURCES: Resource[] = [
  { id: "r1", teacherId: KNOWN_TEACHER.id, title: "Intro to Algorithms", status: "published" },
  { id: "r2", teacherId: KNOWN_TEACHER.id, title: "Loops Worksheet", status: "published" },
  { id: "r3", teacherId: KNOWN_TEACHER.id, title: "Draft: Recursion", status: "draft" },
  { id: "r4", teacherId: OTHER_TEACHER_ID, title: "Someone Else's Resource", status: "published" },
];

const ALL_BOARDS: Board[] = [
  { id: "b1", teacherId: KNOWN_TEACHER.id, name: "Year 9 Maths", shareable: true },
  { id: "b2", teacherId: KNOWN_TEACHER.id, name: "Private Planning", shareable: false },
  { id: "b3", teacherId: OTHER_TEACHER_ID, name: "Someone Else's Board", shareable: true },
];

// Mock the data source with realistic teacherId-filtering semantics (as the
// real in-memory/DB source does), so that DAL-function behavior above it can
// be tested in isolation from the fixture wiring.
function seedFindResourcesByTeacher() {
  mockFindResourcesByTeacher.mockImplementation(async (teacherId: string) =>
    ALL_RESOURCES.filter((resource) => resource.teacherId === teacherId)
  );
}

function seedFindBoardsByTeacher() {
  mockFindBoardsByTeacher.mockImplementation(async (teacherId: string) =>
    ALL_BOARDS.filter((board) => board.teacherId === teacherId)
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getTeacherByUsername", () => {
  it("returns the exact fixture fields for an existing username, with joinedAt as ISO 8601", async () => {
    mockFindTeacherByUsername.mockResolvedValue(KNOWN_TEACHER);

    const teacher = await getTeacherByUsername("ada");

    expect(teacher).toEqual(KNOWN_TEACHER);
    expect(teacher?.joinedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });

  it("looks up a mixed-case username and returns the stored-casing teacher (case-insensitive lookup)", async () => {
    mockFindTeacherByUsername.mockImplementation(async (username: string) =>
      username.toLowerCase() === "ada" ? KNOWN_TEACHER : null
    );

    const teacher = await getTeacherByUsername("ADA");

    expect(teacher).toEqual(KNOWN_TEACHER);
    expect(teacher?.username).toBe("ada");
  });

  it("returns null for an unknown username", async () => {
    mockFindTeacherByUsername.mockResolvedValue(null);

    const teacher = await getTeacherByUsername("definitely-does-not-exist-xyz-000");

    expect(teacher).toBeNull();
  });
});

describe("getPublishedResourcesByTeacher", () => {
  it("returns exactly the published resource ids for the teacher, excluding drafts and other teachers", async () => {
    seedFindResourcesByTeacher();

    const resources = await getPublishedResourcesByTeacher(KNOWN_TEACHER.id);

    expect(mockFindResourcesByTeacher).toHaveBeenCalledWith(KNOWN_TEACHER.id);
    expect(resources.map((resource) => resource.id).sort()).toEqual(["r1", "r2"]);
    expect(resources.some((resource) => resource.id === "r3")).toBe(false); // draft excluded
    expect(resources.some((resource) => resource.teacherId === OTHER_TEACHER_ID)).toBe(false); // other teacher excluded
    for (const resource of resources) {
      expect(resource.status).toBe("published");
      expect(resource.teacherId).toBe(KNOWN_TEACHER.id);
    }
  });

  it("returns an empty array when the teacher has no published resources", async () => {
    seedFindResourcesByTeacher();

    const resources = await getPublishedResourcesByTeacher(
      "definitely-does-not-exist-teacher-id-xyz-000"
    );

    expect(resources).toEqual([]);
  });
});

describe("getShareableBoardsByTeacher", () => {
  it("returns exactly the shareable board ids for the teacher, excluding private boards and other teachers", async () => {
    seedFindBoardsByTeacher();

    const boards = await getShareableBoardsByTeacher(KNOWN_TEACHER.id);

    expect(mockFindBoardsByTeacher).toHaveBeenCalledWith(KNOWN_TEACHER.id);
    expect(boards.map((board) => board.id).sort()).toEqual(["b1"]);
    expect(boards.some((board) => board.id === "b2")).toBe(false); // private excluded
    expect(boards.some((board) => board.teacherId === OTHER_TEACHER_ID)).toBe(false); // other teacher excluded
    for (const board of boards) {
      expect(board.shareable).toBe(true);
      expect(board.teacherId).toBe(KNOWN_TEACHER.id);
    }
  });

  it("returns an empty array when the teacher has no shareable boards", async () => {
    seedFindBoardsByTeacher();

    const boards = await getShareableBoardsByTeacher(
      "definitely-does-not-exist-teacher-id-xyz-000"
    );

    expect(boards).toEqual([]);
  });
});
