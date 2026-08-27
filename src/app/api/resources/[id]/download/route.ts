import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { sanitiseFilename } from "@/lib/download/sanitise-filename";
import { createReadStream, fileExists, resolveUploadPath } from "@/lib/file-storage";
import { getResourceById, incrementDownload } from "@/lib/store/resource-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const reader = baseStream.getReader();
    const writer = writable.getWriter();
    let fullyWritten = false;

    const abortWriter = () => {
      void writer.abort().catch(() => undefined);
    };

    request.signal.addEventListener("abort", abortWriter, { once: true });

    void (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            await writer.close();
            fullyWritten = true;
            break;
          }

          if (value) {
            await writer.write(value);
          }
        }
      } catch (error) {
        await writer.abort(error).catch(() => undefined);
      } finally {
        request.signal.removeEventListener("abort", abortWriter);
        reader.releaseLock();

        if (fullyWritten && !request.signal.aborted) {
          try {
            await incrementDownload(resource.id, user.id);
          } catch {
            // Intentionally swallow to avoid unhandled background rejection.
          }
        }
      }
    })();

    const asciiName = `${sanitiseFilename(resource.name)}.pdf`;
    const encodedName = encodeURIComponent(`${resource.name}.pdf`);

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File unavailable" }, { status: 500 });
  }
}
