import { POST } from "@/app/api/resources/[resourceId]/comments/[commentId]/replies/route";
import { getCurrentUser } from "@/lib/auth";
import {
  createReply,
  createNotificationForReply,
  ValidationError,
  NotFoundError,
} from "@/lib/comments/service";

const { mockDbSelectResult } = vi.hoisted(() => {
  const mockDbSelectResult = vi.fn();
  return { mockDbSelectResult };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/comments/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/comments/service")>();
  return {
    ...actual,
    createReply: vi.fn(),
    createNotificationForReply: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbSelectResult(),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  commentsTable: { id: "id", authorId: "authorId", resourceId: "resourceId" },
}));

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockCreateReply = createReply as ReturnType<typeof vi.fn>;
const mockCreateNotificationForReply = createNotificationForReply as ReturnType<typeof vi.fn>;

const RESOURCE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PARENT_COMMENT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const PARENT_AUTHOR_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const testUser = { id: USER_ID, name: "Test User", role: "user" as const };

const routeContext = {
  params: Promise.resolve({
    resourceId: RESOURCE_ID,
    commentId: PARENT_COMMENT_ID,
  }),
};

function makeRequest(body?: Record<string, unknown>) {
  const url = `http://localhost/api/resources/${RESOURCE_ID}/comments/${PARENT_COMMENT_ID}/replies`;
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: parent comment exists with matching resourceId and a different author
  mockDbSelectResult.mockResolvedValue([{ authorId: PARENT_AUTHOR_ID, resourceId: RESOURCE_ID }]);
});

describe("POST /api/resources/[resourceId]/comments/[commentId]/replies", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(makeRequest({ body: "Reply" }), routeContext);

    expect(response.status).toBe(401);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
    expect(mockCreateReply).not.toHaveBeenCalled();
  });

  it("returns 400 when attempting to reply to a reply (one-level only)", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockCreateReply.mockRejectedValue(new ValidationError("cannot reply to a reply"));

    const response = await POST(makeRequest({ body: "Nested reply" }), routeContext);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
    expect(responseBody.error).toContain("cannot reply to a reply");
  });

  it("returns 404 when parent comment is soft-deleted", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockCreateReply.mockRejectedValue(new NotFoundError("Not found"));

    const response = await POST(makeRequest({ body: "Reply to deleted" }), routeContext);

    expect(response.status).toBe(404);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
  });

  it("returns 404 when parent comment not found", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockCreateReply.mockRejectedValue(new NotFoundError("Not found"));

    const response = await POST(makeRequest({ body: "Reply to missing" }), routeContext);

    expect(response.status).toBe(404);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
  });

  it("returns 201 with created reply Comment", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);

    const createdReply = {
      id: "reply-id-1",
      resourceId: RESOURCE_ID,
      authorId: USER_ID,
      authorName: "Test User",
      parentId: PARENT_COMMENT_ID,
      body: "Nice reply!",
      editedAt: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreateReply.mockResolvedValue(createdReply);
    mockCreateNotificationForReply.mockResolvedValue(undefined);

    const response = await POST(makeRequest({ body: "Nice reply!" }), routeContext);

    expect(response.status).toBe(201);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("id", "reply-id-1");
    expect(responseBody).toHaveProperty("parentId", PARENT_COMMENT_ID);
    expect(responseBody).toHaveProperty("body", "Nice reply!");
    expect(responseBody).toHaveProperty("authorId", USER_ID);

    // Notification should be dispatched (fire-and-forget)
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCreateNotificationForReply).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: RESOURCE_ID,
        parentCommentAuthorId: PARENT_AUTHOR_ID,
        replyCommentId: "reply-id-1",
        actorId: USER_ID,
      })
    );
  });
});
