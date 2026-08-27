import { GET, POST } from "@/app/api/tags/route";
import { Prisma } from "@prisma/client";
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

const otherTeacherTag = {
  id: "tag-2",
  name: "Another Tag",
  slug: "another-tag",
  teacherId: "t2",
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
  create: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/tags", () => {
  // F-1: Happy path
  it("returns 201 with the created tag on happy path", async () => {
    mockTag.create.mockResolvedValue(tagFixture);
    const req = makeRequest("http://localhost/api/tags", "POST", "t1", {
      name: "AQA GCSE",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: "tag-1",
      name: "AQA GCSE",
      slug: "aqa-gcse",
      teacherId: "t1",
    });
  });

  // F-2: Slug is URL-safe kebab-case
  it("produces a URL-safe kebab-case slug", async () => {
    const stemTag = {
      ...tagFixture,
      name: "STEM: Challenge (2024)",
      slug: "stem-challenge-2024",
    };
    mockTag.create.mockResolvedValue(stemTag);
    const req = makeRequest("http://localhost/api/tags", "POST", "t1", {
      name: "STEM: Challenge (2024)",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toMatch(/^[a-z0-9-]+$/);
  });

  // F-3: Name trimmed before storage
  it("trims surrounding whitespace from name before storing", async () => {
    const trimmedTag = { ...tagFixture, name: "SEND-friendly", slug: "send-friendly" };
    mockTag.create.mockResolvedValue(trimmedTag);
    const req = makeRequest("http://localhost/api/tags", "POST", "t1", {
      name: "  SEND-friendly  ",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("SEND-friendly");
    expect(mockTag.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "SEND-friendly" }),
      })
    );
  });

  // F-4: Empty name rejected
  it("returns 400 for empty name", async () => {
    const req = makeRequest("http://localhost/api/tags", "POST", "t1", {
      name: "",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-5: Whitespace-only name rejected
  it("returns 400 for whitespace-only name", async () => {
    const req = makeRequest("http://localhost/api/tags", "POST", "t1", {
      name: "   ",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-6: Slug collision same teacher → 409
  it("returns 409 when slug collision exists for the same teacher", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Unique constraint violation", {
      code: "P2002",
      clientVersion: "6.0",
    });
    mockTag.create.mockRejectedValue(prismaError);
    const req = makeRequest("http://localhost/api/tags", "POST", "t1", {
      name: "AQA GCSE",
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-7: Same name different teacher → 201
  it("returns 201 when same slug exists for a different teacher", async () => {
    mockTag.create.mockResolvedValue({ ...tagFixture, teacherId: "t2", id: "tag-3" });
    const req = makeRequest("http://localhost/api/tags", "POST", "t2", {
      name: "AQA GCSE",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  // F-8: Missing X-Teacher-Id → 401
  it("returns 401 when X-Teacher-Id header is missing", async () => {
    const req = makeRequest("http://localhost/api/tags", "POST", null, {
      name: "AQA GCSE",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-9: Empty X-Teacher-Id → 401
  it("returns 401 when X-Teacher-Id header is empty", async () => {
    const req = new Request("http://localhost/api/tags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Teacher-Id": "",
      },
      body: JSON.stringify({ name: "AQA GCSE" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("GET /api/tags", () => {
  // F-10: Happy path — returns caller's tags
  it("returns 200 with the caller's tags", async () => {
    const tags = [
      tagFixture,
      { ...tagFixture, id: "tag-3", name: "STEM", slug: "stem" },
      { ...tagFixture, id: "tag-4", name: "KS4", slug: "ks4" },
    ];
    mockTag.findMany.mockResolvedValue(tags);
    const req = makeRequest("http://localhost/api/tags", "GET", "t1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
    body.forEach((tag: { teacherId: string }) => expect(tag.teacherId).toBe("t1"));
  });

  // F-11: Cross-teacher isolation — t2 gets empty
  it("returns only the calling teacher's tags (cross-teacher isolation)", async () => {
    mockTag.findMany.mockResolvedValue([]);
    const req = makeRequest("http://localhost/api/tags", "GET", "t2");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
    expect(mockTag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { teacherId: "t2" } })
    );
  });

  // F-12: No tags yet → []
  it("returns 200 with empty array when teacher has no tags", async () => {
    mockTag.findMany.mockResolvedValue([]);
    const req = makeRequest("http://localhost/api/tags", "GET", "t1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  // F-13: Missing X-Teacher-Id → 401
  it("returns 401 when X-Teacher-Id header is missing", async () => {
    const req = makeRequest("http://localhost/api/tags", "GET", null);
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
