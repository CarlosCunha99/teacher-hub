import { GET, POST } from "@/app/api/resources/[resourceId]/comments/route";
import { getCurrentUser } from "@/lib/auth";
import {
  listComments,
  createComment,
  createNotificationForComment,
  ValidationError,
} from "@/lib/comments/service";

const { mockDbThenFn } = vi.hoisted(() => {
  const mockDbThenFn = vi.fn();
  return { mockDbThenFn };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/comments/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/comments/service")>();
  return {
    ...actual,
    listComments: vi.fn(),
    createComment: vi.fn(),
    createNotificationForComment: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => ({
            then: mockDbThenFn,
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  resourcesTable: { id: "id", ownerId: "ownerId" },
  commentsTable: {},
  notificationsTable: {},
}));

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockListComments = listComments as ReturnType<typeof vi.fn>;
const mockCreateComment = createComment as ReturnType<typeof vi.fn>;
const mockCreateNotificationForComment = createNotificationForComment as ReturnType<typeof vi.fn>;

const RESOURCE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OWNER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const testUser = { id: USER_ID, name: "Test User", role: "user" as const };

function makeRequest(method: string, query = "", body?: Record<string, unknown>) {
  const url = `http://localhost/api/resources/${RESOURCE_ID}/comments${query}`;
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

const routeContext = {
  params: Promise.resolve({ resourceId: RESOURCE_ID }),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: the DB select chain for resource owner resolves with OWNER_ID
  mockDbThenFn.mockImplementation((resolve: (v: unknown) => void) => {
    resolve([{ ownerId: OWNER_ID }]);
    return { catch: () => undefined };
  });
});

describe("GET /api/resources/[resourceId]/comments", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(makeRequest("GET"), routeContext);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 200 with paginated CommentWithReplies when authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    const mockResult = {
      items: [
        {
          id: "c1",
          resourceId: RESOURCE_ID,
          authorId: USER_ID,
          authorName: "Test User",
          parentId: null,
          body: "Hello",
          editedAt: null,
          deletedAt: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          replies: [],
        },
      ],
      nextCursor: null,
    };
    mockListComments.mockResolvedValue(mockResult);

    const response = await GET(makeRequest("GET"), routeContext);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("nextCursor");
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toHaveProperty("replies");
  });

  it("passes default limit of 20 and accepts cursor param", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockListComments.mockResolvedValue({ items: [], nextCursor: null });

    const cursorValue = "someCursorBase64";
    await GET(makeRequest("GET", `?cursor=${cursorValue}`), routeContext);

    expect(mockListComments).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: RESOURCE_ID,
        cursor: cursorValue,
        limit: 20,
      })
    );
  });
});

describe("POST /api/resources/[resourceId]/comments", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(makeRequest("POST", "", { body: "Hello" }), routeContext);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(mockCreateComment).not.toHaveBeenCalled();
  });

  it("returns 400 with empty body", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockCreateComment.mockRejectedValue(new ValidationError("Comment body cannot be empty"));

    const response = await POST(makeRequest("POST", "", { body: "" }), routeContext);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
    expect(typeof responseBody.error).toBe("string");
  });

  it("returns 400 with body > 2000 chars", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockCreateComment.mockRejectedValue(new ValidationError("Comment body exceeds maximum length"));

    const response = await POST(makeRequest("POST", "", { body: "a".repeat(2001) }), routeContext);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
  });

  it("returns 201 with created Comment on valid input", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);

    const createdComment = {
      id: "new-comment-id",
      resourceId: RESOURCE_ID,
      authorId: USER_ID,
      authorName: "Test User",
      parentId: null,
      body: "Great resource!",
      editedAt: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreateComment.mockResolvedValue(createdComment);
    mockCreateNotificationForComment.mockResolvedValue(undefined);

    const response = await POST(
      makeRequest("POST", "", { body: "  Great resource!  " }),
      routeContext
    );

    expect(response.status).toBe(201);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("id");
    expect(responseBody).toHaveProperty("resourceId", RESOURCE_ID);
    expect(responseBody).toHaveProperty("authorId", USER_ID);
  });

  it("fires notification (fire-and-forget — verify the notification service was called)", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);

    const createdComment = {
      id: "new-comment-id",
      resourceId: RESOURCE_ID,
      authorId: USER_ID,
      authorName: "Test User",
      parentId: null,
      body: "Nice!",
      editedAt: null,
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockCreateComment.mockResolvedValue(createdComment);
    mockCreateNotificationForComment.mockResolvedValue(undefined);

    const response = await POST(makeRequest("POST", "", { body: "Nice!" }), routeContext);

    expect(response.status).toBe(201);

    // Allow microtask tick for fire-and-forget promise chain
    await new Promise((r) => setTimeout(r, 50));
    expect(mockCreateNotificationForComment).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: RESOURCE_ID,
        resourceOwnerId: OWNER_ID,
        commentId: "new-comment-id",
        actorId: USER_ID,
      })
    );
  });
});
