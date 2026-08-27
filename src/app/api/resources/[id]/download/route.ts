import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { sanitiseFilename } from "@/lib/download/sanitise-filename";
import { createReadStream, fileExists, resolveUploadPath } from "@/lib/file-storage";
import { getResourceById, incrementDownload } from "@/lib/store/resource-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await getSessionUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const resource = await getResourceById(id);

    if (!resource) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const absolutePath = resolveUploadPath(resource.filePath);
    const exists = await fileExists(absolutePath);

    if (!exists) {
      return NextResponse.json({ error: "File unavailable" }, { status: 500 });
    }

    const baseStream = createReadStream(absolutePath);
    const trackedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = baseStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              await incrementDownload(resource.id, user.id);
              controller.close();
              return;
            }

            if (value) {
              controller.enqueue(value);
            }
          }
        } catch (error) {
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
      async cancel(reason) {
        await baseStream.cancel(reason);
      },
    });

    const fileName = `${sanitiseFilename(resource.name)}.pdf`;

    return new Response(trackedStream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 500 });
  }
}
