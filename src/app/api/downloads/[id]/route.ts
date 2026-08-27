import { getSession } from "@/lib/auth";
import db, { type DbClient } from "@/lib/db";
import {
  QuotaExceededError,
  checkAndIncrementQuota,
  type QuotaExceededBody,
} from "@/lib/download-quota";

type DownloadResource = {
  id: string;
  owner_id: string;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
};

async function getDownloadResourceById(
  id: string,
  dbClient: DbClient
): Promise<DownloadResource | null> {
  const result = await dbClient.query<DownloadResource>(
    `
      SELECT id, owner_id, file_url, file_name, mime_type
      FROM resources
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

function buildContentDisposition(fileName: string | null): string {
  if (!fileName) {
    return 'attachment; filename="resource"';
  }

  return `attachment; filename="${fileName.replace(/"/g, "")}"`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const resolvedParams = await params;
  const session = await getSession(request);

  if (!session) {
    return new Response(null, { status: 401 });
  }

  const resource = await getDownloadResourceById(resolvedParams.id, db);
  if (!resource) {
    return new Response(null, { status: 404 });
  }

  try {
    await checkAndIncrementQuota(session.user.id, session.user.tier, resource.owner_id, db);
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      const body: QuotaExceededBody = {
        code: error.code,
        limit: error.limit,
        reset_at: error.reset_at,
        upgrade_url: error.upgrade_url,
      };

      return Response.json(body, { status: 402 });
    }

    throw error;
  }

  const upstream = await fetch(resource.file_url);
  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "Failed to fetch download content" }, { status: 502 });
  }

  const headers = new Headers();
  headers.set("content-type", resource.mime_type || "application/octet-stream");
  headers.set("content-disposition", buildContentDisposition(resource.file_name));

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
}
