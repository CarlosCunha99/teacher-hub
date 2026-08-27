import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { ResourceCard } from "@/components/ResourceCard";
import { db } from "@/lib/db";

export default async function ResourceDetailPage(props: {
  params: Promise<{ id: string }>;
}): Promise<ReactElement> {
  const { id } = await props.params;
  const resource = await db.resource.findUnique({
    where: { id },
    include: { _count: { select: { likes: true, downloads: true } } },
  });

  if (!resource || resource.status !== "PUBLISHED") {
    notFound();
  }

  return (
    <main>
      <ResourceCard
        id={resource.id}
        title={resource.title}
        downloadCount={resource._count.downloads}
      />
      <form action={`/api/resources/${resource.id}/download`} method="post">
        <button type="submit">Download</button>
      </form>
    </main>
  );
}
