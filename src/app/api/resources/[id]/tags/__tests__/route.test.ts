import { POST, DELETE } from "@/app/api/resources/[id]/tags/route";
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

const resourceFixture = {
  id: "res-1",
  title: "My Worksheet",
  teacherId: "t1",
  createdAt: new Date(),
};

const resourceTagFixture = { resourceId: "res-1", tagId: "tag-1" };

const makeRequest = (url: string, method: string, teacherId: string | null, body?: object) =>
  new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(teacherId ? { "X-Teacher-Id": teacherId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

const makeContext = (id: string) => ({
  params: Promise.resolve({ id }),
});

const mockTag = prisma.tag as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
};

const mockResource = prisma.resource as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
};

const mockResourceTag = prisma.resourceTag as unknown as {
  upsert: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/resources/[id]/tags — attach tag", () => {
  // F-33: Happy path — attach tag → 201 ResourceTag
  it("returns 201 with ResourceTag on successful attach", async () => {
    mockResource.findUnique.mockResolvedValue(resourceFixture);
    mockTag.findUnique.mockResolvedValue(tagFixture);
    mockResourceTag.upsert.mockResolvedValue(resourceTagFixture);

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "POST", "t1", {
      tagId: "tag-1",
    });
    const res = await POST(req, makeContext("res-1"));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ resourceId: "res-1", tagId: "tag-1" });
  });

  // F-34: Idempotent attach — returns 201 even if already attached
  it("is idempotent — returns 201 even when association already exists", async () => {
    mockResource.findUnique.mockResolvedValue(resourceFixture);
    mockTag.findUnique.mockResolvedValue(tagFixture);
    mockResourceTag.upsert.mockResolvedValue(resourceTagFixture);

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "POST", "t1", {
      tagId: "tag-1",
    });
    const res = await POST(req, makeContext("res-1"));

    expect(res.status).toBe(201);
  });

  // F-35: Tag not owned by caller → 403
  it("returns 403 when tag belongs to a different teacher", async () => {
    mockResource.findUnique.mockResolvedValue(resourceFixture);
    mockTag.findUnique.mockResolvedValue({ ...tagFixture, teacherId: "t2" });

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "POST", "t1", {
      tagId: "tag-1",
    });
    const res = await POST(req, makeContext("res-1"));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-36: Resource not owned by caller → 403
  it("returns 403 when resource belongs to a different teacher", async () => {
    mockResource.findUnique.mockResolvedValue({ ...resourceFixture, teacherId: "t2" });
    mockTag.findUnique.mockResolvedValue(tagFixture);

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "POST", "t1", {
      tagId: "tag-1",
    });
    const res = await POST(req, makeContext("res-1"));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-37: Tag not found → 404
  it("returns 404 when tag does not exist", async () => {
    mockResource.findUnique.mockResolvedValue(resourceFixture);
    mockTag.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "POST", "t1", {
      tagId: "no-such-tag",
    });
    const res = await POST(req, makeContext("res-1"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-38: Resource not found → 404
  it("returns 404 when resource does not exist", async () => {
    mockResource.findUnique.mockResolvedValue(null);
    mockTag.findUnique.mockResolvedValue(tagFixture);

    const req = makeRequest("http://localhost/api/resources/no-such-res/tags", "POST", "t1", {
      tagId: "tag-1",
    });
    const res = await POST(req, makeContext("no-such-res"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-39: Missing X-Teacher-Id → 401
  it("returns 401 when X-Teacher-Id header is missing", async () => {
    const req = makeRequest("http://localhost/api/resources/res-1/tags", "POST", null, {
      tagId: "tag-1",
    });
    const res = await POST(req, makeContext("res-1"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

describe("DELETE /api/resources/[id]/tags — detach tag", () => {
  // F-40: Happy path — detach tag → 200 { success: true }
  it("returns 200 with { success: true } on successful detach", async () => {
    mockResource.findUnique.mockResolvedValue(resourceFixture);
    mockResourceTag.findUnique.mockResolvedValue(resourceTagFixture);
    mockResourceTag.delete.mockResolvedValue(resourceTagFixture);

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "DELETE", "t1", {
      tagId: "tag-1",
    });
    const res = await DELETE(req, makeContext("res-1"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
  });

  // F-41: Detach tag not currently attached → 404
  it("returns 404 when the tag is not currently attached to the resource", async () => {
    mockResource.findUnique.mockResolvedValue(resourceFixture);
    mockResourceTag.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "DELETE", "t1", {
      tagId: "tag-1",
    });
    const res = await DELETE(req, makeContext("res-1"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-42: Resource not owned by caller → 403
  it("returns 403 when resource belongs to a different teacher", async () => {
    mockResource.findUnique.mockResolvedValue({ ...resourceFixture, teacherId: "t2" });

    const req = makeRequest("http://localhost/api/resources/res-1/tags", "DELETE", "t1", {
      tagId: "tag-1",
    });
    const res = await DELETE(req, makeContext("res-1"));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // F-43: Missing X-Teacher-Id → 401
  it("returns 401 when X-Teacher-Id header is missing", async () => {
    const req = makeRequest("http://localhost/api/resources/res-1/tags", "DELETE", null, {
      tagId: "tag-1",
    });
    const res = await DELETE(req, makeContext("res-1"));

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // Resource not found → 404
  it("returns 404 when resource does not exist", async () => {
    mockResource.findUnique.mockResolvedValue(null);

    const req = makeRequest("http://localhost/api/resources/no-such-res/tags", "DELETE", "t1", {
      tagId: "tag-1",
    });
    const res = await DELETE(req, makeContext("no-such-res"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});
