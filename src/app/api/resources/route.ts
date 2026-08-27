import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireAuth } from "@/lib/auth";
import { validatePDFFileFromBuffer, PDFValidationError } from "@/lib/pdf-validation";
import { saveResourceFile, generateResourceFileName } from "@/lib/resource-storage";
import { addUploadedResource, generateResourceId } from "@/lib/uploaded-resources";
import { Resource } from "@/lib/resources";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = requireAuth();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: Please authenticate first." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const subject = formData.get("subject") as string;
    const yearLevel = formData.get("yearLevel") as string;
    const file = formData.get("file") as File;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required." }, { status: 400 });
    }

    if (!subject) {
      return NextResponse.json({ error: "Subject is required." }, { status: 400 });
    }

    if (!yearLevel) {
      return NextResponse.json({ error: "Year level is required." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      validatePDFFileFromBuffer(buffer, file.name);
    } catch (error) {
      if (error instanceof PDFValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: "Invalid PDF file." }, { status: 400 });
    }

    const resourceId = generateResourceId();
    const fileName = generateResourceFileName(resourceId, file.name);

    let filePath: string;
    try {
      filePath = await saveResourceFile(fileName, buffer);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "File storage failed.";
      return NextResponse.json({ error: errorMsg }, { status: 500 });
    }

    const now = new Date().toISOString();
    const newResource: Resource = {
      id: resourceId,
      title: title.trim(),
      description: description.trim(),
      subject,
      yearLevel,
      likes: 0,
      saves: 0,
      publishedAt: now,
      isPublished: true,
      ownerId: user.id,
      ownerName: user.name,
      filePath,
      fileSize: buffer.length,
      createdAt: now,
      updatedAt: now,
    };

    addUploadedResource(newResource);

    return NextResponse.json(
      { id: resourceId, message: "Resource uploaded successfully." },
      { status: 201 }
    );
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
