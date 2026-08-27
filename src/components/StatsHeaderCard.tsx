import type { ReactElement } from "react";

export interface StatsHeaderCardProps {
  totalLikes: number;
  totalDownloads: number;
}

export function StatsHeaderCard({
  totalLikes,
  totalDownloads,
}: StatsHeaderCardProps): ReactElement {
  return (
    <section>
      <h1>Teacher stats</h1>
      <p>
        Total likes: <span>{totalLikes}</span>
      </p>
      <p>
        Total downloads: <span>{totalDownloads}</span>
      </p>
    </section>
  );
}
