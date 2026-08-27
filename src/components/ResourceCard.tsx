import type { JSX } from "react";
import type { Resource } from "@/lib/types";

type ResourceCardProps = {
  resource: Omit<Resource, "filePath">;
};

export function ResourceCard({ resource }: ResourceCardProps): JSX.Element {
  return (
    <article>
      <h2>{resource.name}</h2>
      <p>Downloads: {resource.downloadCount}</p>
    </article>
  );
}
