import fs from "fs/promises";
import path from "path";
import {
  getResourceById,
  getResourcesByOwner,
  incrementDownload,
} from "@/lib/store/resource-store";
import { createTestDataDir, seedStore, cleanupTestDataDir } from "./helpers";

describe("resource-store", () => {
  let dataDir: string;
  const originalDataDir = process.env.DATA_DIR;

  beforeEach(async () => {
    dataDir = await createTestDataDir("resource-store");
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

  describe("getResourceById", () => {
    it("returns resource with all fields for a known ID", async () => {
      await seedStore(dataDir, [
        {
          id: "r1",
          name: "Lesson Plan",
          ownerId: "owner-1",
          filePath: "r1.pdf",
          downloadCount: 5,
        },
      ]);
      const resource = await getResourceById("r1");
      expect(resource).not.toBeNull();
      expect(resource?.id).toBe("r1");
      expect(resource?.name).toBe("Lesson Plan");
      expect(resource?.downloadCount).toBe(5);
      expect(resource?.ownerId).toBe("owner-1");
      expect(resource?.filePath).toBe("r1.pdf");
    });

    it("returns null for an unknown ID", async () => {
      await seedStore(dataDir, []);
      const resource = await getResourceById("does-not-exist");
      expect(resource).toBeNull();
    });

    it("returns null when store is empty and ID is queried", async () => {
      await seedStore(dataDir, [{ id: "other" }]);
      const resource = await getResourceById("not-other");
      expect(resource).toBeNull();
    });
  });

  describe("getResourcesByOwner", () => {
    it("returns only resources matching the given ownerId", async () => {
      await seedStore(dataDir, [
        { id: "r1", ownerId: "owner-1", downloadCount: 3 },
        { id: "r2", ownerId: "owner-1", downloadCount: 5 },
        { id: "r3", ownerId: "owner-2", downloadCount: 9 },
      ]);
      const resources = await getResourcesByOwner("owner-1");
      expect(resources).toHaveLength(2);
      const ids = resources.map((r) => r.id);
      expect(ids).toContain("r1");
      expect(ids).toContain("r2");
      expect(ids).not.toContain("r3");
    });

    it("returns empty array when owner has no resources", async () => {
      await seedStore(dataDir, [{ id: "r1", ownerId: "owner-1" }]);
      const resources = await getResourcesByOwner("owner-nobody");
      expect(resources).toEqual([]);
    });
  });

  describe("incrementDownload", () => {
    it("increments downloadCount by exactly 1", async () => {
      await seedStore(dataDir, [{ id: "r1", downloadCount: 0 }]);
      await incrementDownload("r1", "user-1");
      const resource = await getResourceById("r1");
      expect(resource?.downloadCount).toBe(1);
    });

    it("subsequent calls each increment by 1", async () => {
      await seedStore(dataDir, [{ id: "r1", downloadCount: 0 }]);
      await incrementDownload("r1", "user-1");
      await incrementDownload("r1", "user-1");
      const resource = await getResourceById("r1");
      expect(resource?.downloadCount).toBe(2);
    });

    it("two concurrent increments both apply — final count === 2", async () => {
      await seedStore(dataDir, [{ id: "r1", downloadCount: 0 }]);
      await Promise.all([incrementDownload("r1", "user-1"), incrementDownload("r1", "user-2")]);
      const resource = await getResourceById("r1");
      expect(resource?.downloadCount).toBe(2);
    });

    it("writes an audit record with matching resourceId, userId, and timestamp", async () => {
      await seedStore(dataDir, [{ id: "r1", downloadCount: 0 }]);
      await incrementDownload("r1", "user-audit");
      const auditRaw = await fs.readFile(path.join(dataDir, "audit.json"), "utf-8");
      const audit = JSON.parse(auditRaw);
      expect(audit).toHaveLength(1);
      expect(audit[0].resourceId).toBe("r1");
      expect(audit[0].userId).toBe("user-audit");
      expect(audit[0].timestamp).toBeTruthy();
      expect(typeof audit[0].timestamp).toBe("string");
      expect(audit[0].timestamp.length).toBeGreaterThan(0);
    });
  });
});
