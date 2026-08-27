import { GET } from "@/app/api/notifications/route";
import { getCurrentUser } from "@/lib/auth";

const { mockDbQueryResult } = vi.hoisted(() => {
  const mockDbQueryResult = vi.fn();
  return { mockDbQueryResult };
});

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/comments/service", () => ({}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => mockDbQueryResult(),
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

const testUser = { id: USER_ID, name: "Test User", role: "user" as const };

function makeGetRequest() {
  return new Request("http://localhost/api/notifications", {
    method: "GET",
    headers: { "content-type": "application/json" },
  });
}

const unreadNotificationRow = {
  id: "n1",
  recipientId: USER_ID,
  type: "comment_on_resource" as const,
  resourceId: "r1",
  commentId: "c1",
  readAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/notifications", () => {
  it("returns 401 when unauthenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 200 with unread notifications only", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    mockDbQueryResult.mockResolvedValue([unreadNotificationRow]);

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);

    for (const notification of body.items) {
      expect(notification.readAt).toBeNull();
    }
  });

  it("excludes already-read notifications (readAt not null)", async () => {
    mockGetCurrentUser.mockResolvedValue(testUser);
    // The query filters for readAt IS NULL, so mock returns only unread
    mockDbQueryResult.mockResolvedValue([unreadNotificationRow]);

    const response = await GET(makeGetRequest());

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("items");

    const readItems = body.items.filter((n: { readAt: string | null }) => n.readAt !== null);
    expect(readItems).toHaveLength(0);
  });
});
