import { createReadStream as createNodeReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

function getUploadsDir(): string {
  const dataDir = process.env.DATA_DIR ?? "data";
  const defaultUploadsDir = path.join(dataDir, "uploads");

  return path.resolve(process.env.UPLOADS_DIR ?? defaultUploadsDir);
}

export function resolveUploadPath(filePath: string): string {
  const uploadsDir = getUploadsDir();

  if (path.isAbsolute(filePath)) {
    throw new Error("invalid file path");
  }

  const absolutePath = path.resolve(uploadsDir, filePath);
  const relativePath = path.relative(uploadsDir, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("invalid file path");
  }

  return absolutePath;
}

export async function fileExists(absolutePath: string): Promise<boolean> {
  try {
    const fileStat = await stat(absolutePath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

export function createReadableStream(absolutePath: string): ReadableStream<Uint8Array> {
  const nodeStream = createNodeReadStream(absolutePath);
  return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
}

export const createReadStream = createReadableStream;
