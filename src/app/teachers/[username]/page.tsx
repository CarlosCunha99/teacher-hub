import { notFound } from "next/navigation";
import {
  getTeacherByUsername,
  getPublishedResourcesByTeacher,
  getShareableBoardsByTeacher,
} from "@/lib/teachers";

interface PageProps {
  params: Promise<{ username: string }>;
}

function formatJoinedDate(joinedAt: string): string {
  const date = new Date(joinedAt);
  if (Number.isNaN(date.getTime())) {
    return joinedAt;
  }
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function TeacherProfilePage(props: PageProps) {
  const { username } = await props.params;
  const teacher = await getTeacherByUsername(username);

  if (teacher === null) {
    notFound();
  }

  const [resources, boards] = await Promise.all([
    getPublishedResourcesByTeacher(teacher.id),
    getShareableBoardsByTeacher(teacher.id),
  ]);

  return (
    <main>
      <header>
        <h1>{teacher.name}</h1>
        <p>@{teacher.username}</p>
        {teacher.bio ? <p>{teacher.bio}</p> : null}
        <p>Joined {formatJoinedDate(teacher.joinedAt)}</p>
      </header>

      <section aria-labelledby="resources-heading">
        <h2 id="resources-heading">Resources ({resources.length})</h2>
        {resources.length > 0 ? (
          <ul>
            {resources.map((resource) => (
              <li key={resource.id}>{resource.title}</li>
            ))}
          </ul>
        ) : (
          <p>No published resources yet.</p>
        )}
      </section>

      <section aria-labelledby="boards-heading">
        <h2 id="boards-heading">Boards ({boards.length})</h2>
        {boards.length > 0 ? (
          <ul>
            {boards.map((board) => (
              <li key={board.id}>{board.name}</li>
            ))}
          </ul>
        ) : (
          <p>No shareable boards yet.</p>
        )}
      </section>
    </main>
  );
}
