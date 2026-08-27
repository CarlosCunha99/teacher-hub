import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DownloadRecord, Resource, StoreData } from "@/lib/types";

let writeQueue: Promise<void> = Promise.resolve();

function getStorePaths(): { resourcesFilePath: string; auditFilePath: string } {
  const dataDir = process.env.DATA_DIR ?? "data";

  return {
    resourcesFilePath: path.resolve(dataDir, "resources.json"),
    auditFilePath: path.resolve(dataDir, "audit.json"),
  };
}

function withWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(task, task);
  writeQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function readStoreFile(): Promise<StoreData> {
  const { resourcesFilePath } = getStorePaths();

  try {
    const raw = await readFile(resourcesFilePath, "utf8");
    return JSON.parse(raw) as StoreData;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { resources: [] };
    }
    throw error;
  }
}

async function readAuditFile(): Promise<DownloadRecord[]> {
  const { auditFilePath } = getStorePaths();

  try {
    const raw = await readFile(auditFilePath, "utf8");
    return JSON.parse(raw) as DownloadRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writeJsonAtomic(filePath: string, payload: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempPath, payload, "utf8");
  await rename(tempPath, filePath);
}

export async function getStore(): Promise<StoreData> {
  return readStoreFile();
}

export async function getResourceById(id: string): Promise<Resource | null> {
  const store = await getStore();
  return store.resources.find((resource) => resource.id === id) ?? null;
}

export async function getResourcesByOwner(ownerId: string): Promise<Resource[]> {
  const store = await getStore();
  return store.resources.filter((resource) => resource.ownerId === ownerId);
}

export async function incrementDownload(resourceId: string, userId: string): Promise<void> {
  await withWriteLock(async () => {
    const { resourcesFilePath, auditFilePath } = getStorePaths();
    const store = await readStoreFile();
    const resource = store.resources.find((item) => item.id === resourceId);

    if (!resource) {
      throw new Error("Resource not found");
    }

    resource.downloadCount += 1;

    const audit = await readAuditFile();
    audit.push({
      resourceId,
      userId,
      timestamp: new Date().toISOString(),
    });

    await writeJsonAtomic(resourcesFilePath, `${JSON.stringify(store, null, 2)}\n`);
    await writeJsonAtomic(auditFilePath, `${JSON.stringify(audit, null, 2)}\n`);
  });
}
