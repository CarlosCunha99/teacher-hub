import { createReadStream as createNodeReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const DATA_DIR = process.env.DATA_DIR ?? "data";
const DEFAULT_UPLOADS_DIR = path.join(DATA_DIR, "uploads");
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_DIR);

export function resolveUploadPath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    throw new Error("invalid file path");
  }

  const absolutePath = path.resolve(UPLOADS_DIR, filePath);
  const relativePath = path.relative(UPLOADS_DIR, absolutePath);

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
