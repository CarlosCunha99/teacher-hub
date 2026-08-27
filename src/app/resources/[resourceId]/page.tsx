import { headers } from "next/headers";
import { CommentThread } from "@/components/comments/CommentThread";
import { getCurrentUser } from "@/lib/auth";

type ResourceDetailPageProps = {
  params: Promise<{
    resourceId: string;
  }>;
};

export default async function ResourceDetailPage({ params }: ResourceDetailPageProps) {
  const { resourceId } = await params;
  const request = new Request(`http://localhost/resources/${resourceId}`, {
    headers: await headers(),
  });
  const currentUser = await getCurrentUser(request);

  return (
    <main style={{ margin: "0 auto", maxWidth: 960, padding: "2rem 1rem" }}>
      <header style={{ marginBottom: 32 }}>
        <h1>Resource discussion</h1>
        <p>Collaborate with other teachers by sharing context and feedback.</p>
      </header>
      <CommentThread currentUser={currentUser} resourceId={resourceId} />
    </main>
  );
}
