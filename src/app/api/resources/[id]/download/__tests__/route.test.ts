import { POST } from "@/app/api/resources/[id]/download/route";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/db", () => ({
  db: {
    resource: {
      findUnique: vi.fn(),
    },
    download: {
      create: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const publishedResource = {
  id: "1",
  title: "Sample PDF",
  status: "PUBLISHED",
  authorId: "teacher-1",
  fileUrl: "https://example.com/sample.pdf",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const draftResource = {
  id: "2",
  title: "Draft",
  status: "DRAFT",
  authorId: "teacher-1",
  fileUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/resources/[id]/download", () => {
  it("returns 200 and creates a Download row for a PUBLISHED resource", async () => {
    vi.mocked(db.resource.findUnique).mockResolvedValue(publishedResource as never);
    vi.mocked(db.download.create).mockResolvedValue({
      id: "dl-1",
      resourceId: "1",
      userId: null,
      createdAt: new Date(),
    } as never);

    const response = await POST(
      new Request("http://localhost/api/resources/1/download", { method: "POST" }),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(200);

    // findUnique called first to confirm resource exists and is PUBLISHED
    expect(vi.mocked(db.resource.findUnique)).toHaveBeenCalledTimes(1);
    // Download row created exactly once
    expect(vi.mocked(db.download.create)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(db.download.create)).toHaveBeenCalledWith({
      data: { resourceId: "1", userId: null },
    });

    const body = await response.json();
    expect(body).toMatchObject({ success: true });
  });

  it("returns 404 and does NOT create a Download row for a DRAFT resource", async () => {
    vi.mocked(db.resource.findUnique).mockResolvedValue(draftResource as never);

    const response = await POST(
      new Request("http://localhost/api/resources/2/download", { method: "POST" }),
      { params: Promise.resolve({ id: "2" }) }
    );

    expect(response.status).toBe(404);
    expect(vi.mocked(db.download.create)).not.toHaveBeenCalled();
  });

  it("returns 404 and does NOT create a Download row when resource does not exist", async () => {
    vi.mocked(db.resource.findUnique).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/resources/999/download", { method: "POST" }),
      { params: Promise.resolve({ id: "999" }) }
    );

    expect(response.status).toBe(404);
    expect(vi.mocked(db.download.create)).not.toHaveBeenCalled();
  });

  it("returns 500 and does NOT create a Download row when findUnique throws", async () => {
    vi.mocked(db.resource.findUnique).mockRejectedValue(new Error("DB error"));

    const response = await POST(
      new Request("http://localhost/api/resources/1/download", { method: "POST" }),
      { params: Promise.resolve({ id: "1" }) }
    );

    expect(response.status).toBe(500);
    expect(vi.mocked(db.download.create)).not.toHaveBeenCalled();
  });

  it("calls revalidatePath with the author profile path on successful download", async () => {
    vi.mocked(db.resource.findUnique).mockResolvedValue(publishedResource as never);
    vi.mocked(db.download.create).mockResolvedValue({
      id: "dl-1",
      resourceId: "1",
      userId: null,
      createdAt: new Date(),
    } as never);

    await POST(new Request("http://localhost/api/resources/1/download", { method: "POST" }), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/teachers/teacher-1");
  });
});
