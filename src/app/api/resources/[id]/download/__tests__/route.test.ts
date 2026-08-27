import { GET } from "@/app/api/resources/[id]/download/route";
import { getResourceById } from "@/lib/store/resource-store";
import {
  createTestDataDir,
  seedStore,
  cleanupTestDataDir,
  createTestUploadsDir,
  writeFakePdf,
} from "@/lib/store/__tests__/helpers";

describe("GET /api/resources/:id/download", () => {
  let dataDir: string;
  let uploadsDir: string;
  const originalDataDir = process.env.DATA_DIR;
  const originalUploadsDir = process.env.UPLOADS_DIR;
  const originalTestUserId = process.env.TEST_USER_ID;

  beforeEach(async () => {
    dataDir = await createTestDataDir("download-route");
    uploadsDir = await createTestUploadsDir("download-route");
    process.env.DATA_DIR = dataDir;
    process.env.UPLOADS_DIR = uploadsDir;
  });

  afterEach(async () => {
    await cleanupTestDataDir(dataDir);
    await cleanupTestDataDir(uploadsDir);
    if (originalDataDir !== undefined) {
      process.env.DATA_DIR = originalDataDir;
    } else {
      delete process.env.DATA_DIR;
    }
    if (originalUploadsDir !== undefined) {
      process.env.UPLOADS_DIR = originalUploadsDir;
    } else {
      delete process.env.UPLOADS_DIR;
    }
    if (originalTestUserId !== undefined) {
      process.env.TEST_USER_ID = originalTestUserId;
    } else {
      delete process.env.TEST_USER_ID;
    }
  });

  it("returns 200 with PDF content-type and content-disposition when resource and file exist", async () => {
    process.env.TEST_USER_ID = "test-user-001";
    await seedStore(dataDir, [
      {
        id: "r1",
        name: "Lesson Plan",
        ownerId: "owner-1",
        filePath: "r1.pdf",
        downloadCount: 0,
      },
    ]);
    await writeFakePdf(uploadsDir, "r1.pdf");

    const response = await GET(
      new Request("http://localhost/api/resources/r1/download"),
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/pdf");

    const contentDisposition = response.headers.get("content-disposition");
    expect(contentDisposition).toContain("attachment");
    expect(contentDisposition).toContain("Lesson Plan");

    const body = await response.arrayBuffer();
    expect(body.byteLength).toBeGreaterThan(0);
  });

  it("returns 401 with JSON error body for unauthenticated request", async () => {
    delete process.env.TEST_USER_ID;
    await seedStore(dataDir, [
      { id: "r1", name: "Lesson Plan", filePath: "r1.pdf", downloadCount: 0 },
    ]);
    await writeFakePdf(uploadsDir, "r1.pdf");

    const response = await GET(
      new Request("http://localhost/api/resources/r1/download"),
      { params: Promise.resolve({ id: "r1" }) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("does not increment download count on 401", async () => {
    delete process.env.TEST_USER_ID;
    await seedStore(dataDir, [
      { id: "r1", filePath: "r1.pdf", downloadCount: 0 },
    ]);

    await GET(
      new Request("http://localhost/api/resources/r1/download"),
      { params: Promise.resolve({ id: "r1" }) },
    );

    const resource = await getResourceById("r1");
    expect(resource?.downloadCount).toBe(0);
  });

  it("returns 404 with JSON error body for non-existent resource", async () => {
    process.env.TEST_USER_ID = "test-user-001";
    await seedStore(dataDir, []);

    const response = await GET(
      new Request("http://localhost/api/resources/unknown/download"),
      { params: Promise.resolve({ id: "unknown" }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("returns 5xx with JSON error body when file is missing from uploads dir", async () => {
    process.env.TEST_USER_ID = "test-user-001";
    await seedStore(dataDir, [
      {
        id: "r2",
        name: "Missing File",
        ownerId: "owner-1",
        filePath: "missing.pdf",
        downloadCount: 0,
      },
    ]);
    // Deliberately do NOT write missing.pdf to uploadsDir

    const response = await GET(
      new Request("http://localhost/api/resources/r2/download"),
      { params: Promise.resolve({ id: "r2" }) },
    );

    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = await response.json();
    expect(body.error).toBeTruthy();
  });

  it("does not increment download count when file is missing (5xx)", async () => {
    process.env.TEST_USER_ID = "test-user-001";
    await seedStore(dataDir, [
      {
        id: "r2",
        filePath: "missing.pdf",
        downloadCount: 0,
      },
    ]);

    await GET(
      new Request("http://localhost/api/resources/r2/download"),
      { params: Promise.resolve({ id: "r2" }) },
    );

    const resource = await getResourceById("r2");
    expect(resource?.downloadCount).toBe(0);
  });

  it("increments counter by 2 under two concurrent successful requests", async () => {
    process.env.TEST_USER_ID = "test-user-001";
    await seedStore(dataDir, [
      {
        id: "r1",
        name: "Concurrent Resource",
        ownerId: "owner-1",
        filePath: "r1.pdf",
        downloadCount: 0,
      },
    ]);
    await writeFakePdf(uploadsDir, "r1.pdf");

    const req1 = new Request("http://localhost/api/resources/r1/download");
    const req2 = new Request("http://localhost/api/resources/r1/download");

    const [res1, res2] = await Promise.all([
      GET(req1, { params: Promise.resolve({ id: "r1" }) }),
      GET(req2, { params: Promise.resolve({ id: "r1" }) }),
    ]);

    // Consume both streams to trigger post-delivery increment
    await res1.arrayBuffer();
    await res2.arrayBuffer();

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const resource = await getResourceById("r1");
    expect(resource?.downloadCount).toBe(2);
  });
});
