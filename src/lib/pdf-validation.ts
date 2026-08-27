const ACCEPTED_MIME_TYPE = "application/pdf";
const ACCEPTED_EXTENSION = ".pdf";
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export class PDFValidationError extends Error {
  readonly code:
    "invalid-mime-type" | "invalid-extension" | "file-too-large" | "empty-file" | "missing-file";

  constructor(
    code:
      "invalid-mime-type" | "invalid-extension" | "file-too-large" | "empty-file" | "missing-file"
  ) {
    const messages: Record<string, string> = {
      "invalid-mime-type": "File must be a PDF (application/pdf).",
      "invalid-extension": "File must have .pdf extension.",
      "file-too-large": `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB.`,
      "empty-file": "File cannot be empty.",
      "missing-file": "No file provided.",
    };
    super(messages[code]);
    this.code = code;
    this.name = "PDFValidationError";
  }
}

export function validatePDFFile(file: File): void {
  if (!file) {
    throw new PDFValidationError("missing-file");
  }

  if (file.size === 0) {
    throw new PDFValidationError("empty-file");
  }

  if (file.type !== ACCEPTED_MIME_TYPE) {
    throw new PDFValidationError("invalid-mime-type");
  }

  if (!file.name.toLowerCase().endsWith(ACCEPTED_EXTENSION)) {
    throw new PDFValidationError("invalid-extension");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PDFValidationError("file-too-large");
  }
}

export function validatePDFFileFromBuffer(buffer: Buffer, filename: string): void {
  if (!buffer || buffer.length === 0) {
    throw new PDFValidationError("empty-file");
  }

  const pdfSignature = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
  if (!buffer.subarray(0, 4).equals(pdfSignature)) {
    throw new PDFValidationError("invalid-mime-type");
  }

  if (!filename.toLowerCase().endsWith(ACCEPTED_EXTENSION)) {
    throw new PDFValidationError("invalid-extension");
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new PDFValidationError("file-too-large");
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export const PDF_VALIDATION_LIMITS = {
  maxFileSize: MAX_FILE_SIZE_BYTES,
  maxFileSizeMB: MAX_FILE_SIZE_BYTES / 1024 / 1024,
  acceptedMimeType: ACCEPTED_MIME_TYPE,
  acceptedExtension: ACCEPTED_EXTENSION,
};
