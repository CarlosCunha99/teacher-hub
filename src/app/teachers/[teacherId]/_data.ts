import { ResourceStatus } from "@prisma/client";
import { db } from "@/lib/db";

export async function fetchTeacherProfileData(teacherId: string): Promise<{
  totalLikes: number;
  totalDownloads: number;
  resources: Array<{
    id: string;
    title: string;
    status: "DRAFT" | "PUBLISHED";
    _count: { likes: number; downloads: number };
  }>;
}> {
  const resources = await db.resource.findMany({
    where: { authorId: teacherId, status: ResourceStatus.PUBLISHED },
    select: {
      id: true,
      title: true,
      status: true,
      _count: { select: { likes: true, downloads: true } },
    },
  });

  const totalLikes = await db.like.count({
    where: { resource: { authorId: teacherId, status: ResourceStatus.PUBLISHED } },
  });

  const totalDownloads = await db.download.count({
    where: { resource: { authorId: teacherId, status: ResourceStatus.PUBLISHED } },
  });

  return {
    totalLikes,
    totalDownloads,
    resources,
  };
}
