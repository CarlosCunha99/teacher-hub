export type CurrentUser = {
  id: string;
  name: string;
  role: "user" | "moderator" | "admin";
};

const DEFAULT_DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_DEV_USER_NAME = "Dev User";
const VALID_ROLES = new Set<CurrentUser["role"]>(["user", "moderator", "admin"]);

function isCurrentUser(value: unknown): value is CurrentUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.name === "string" &&
    VALID_ROLES.has(candidate.role as CurrentUser["role"])
  );
}

export async function getCurrentUser(request: Request): Promise<CurrentUser | null> {
  const override = request.headers.get("x-test-user");

  if (override) {
    try {
      const parsed: unknown = JSON.parse(override);

      if (parsed === null) {
        return null;
      }

      if (isCurrentUser(parsed)) {
        return parsed;
      }
    } catch {
      // Ignore malformed test overrides and fall back to the default dev user.
    }
  }

  return {
    id: process.env.DEV_USER_ID || DEFAULT_DEV_USER_ID,
    name: DEFAULT_DEV_USER_NAME,
    role: "user",
  };
}
