import type { ReactElement } from "react";
import { ResourceCard } from "@/components/ResourceCard";
import { StatsHeaderCard } from "@/components/StatsHeaderCard";
import { fetchTeacherProfileData } from "./_data";

export default async function TeacherProfilePage(props: {
  params: Promise<{ teacherId: string }>;
}): Promise<ReactElement> {
  const { teacherId } = await props.params;
  const { totalLikes, totalDownloads, resources } = await fetchTeacherProfileData(teacherId);

  return (
    <main>
      <StatsHeaderCard totalLikes={totalLikes} totalDownloads={totalDownloads} />
      <section>
        {resources.map((resource) => (
          <ResourceCard
            key={resource.id}
            id={resource.id}
            title={resource.title}
            downloadCount={resource._count.downloads}
          />
        ))}
      </section>
    </main>
  );
}
