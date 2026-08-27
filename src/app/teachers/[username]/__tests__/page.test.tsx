import { renderToStaticMarkup } from "react-dom/server";
import type { Teacher, Resource, Board } from "@/lib/teachers";

// Per impl-context.md "Testing style": page functional tests mock `@/lib/teachers`
// entirely and mock `next/navigation` -> { notFound: vi.fn() }, then call the
// async Server Component function directly.
vi.mock("@/lib/teachers", () => ({
  getTeacherByUsername: vi.fn(),
  getPublishedResourcesByTeacher: vi.fn(),
  getShareableBoardsByTeacher: vi.fn(),
}));

// Real Next.js `notFound()` throws a special digest error to halt rendering;
// the mock replicates that so the component's control flow (and this test)
// behaves like the real framework instead of silently continuing to render.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

import {
  getTeacherByUsername,
  getPublishedResourcesByTeacher,
  getShareableBoardsByTeacher,
} from "@/lib/teachers";
import { notFound } from "next/navigation";
import TeacherProfilePage from "@/app/teachers/[username]/page";

const mockGetTeacherByUsername = vi.mocked(getTeacherByUsername);
const mockGetPublishedResourcesByTeacher = vi.mocked(getPublishedResourcesByTeacher);
const mockGetShareableBoardsByTeacher = vi.mocked(getShareableBoardsByTeacher);
const mockNotFound = vi.mocked(notFound);

const mockTeacher: Teacher = {
  id: "u1",
  username: "alice",
  name: "Alice Smith",
  bio: "Year 5 teacher",
  joinedAt: "2024-01-15T00:00:00Z",
};

const mockResources: Resource[] = [
  { id: "r1", teacherId: "u1", title: "Fractions Worksheet", status: "published" },
  { id: "r2", teacherId: "u1", title: "Times Tables Quiz", status: "published" },
];

const mockBoards: Board[] = [
  { id: "b1", teacherId: "u1", name: "Maths Resources", shareable: true },
];

async function renderPage(username: string) {
  const element = await TeacherProfilePage({
    params: Promise.resolve({ username }),
  });
  // notFound() may cause the component to return undefined/null without
  // rendering markup; only stringify when a renderable element is returned.
  return element ? renderToStaticMarkup(element) : "";
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TeacherProfilePage", () => {
  it("renders identity, resource list, and board list for a valid teacher", async () => {
    mockGetTeacherByUsername.mockResolvedValue(mockTeacher);
    mockGetPublishedResourcesByTeacher.mockResolvedValue(mockResources);
    mockGetShareableBoardsByTeacher.mockResolvedValue(mockBoards);

    const html = await renderPage("alice");

    expect(html).toContain(mockTeacher.name);
    expect(html).toContain(mockTeacher.bio);
    // Contract does not prescribe an exact joinedAt display format ("Not in
    // contract: HTML structure ... visual layout"), so assert the year is
    // present rather than requiring the raw ISO string verbatim.
    expect(html).toContain("2024");
    expect(html).toContain(mockResources[0].title);
    expect(html).toContain(mockResources[1].title);
    expect(html).toContain(mockBoards[0].name);
    // Count labels use unambiguous, contextualized text ("Resources (N)" /
    // "Boards (N)") rather than bare digits, which also appear in IDs/dates
    // and would otherwise let a wrong or missing count pass silently.
    expect(html).toContain(`Resources (${mockResources.length})`);
    expect(html).toContain(`Boards (${mockBoards.length})`);
    expect(mockNotFound).not.toHaveBeenCalled();
    // The collection lookups must be scoped to the *found* teacher's id.
    expect(mockGetPublishedResourcesByTeacher).toHaveBeenCalledWith(mockTeacher.id);
    expect(mockGetShareableBoardsByTeacher).toHaveBeenCalledWith(mockTeacher.id);
  });

  it("calls notFound() for an unknown username and does not render teacher markup", async () => {
    mockGetTeacherByUsername.mockResolvedValue(null);
    mockGetPublishedResourcesByTeacher.mockResolvedValue([]);
    mockGetShareableBoardsByTeacher.mockResolvedValue([]);

    // notFound() throws to halt rendering (see mock above), so the component
    // call should reject rather than resolve to teacher markup.
    await expect(renderPage("ghost")).rejects.toThrow();
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });

  it("shows empty states when the teacher has zero published resources and zero shareable boards", async () => {
    mockGetTeacherByUsername.mockResolvedValue(mockTeacher);
    mockGetPublishedResourcesByTeacher.mockResolvedValue([]);
    mockGetShareableBoardsByTeacher.mockResolvedValue([]);

    const html = await renderPage("newteacher");

    expect(html).toContain(mockTeacher.name);
    // Distinct, unambiguous zero-count labels for each collection — a single
    // occurrence of "0" cannot satisfy both.
    expect(html).toContain("Resources (0)");
    expect(html).toContain("Boards (0)");
    // Distinct empty-state messages for each collection.
    expect(html).toContain("No published resources yet.");
    expect(html).toContain("No shareable boards yet.");
    expect(html).not.toContain(mockResources[0].title);
    expect(html).not.toContain(mockBoards[0].name);
  });

  it("counts equal the lengths of the arrays returned by the DAL", async () => {
    mockGetTeacherByUsername.mockResolvedValue(mockTeacher);
    mockGetPublishedResourcesByTeacher.mockResolvedValue(mockResources);
    mockGetShareableBoardsByTeacher.mockResolvedValue(mockBoards);

    const html = await renderPage("alice");

    expect(html).toContain(`Resources (${mockResources.length})`);
    expect(html).toContain(`Boards (${mockBoards.length})`);
    expect(mockGetPublishedResourcesByTeacher).toHaveBeenCalledWith(mockTeacher.id);
    expect(mockGetShareableBoardsByTeacher).toHaveBeenCalledWith(mockTeacher.id);
  });
});
