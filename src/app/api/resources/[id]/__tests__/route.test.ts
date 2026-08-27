import { GET } from "@/app/api/resources/[id]/route";
import {
  createTestDataDir,
  seedStore,
  cleanupTestDataDir,
} from "@/lib/store/__tests__/helpers";

describe("GET /api/resources/:id (metadata)", () => {
  let dataDir: string;
  const originalDataDir = process.env.DATA_DIR;

  beforeEach(async () => {
    dataDir = await createTestDataDir("resources-id-route");
    process.env.DATA_DIR = dataDir;
  });

  afterEach(async () => {
    await cleanupTestDataDir(dataDir);
    if (originalDataDir !== undefined) {
      process.env.DATA_DIR = originalDataDir;
    } else {
      delete process.env.DATA_DIR;
    }
  });

  it("returns 200 with resource data and download count", async () => {
    await seedStore(dataDir, [
      {
        id: "r1",
        name: "Lesson Plan",
        ownerId: "owner-1",
        filePath: "r1.pdf",
        downloadCount: 7,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/resources/r1"),
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.downloadCount).toBe(7);
    expect(body.name).toBe("Lesson Plan");
    expect(body.id).toBe("r1");
  });

  it("does not expose filePath in the response body", async () => {
    await seedStore(dataDir, [
      {
        id: "r1",
        name: "Lesson Plan",
        ownerId: "owner-1",
        filePath: "secret/r1.pdf",
        downloadCount: 0,
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/resources/r1"),
      { params: Promise.resolve({ id: "r1" }) },
    );

    const body = await response.json();
    expect(body.filePath).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret/r1.pdf");
  });

  it("returns 404 with JSON error body for unknown resource", async () => {
    await seedStore(dataDir, []);

    const response = await GET(
      new Request("http://localhost/api/resources/nope"),
      { params: Promise.resolve({ id: "nope" }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});
