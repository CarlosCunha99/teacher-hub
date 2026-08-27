import type { User } from "@/lib/types";

function getCookieValue(cookieHeader: string | null, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const entries = cookieHeader.split(";");

  for (const entry of entries) {
    const [namePart, ...valueParts] = entry.trim().split("=");
    if (namePart !== cookieName) {
      continue;
    }

    const value = valueParts.join("=").trim();
    return value.length > 0 ? decodeURIComponent(value) : null;
  }

  return null;
}

export async function getSessionUser(request: Request): Promise<User | null> {
  try {
    const testUserId = process.env.TEST_USER_ID?.trim();

    if (testUserId) {
      return { id: testUserId };
    }

    const cookieUserId = getCookieValue(request.headers.get("cookie"), "__session")?.trim();

    if (cookieUserId) {
      return { id: cookieUserId };
    }

    return null;
  } catch {
    return null;
  }
}
