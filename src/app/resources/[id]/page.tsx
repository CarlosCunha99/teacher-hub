import { notFound } from "next/navigation";
import type { JSX } from "react";
import { ResourceCard } from "@/components/ResourceCard";
import { getResourceById } from "@/lib/store/resource-store";

export default async function ResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<JSX.Element> {
  const { id } = await params;
  const resource = await getResourceById(id);

  if (!resource) {
    notFound();
  }

  const { filePath: _filePath, ...safeResource } = resource;

  return (
    <main>
      <h1>Resource</h1>
      <ResourceCard resource={safeResource} />
      <a href={`/api/resources/${resource.id}/download`}>Download PDF</a>
    </main>
  );
}
