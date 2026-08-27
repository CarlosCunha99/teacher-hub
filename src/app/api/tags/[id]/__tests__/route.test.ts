import { DELETE } from "@/app/api/tags/[id]/route";
import prisma from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  default: {
    tag: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    resource: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    resourceTag: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const tagFixture = {
  id: "tag-1",
  name: "AQA GCSE",
  slug: "aqa-gcse",
  teacherId: "t1",
  createdAt: new Date(),
};

const makeRequest = (url: string, method: string, teacherId: string | null, body?: object) =>
  new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(teacherId ? { "X-Teacher-Id": teacherId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const mockTag = prisma.tag as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const mockResourceTag = prisma.resourceTag as unknown as {
  deleteMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

const makeContext = (id: string) => ({
  params: Promise.resolve({ id }),
});

describe("DELETE /api/tags/[id]", () => {
  // F-14: Happy path — 200 { success: true }
  it("returns 200 with { success: true } when deleting own tag", async () => {
    mockTag.findUnique.mockResolvedValue(tagFixture);
    mockResourceTag.deleteMany.mockResolvedValue({ count: 0 });
    mockTag.delete.mockResolvedValue(tagFixture);

    const req = makeRequest("http://localhost/api/tags/tag-1", "DELETE", "t1");
    const res = await DELETE(req, makeContext("tag-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
  });

  // F-15: Cascade — ResourceTag rows deleted before tag
  it("deletes ResourceTag associations (cascade) before deleting the tag", async () => {
    mockTag.findUnique.mockResolvedValue(tagFixture);
    mockResourceTag.deleteMany.mockResolvedValue({ count: 2 });
    mockTag.delete.mockResolvedValue(tagFixture);

    const req = makeRequest("http://localhost/api/tags/tag-1", "DELETE", "t1");
    await DELETE(req, makeContext("tag-1"));

    expect(mockResourceTag.deleteMany).toHaveBeenCalledWith({ where: { tagId: "tag-1" } });
    expect(mockTag.delete).toHaveBeenCalled();
  });

  // F-16: Tag not found → 404
  it("returns 404 when tag does not exist", async () => {
    mockTag.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/tags/no-such-tag", "DELETE", "t1");
    const res = await DELETE(req, makeContext("no-such-tag"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-17: Tag owned by another teacher → 403
  it("returns 403 when tag belongs to a different teacher", async () => {
    mockTag.findUnique.mockResolvedValue({ ...tagFixture, teacherId: "t2" });

    const req = makeRequest("http://localhost/api/tags/tag-1", "DELETE", "t1");
    const res = await DELETE(req, makeContext("tag-1"));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-18: Missing X-Teacher-Id → 401
  it("returns 401 when X-Teacher-Id header is missing", async () => {
    const req = makeRequest("http://localhost/api/tags/tag-1", "DELETE", null);
    const res = await DELETE(req, makeContext("tag-1"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
