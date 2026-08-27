import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const resource = await db.resource.findUnique({ where: { id } });

    if (!resource || resource.status !== "PUBLISHED") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    await db.download.create({ data: { resourceId: id, userId: null } });
    revalidatePath(`/teachers/${resource.authorId}`);

    return Response.json({ success: true, fileUrl: resource.fileUrl }, { status: 200 });
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
