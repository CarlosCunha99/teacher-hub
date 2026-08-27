import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const STORAGE_DIR = process.env.RESOURCE_STORAGE_DIR || "public/resources";

export class StorageError extends Error {
  readonly code: "save-failed" | "delete-failed" | "invalid-path";

  constructor(code: "save-failed" | "delete-failed" | "invalid-path", message: string) {
    super(message);
    this.code = code;
    this.name = "StorageError";
  }
}

async function ensureStorageDir(): Promise<void> {
  if (!existsSync(STORAGE_DIR)) {
    try {
      await mkdir(STORAGE_DIR, { recursive: true });
    } catch (error) {
      throw new StorageError(
        "save-failed",
        `Failed to create storage directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export async function saveResourceFile(filename: string, buffer: Buffer): Promise<string> {
  if (!filename || filename.includes("..") || filename.includes("/")) {
    throw new StorageError("invalid-path", "Invalid filename.");
  }

  await ensureStorageDir();

  const filepath = join(STORAGE_DIR, filename);

  try {
    await writeFile(filepath, buffer);
    return `/resources/${filename}`;
  } catch (error) {
    throw new StorageError(
      "save-failed",
      `Failed to save file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function deleteResourceFile(filepath: string): Promise<void> {
  if (!filepath.startsWith("/resources/")) {
    throw new StorageError("invalid-path", "Invalid file path.");
  }

  const filename = filepath.replace("/resources/", "");
  if (filename.includes("..") || filename.includes("/")) {
    throw new StorageError("invalid-path", "Invalid filename.");
  }

  const fullPath = join(STORAGE_DIR, filename);

  try {
    await unlink(fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw new StorageError(
      "delete-failed",
      `Failed to delete file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function generateResourceFileName(resourceId: string, originalFilename: string): string {
  const ext = originalFilename.toLowerCase().endsWith(".pdf") ? ".pdf" : ".pdf";
  const timestamp = Date.now();
  return `${resourceId}-${timestamp}${ext}`;
}
