import ResourceDetailPage from "@/app/resources/[id]/page";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    resource: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ResourceDetailPage", () => {
  it("F4: renders resource title and download count for a published resource", async () => {
    vi.mocked(db.resource.findUnique).mockResolvedValue({
      id: "1",
      title: "My Resource",
      status: "PUBLISHED",
      authorId: "teacher-1",
      fileUrl: "https://example.com/file.pdf",
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { downloads: 7, likes: 2 },
    } as never);

    // ResourceDetailPage is a Server Component — call it as an async function.
    // Params in Next.js 15 are Promises.
    const jsx = await ResourceDetailPage({
      params: Promise.resolve({ id: "1" }),
    });

    // Convert JSX tree to string to assert on rendered content
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(jsx as React.ReactElement);

    expect(html).toContain("My Resource");
    expect(html).toContain("7");
  });
});
