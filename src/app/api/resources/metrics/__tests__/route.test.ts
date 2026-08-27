import { GET } from "@/app/api/resources/metrics/route";
import {
  createTestDataDir,
  seedStore,
  cleanupTestDataDir,
} from "@/lib/store/__tests__/helpers";

describe("GET /api/resources/metrics", () => {
  let dataDir: string;
  const originalDataDir = process.env.DATA_DIR;
  const originalTestUserId = process.env.TEST_USER_ID;

  beforeEach(async () => {
    dataDir = await createTestDataDir("metrics-route");
    process.env.DATA_DIR = dataDir;
  });

  afterEach(async () => {
    await cleanupTestDataDir(dataDir);
    if (originalDataDir !== undefined) {
      process.env.DATA_DIR = originalDataDir;
    } else {
      delete process.env.DATA_DIR;
    }
    if (originalTestUserId !== undefined) {
      process.env.TEST_USER_ID = originalTestUserId;
    } else {
      delete process.env.TEST_USER_ID;
    }
  });

  it("returns 200 with only the authenticated owner's resources", async () => {
    process.env.TEST_USER_ID = "owner-1";
    await seedStore(dataDir, [
      { id: "r1", ownerId: "owner-1", downloadCount: 3 },
      { id: "r2", ownerId: "owner-1", downloadCount: 5 },
      { id: "r3", ownerId: "owner-2", downloadCount: 9 },
    ]);

    const response = await GET(
      new Request("http://localhost/api/resources/metrics"),
    );

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);

    const counts = body.map((r: { downloadCount: number }) => r.downloadCount);
    expect(counts).toContain(3);
    expect(counts).toContain(5);
    expect(counts).not.toContain(9);

    const ids = body.map((r: { id: string }) => r.id);
    expect(ids).not.toContain("r3");
  });

  it("does not include filePath in any returned resource", async () => {
    process.env.TEST_USER_ID = "owner-1";
    await seedStore(dataDir, [
      { id: "r1", ownerId: "owner-1", filePath: "secret.pdf", downloadCount: 1 },
    ]);

    const response = await GET(
      new Request("http://localhost/api/resources/metrics"),
    );

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].filePath).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("secret.pdf");
  });

  it("returns 401 with JSON error body for unauthenticated request", async () => {
    delete process.env.TEST_USER_ID;

    const response = await GET(
      new Request("http://localhost/api/resources/metrics"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body.error).toBeTruthy();
  });
});
