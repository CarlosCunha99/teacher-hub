import fs from "fs/promises";
import path from "path";
import type { Resource } from "@/lib/types";

type PartialResource = Partial<Resource> & { id: string };

const DEFAULT_RESOURCE: Omit<Resource, "id"> = {
  name: "Test Resource",
  ownerId: "owner-1",
  filePath: "test.pdf",
  downloadCount: 0,
  createdAt: "2024-01-01T00:00:00.000Z",
};

export async function createTestDataDir(suffix: string): Promise<string> {
  const dir = path.join(
    process.cwd(),
    "test-data",
    `${suffix}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function seedStore(dataDir: string, resources: PartialResource[]): Promise<void> {
  const full: Resource[] = resources.map((r) => ({
    ...DEFAULT_RESOURCE,
    ...r,
  }));
  await fs.writeFile(
    path.join(dataDir, "resources.json"),
    JSON.stringify({ resources: full }, null, 2)
  );
  await fs.writeFile(path.join(dataDir, "audit.json"), JSON.stringify([]));
}

export async function cleanupTestDataDir(dataDir: string): Promise<void> {
  await fs.rm(dataDir, { recursive: true, force: true });
}

export async function createTestUploadsDir(suffix: string): Promise<string> {
  const dir = path.join(
    process.cwd(),
    "test-data",
    `uploads-${suffix}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writeFakePdf(uploadsDir: string, filename: string): Promise<void> {
  await fs.writeFile(path.join(uploadsDir, filename), Buffer.from("%PDF-1.4 stub content"));
}
