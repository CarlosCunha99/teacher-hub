/**
 * In-memory data source for teacher profiles.
 *
 * This module is a deliberate, temporary seam. It stands in for the real
 * database client that ticket #3 introduces. When the real DB lands, only the
 * bodies of the `find*` helpers below change (to issue SQL and map rows) — the
 * exported function names/signatures and everything in `@/lib/teachers` and the
 * profile page stay untouched.
 *
 * Rows are stored in snake_case to mirror the eventual SQL schema; the helpers
 * map them to the camelCase domain types before returning.
 */
import type { Teacher, Resource, Board } from "@/lib/teachers";

interface TeacherRow {
  id: string;
  username: string;
  name: string;
  bio: string;
  joined_at: string;
}

interface ResourceRow {
  id: string;
  teacher_id: string;
  title: string;
  status: "published" | "draft";
}

interface BoardRow {
  id: string;
  teacher_id: string;
  name: string;
  shareable: boolean;
}

const teacherRows: TeacherRow[] = [
  {
    id: "t1",
    username: "ada",
    name: "Ada Lovelace",
    bio: "Maths teacher exploring computing with her students.",
    joined_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "t2",
    username: "grace",
    name: "Grace Hopper",
    bio: "",
    joined_at: "2024-03-02T00:00:00Z",
  },
];

const resourceRows: ResourceRow[] = [
  { id: "r1", teacher_id: "t1", title: "Intro to Algorithms", status: "published" },
  { id: "r2", teacher_id: "t1", title: "Loops Worksheet", status: "published" },
  { id: "r3", teacher_id: "t1", title: "Draft: Recursion", status: "draft" },
];

const boardRows: BoardRow[] = [
  { id: "b1", teacher_id: "t1", name: "Year 9 Maths", shareable: true },
  { id: "b2", teacher_id: "t1", name: "Private Planning", shareable: false },
];

function toTeacher(row: TeacherRow): Teacher {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    bio: row.bio,
    joinedAt: row.joined_at,
  };
}

function toResource(row: ResourceRow): Resource {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    title: row.title,
    status: row.status,
  };
}

function toBoard(row: BoardRow): Board {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    name: row.name,
    shareable: row.shareable,
  };
}

export async function findTeacherByUsername(username: string): Promise<Teacher | null> {
  const normalized = username.toLowerCase();
  const row = teacherRows.find((teacher) => teacher.username.toLowerCase() === normalized);
  return row ? toTeacher(row) : null;
}

export async function findResourcesByTeacher(teacherId: string): Promise<Resource[]> {
  return resourceRows.filter((resource) => resource.teacher_id === teacherId).map(toResource);
}

export async function findBoardsByTeacher(teacherId: string): Promise<Board[]> {
  return boardRows.filter((board) => board.teacher_id === teacherId).map(toBoard);
}
