import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { PDFValidationError, validatePDFFileFromBuffer } from "@/lib/pdf-validation";
import {
  saveResourceFile,
  deleteResourceFile,
  generateResourceFileName,
} from "@/lib/resource-storage";
import {
  getUploadedResourceById,
  updateUploadedResource,
  deleteUploadedResource,
} from "@/lib/uploaded-resources";

interface RouteParams {
  id: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
): Promise<Response> {
  try {
    const user = requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Please authenticate first." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const resource = getUploadedResourceById(id);

    if (!resource) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (resource.ownerId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You can only edit resources you own." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const title = (formData.get("title") as string) || resource.title;
    const description = (formData.get("description") as string) || resource.description;
    const subject = (formData.get("subject") as string) || resource.subject;
    const yearLevel = (formData.get("yearLevel") as string) || resource.yearLevel;
    const file = formData.get("file") as File | null;

    let filePath = resource.filePath;
    let fileSize = resource.fileSize;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());

      try {
        validatePDFFileFromBuffer(buffer, file.name);
      } catch (error) {
        if (error instanceof PDFValidationError) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Invalid PDF file." }, { status: 400 });
      }

      if (resource.filePath) {
        try {
          await deleteResourceFile(resource.filePath);
        } catch {
          // File deletion failed, but continue with new upload
        }
      }

      const fileName = generateResourceFileName(id, file.name);

      try {
        filePath = await saveResourceFile(fileName, buffer);
        fileSize = buffer.length;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "File storage failed.";
        return NextResponse.json({ error: errorMsg }, { status: 500 });
      }
    }

    const now = new Date().toISOString();
    const updated = updateUploadedResource(id, {
      title: title.trim(),
      description: description.trim(),
      subject,
      yearLevel,
      filePath,
      fileSize,
      updatedAt: now,
    });

    if (!updated) {
      return NextResponse.json({ error: "Failed to update resource." }, { status: 500 });
    }

    return NextResponse.json({ id, message: "Resource updated successfully." }, { status: 200 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred.";

    if (errorMsg === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized: Please authenticate first." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<RouteParams> }
): Promise<Response> {
  try {
    const user = requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Please authenticate first." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const resource = getUploadedResourceById(id);

    if (!resource) {
      return NextResponse.json({ error: "Resource not found." }, { status: 404 });
    }

    if (resource.ownerId !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized: You can only delete resources you own." },
        { status: 403 }
      );
    }

    if (resource.filePath) {
      try {
        await deleteResourceFile(resource.filePath);
      } catch {
        // File deletion failed, but continue with resource deletion
      }
    }

    const deleted = deleteUploadedResource(id);

    if (!deleted) {
      return NextResponse.json({ error: "Failed to delete resource." }, { status: 500 });
    }

    return NextResponse.json({ message: "Resource deleted successfully." }, { status: 200 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "An unexpected error occurred.";

    if (errorMsg === "Unauthorized") {
      return NextResponse.json(
        { error: "Unauthorized: Please authenticate first." },
        { status: 401 }
      );
    }

    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
