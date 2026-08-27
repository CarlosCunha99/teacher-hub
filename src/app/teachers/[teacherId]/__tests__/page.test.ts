import { fetchTeacherProfileData } from "@/app/teachers/[teacherId]/_data";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    resource: {
      findMany: vi.fn(),
    },
    like: {
      count: vi.fn(),
    },
    download: {
      count: vi.fn(),
    },
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchTeacherProfileData", () => {
  it("F1: returns correct totalLikes and totalDownloads for a teacher with published resources", async () => {
    vi.mocked(db.like.count).mockResolvedValue(15);
    vi.mocked(db.download.count).mockResolvedValue(8);
    vi.mocked(db.resource.findMany).mockResolvedValue([
      {
        id: "1",
        title: "Resource A",
        status: "PUBLISHED",
        _count: { likes: 10, downloads: 5 },
      },
      {
        id: "2",
        title: "Resource B",
        status: "PUBLISHED",
        _count: { likes: 5, downloads: 3 },
      },
    ] as never);

    const result = await fetchTeacherProfileData("teacher-1");

    expect(result.totalLikes).toBe(15);
    expect(result.totalDownloads).toBe(8);
  });

  it("F2: queries DB with authorId filter and PUBLISHED status filter", async () => {
    vi.mocked(db.like.count).mockResolvedValue(5);
    vi.mocked(db.download.count).mockResolvedValue(3);
    vi.mocked(db.resource.findMany).mockResolvedValue([]);

    await fetchTeacherProfileData("teacher-1");

    // like.count must be called with a where clause containing authorId and PUBLISHED status
    expect(vi.mocked(db.like.count)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resource: expect.objectContaining({
            authorId: "teacher-1",
            status: "PUBLISHED",
          }),
        }),
      })
    );

    // download.count must likewise filter by authorId and PUBLISHED status
    expect(vi.mocked(db.download.count)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resource: expect.objectContaining({
            authorId: "teacher-1",
            status: "PUBLISHED",
          }),
        }),
      })
    );
  });

  it("F3: returns totalLikes=0 and totalDownloads=0 when teacher has no published resources", async () => {
    vi.mocked(db.like.count).mockResolvedValue(0);
    vi.mocked(db.download.count).mockResolvedValue(0);
    vi.mocked(db.resource.findMany).mockResolvedValue([]);

    const result = await fetchTeacherProfileData("new-teacher");

    expect(result.totalLikes).toBe(0);
    expect(result.totalDownloads).toBe(0);
    expect(result.resources).toEqual([]);
  });
});
