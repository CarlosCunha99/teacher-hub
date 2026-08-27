import type { ReactElement } from "react";

export interface ResourceCardProps {
  id: string;
  title: string;
  downloadCount: number;
}

export function ResourceCard({ id, title, downloadCount }: ResourceCardProps): ReactElement {
  return (
    <article data-resource-id={id}>
      <h2>{title}</h2>
      <p>
        Downloads: <span>{downloadCount}</span>
      </p>
    </article>
  );
}
