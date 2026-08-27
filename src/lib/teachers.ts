import {
  findTeacherByUsername,
  findResourcesByTeacher,
  findBoardsByTeacher,
} from "@/lib/teachers-data";

export interface Teacher {
  id: string;
  username: string;
  name: string;
  bio: string;
  joinedAt: string;
}

export interface Resource {
  id: string;
  teacherId: string;
  title: string;
  status: "published" | "draft";
}

export interface Board {
  id: string;
  teacherId: string;
  name: string;
  shareable: boolean;
}

export async function getTeacherByUsername(username: string): Promise<Teacher | null> {
  return findTeacherByUsername(username);
}

export async function getPublishedResourcesByTeacher(teacherId: string): Promise<Resource[]> {
  const resources = await findResourcesByTeacher(teacherId);
  return resources.filter((resource) => resource.status === "published");
}

export async function getShareableBoardsByTeacher(teacherId: string): Promise<Board[]> {
  const boards = await findBoardsByTeacher(teacherId);
  return boards.filter((board) => board.shareable === true);
}
