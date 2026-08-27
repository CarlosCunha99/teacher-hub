import { PATCH } from "@/app/api/notifications/[notificationId]/route";
import { getCurrentUser } from "@/lib/auth";

const { mockDbSelectResult, mockDbUpdateResult } = vi.hoisted(() => {
  const mockDbSelectResult = vi.fn();
  const mockDbUpdateResult = vi.fn();
  return { mockDbSelectResult, mockDbUpdateResult };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/comments/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/comments/service")>();
  return {
    ...actual,
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
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => mockDbUpdateResult(),
        }),
      }),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  notificationsTable: {
    id: "id",
    recipientId: "recipientId",
    type: "type",
    resourceId: "resourceId",
    commentId: "commentId",
    readAt: "readAt",
    createdAt: "createdAt",
  },
}));

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;

const USER_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const OTHER_USER_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const NOTIFICATION_ID = "nnnnnnnn-nnnn-nnnn-nnnn-nnnnnnnnnnnn";

const testUser = { id: USER_ID, name: "Test User", role: "user" as const };

const routeContext = {
  params: Promise.resolve({ notificationId: NOTIFICATION_ID }),
};

function makeRequest() {
  return new Request(`http://localhost/api/notifications/${NOTIFICATION_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/notifications/[notificationId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await PATCH(makeRequest(), routeContext);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 403 when recipient is different user", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockDbSelectResult.mockResolvedValue([
      {
        id: NOTIFICATION_ID,
        recipientId: OTHER_USER_ID,
        type: "comment_on_resource",
        resourceId: "r1",
        commentId: "c1",
        readAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await PATCH(makeRequest(), routeContext);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 200 with notification with readAt set", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockDbSelectResult.mockResolvedValue([
      {
        id: NOTIFICATION_ID,
        recipientId: USER_ID,
        type: "comment_on_resource",
        resourceId: "r1",
        commentId: "c1",
        readAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mockDbUpdateResult.mockResolvedValue([
      {
        id: NOTIFICATION_ID,
        recipientId: USER_ID,
        type: "comment_on_resource",
        resourceId: "r1",
        commentId: "c1",
        readAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const response = await PATCH(makeRequest(), routeContext);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("id", NOTIFICATION_ID);
    expect(body).toHaveProperty("readAt");
    expect(body.readAt).not.toBeNull();
  });
});
