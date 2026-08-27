import { PATCH, DELETE } from "@/app/api/resources/[resourceId]/comments/[commentId]/route";
import { getCurrentUser } from "@/lib/auth";
import {
  editComment,
  softDeleteComment,
  ValidationError,
  AuthzError,
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
    editComment: vi.fn(),
    softDeleteComment: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbSelectResult(...args),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  resourcesTable: { id: "id", ownerId: "ownerId" },
  commentsTable: { id: "id", resourceId: "resourceId" },
}));

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockEditComment = editComment as ReturnType<typeof vi.fn>;
const mockSoftDeleteComment = softDeleteComment as ReturnType<typeof vi.fn>;

const RESOURCE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMMENT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const AUTHOR_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OTHER_USER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const OWNER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const MODERATOR_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";

const authorUser = { id: AUTHOR_ID, name: "Author", role: "user" as const };
const otherUser = { id: OTHER_USER_ID, name: "Other", role: "user" as const };
const ownerUser = { id: OWNER_ID, name: "Owner", role: "user" as const };
const moderatorUser = {
  id: MODERATOR_ID,
  name: "Moderator",
  role: "moderator" as const,
};

const routeContext = {
  params: Promise.resolve({ resourceId: RESOURCE_ID, commentId: COMMENT_ID }),
};

function makeRequest(method: string, body?: Record<string, unknown>) {
  const url = `http://localhost/api/resources/${RESOURCE_ID}/comments/${COMMENT_ID}`;
  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  // The DB mock is called for assertCommentBelongsToResource and getResourceOwnerId.
  // Return a merged shape that satisfies both queries.
  mockDbSelectResult.mockResolvedValue([{ resourceId: RESOURCE_ID, ownerId: OWNER_ID }]);
});

describe("PATCH /api/resources/[resourceId]/comments/[commentId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await PATCH(makeRequest("PATCH", { body: "Updated" }), routeContext);

    expect(response.status).toBe(401);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
    expect(mockEditComment).not.toHaveBeenCalled();
  });

  it("returns 403 when editor is not the author", async () => {
    mockGetCurrentUser.mockResolvedValue(otherUser);
    mockEditComment.mockRejectedValue(new AuthzError());

    const response = await PATCH(makeRequest("PATCH", { body: "Hacked!" }), routeContext);

    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
  });

  it("returns 400 with empty body", async () => {
    mockGetCurrentUser.mockResolvedValue(authorUser);
    mockEditComment.mockRejectedValue(new ValidationError("Comment body cannot be empty"));

    const response = await PATCH(makeRequest("PATCH", { body: "" }), routeContext);

    expect(response.status).toBe(400);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
  });

  it("returns 200 with updated Comment", async () => {
    mockGetCurrentUser.mockResolvedValue(authorUser);

    const updatedComment = {
      id: COMMENT_ID,
      resourceId: RESOURCE_ID,
      authorId: AUTHOR_ID,
      authorName: "Author",
      parentId: null,
      body: "Updated body",
      editedAt: "2026-01-02T00:00:00.000Z",
      deletedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    mockEditComment.mockResolvedValue(updatedComment);

    const response = await PATCH(makeRequest("PATCH", { body: "Updated body" }), routeContext);

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("id", COMMENT_ID);
    expect(responseBody).toHaveProperty("body", "Updated body");
    expect(responseBody.editedAt).not.toBeNull();
  });
});

describe("DELETE /api/resources/[resourceId]/comments/[commentId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await DELETE(makeRequest("DELETE"), routeContext);

    expect(response.status).toBe(401);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
    expect(mockSoftDeleteComment).not.toHaveBeenCalled();
  });

  it("returns 403 when actor not authorized", async () => {
    mockGetCurrentUser.mockResolvedValue(otherUser);
    mockSoftDeleteComment.mockRejectedValue(new AuthzError());

    const response = await DELETE(makeRequest("DELETE"), routeContext);

    expect(response.status).toBe(403);
    const responseBody = await response.json();
    expect(responseBody).toHaveProperty("error");
  });

  it("returns 204 on success (author can delete their own)", async () => {
    mockGetCurrentUser.mockResolvedValue(authorUser);
    mockSoftDeleteComment.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("DELETE"), routeContext);

    expect(response.status).toBe(204);
    expect(mockSoftDeleteComment).toHaveBeenCalled();
  });

  it("returns 204 when resource owner deletes", async () => {
    mockGetCurrentUser.mockResolvedValue(ownerUser);
    mockSoftDeleteComment.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("DELETE"), routeContext);

    expect(response.status).toBe(204);
    expect(mockSoftDeleteComment).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: COMMENT_ID,
        actorId: OWNER_ID,
      })
    );
  });

  it("returns 204 when moderator deletes", async () => {
    mockGetCurrentUser.mockResolvedValue(moderatorUser);
    mockSoftDeleteComment.mockResolvedValue(undefined);

    const response = await DELETE(makeRequest("DELETE"), routeContext);

    expect(response.status).toBe(204);
    expect(mockSoftDeleteComment).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: COMMENT_ID,
        actorId: MODERATOR_ID,
        actorRole: "moderator",
      })
    );
  });
});
