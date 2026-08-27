import { GET, POST } from "@/app/api/resources/route";
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

const resourceFixture = {
  id: "res-1",
  title: "My Worksheet",
  teacherId: "t1",
  createdAt: new Date(),
};

const resource2 = {
  id: "res-2",
  title: "Another Resource",
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

const mockResource = prisma.resource as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/resources", () => {
  // F-19: No filter — returns all resources
  it("returns 200 with all resources when no filter params are given", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture, resource2]);
    const res = await GET(new Request("http://localhost/api/resources"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  // F-20: Filter by single tag
  it("returns 200 with only resources matching the given tag slug", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture]);
    const res = await GET(new Request("http://localhost/api/resources?tags=aqa-gcse"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  // F-21: OR filter — multi-tag returns union
  it("returns union of resources matching any tag slug in OR mode", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture, resource2]);
    const res = await GET(new Request("http://localhost/api/resources?tags=aqa-gcse,stem&mode=or"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
    expect(mockResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resourceTags: {
            some: {
              tag: { slug: { in: ["aqa-gcse", "stem"] } },
            },
          },
        }),
      })
    );
  });

  // F-22: OR is the default mode
  it("defaults to OR mode when mode param is absent", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture, resource2]);
    await GET(new Request("http://localhost/api/resources?tags=aqa-gcse,stem&mode=or"));
    const withModeArgs = mockResource.findMany.mock.calls[0][0];

    vi.resetAllMocks();
    mockResource.findMany.mockResolvedValue([resourceFixture, resource2]);
    await GET(new Request("http://localhost/api/resources?tags=aqa-gcse,stem"));
    const withoutModeArgs = mockResource.findMany.mock.calls[0][0];

    expect(withoutModeArgs).toEqual(withModeArgs);
  });

  // F-23: AND filter — returns intersection
  it("returns only resources matching ALL tags in AND mode", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture]);
    const res = await GET(
      new Request("http://localhost/api/resources?tags=aqa-gcse,stem&mode=and")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(mockResource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            { resourceTags: { some: { tag: { slug: "aqa-gcse" } } } },
            { resourceTags: { some: { tag: { slug: "stem" } } } },
          ],
        }),
      })
    );
  });

  // F-24: Unknown slug returns empty
  it("returns 200 with empty array for unknown tag slug", async () => {
    mockResource.findMany.mockResolvedValue([]);
    const res = await GET(new Request("http://localhost/api/resources?tags=no-such-tag"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  // F-25: Mixed valid/unknown slug (OR) → matches valid only
  it("returns resources matching valid slug only when mixed with unknown (OR)", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture]);
    const res = await GET(
      new Request("http://localhost/api/resources?tags=aqa-gcse,no-such-tag&mode=or")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  // F-26: Mixed valid/unknown slug (AND) → empty
  it("returns empty array when AND filter includes unknown slug", async () => {
    mockResource.findMany.mockResolvedValue([]);
    const res = await GET(
      new Request("http://localhost/api/resources?tags=aqa-gcse,no-such-tag&mode=and")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  // F-27: Compose with subject filter
  it("composes tag filter with subject filter", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture]);
    const res = await GET(
      new Request("http://localhost/api/resources?tags=aqa-gcse&subject=science")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // F-28: Compose with year-level filter
  it("composes tag filter with year-level filter", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture]);
    const res = await GET(
      new Request("http://localhost/api/resources?tags=aqa-gcse&yearLevel=ks4")
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // F-29: Backward compat — no tag params
  it("is backward-compatible: callers without tag params receive all resources", async () => {
    mockResource.findMany.mockResolvedValue([resourceFixture, resource2]);
    const res = await GET(new Request("http://localhost/api/resources"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  // F-30: Invalid mode value → 400
  it("returns 400 when mode has an invalid value", async () => {
    const res = await GET(new Request("http://localhost/api/resources?tags=aqa-gcse&mode=AND"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("POST /api/resources", () => {
  // F-31: Happy path — create resource
  it("returns 201 with created resource on happy path", async () => {
    mockResource.create.mockResolvedValue(resourceFixture);
    const req = makeRequest("http://localhost/api/resources", "POST", "t1", {
      title: "My Worksheet",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: "res-1", title: "My Worksheet", teacherId: "t1" });
  });

  // F-32: Missing X-Teacher-Id → 401
  it("returns 401 when X-Teacher-Id header is missing", async () => {
    const req = makeRequest("http://localhost/api/resources", "POST", null, {
      title: "My Worksheet",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
