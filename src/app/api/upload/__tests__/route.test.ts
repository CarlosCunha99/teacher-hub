import { vi, beforeEach } from "vitest";
import { MOCK_TEACHER_ID, createAuthModuleMock } from "@/lib/__tests__/test-utils/mockSession";

vi.mock("@/lib/auth", () => createAuthModuleMock());

const { hasAcceptedCurrentTermsMock } = vi.hoisted(() => ({
  hasAcceptedCurrentTermsMock: vi.fn(),
}));

vi.mock("@/lib/terms-acceptance", () => ({
  hasAcceptedCurrentTerms: hasAcceptedCurrentTermsMock,
}));

import { POST } from "@/app/api/upload/route";

beforeEach(() => {
  hasAcceptedCurrentTermsMock.mockReset();
});

function uploadRequest(): Request {
  return new Request("http://localhost/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("POST /api/upload", () => {
  it("returns 403 with terms_not_accepted when the teacher has no acceptance for the current version", async () => {
    hasAcceptedCurrentTermsMock.mockResolvedValueOnce(false);

    const response = await POST(uploadRequest());

    expect(response.status).toBe(403);
    expect(hasAcceptedCurrentTermsMock).toHaveBeenCalledWith(MOCK_TEACHER_ID);

    const body = await response.json();
    expect(body).toEqual({ error: "terms_not_accepted" });
  });

  it("proceeds past the terms gate when the teacher has accepted the current version", async () => {
    hasAcceptedCurrentTermsMock.mockResolvedValueOnce(true);

    const response = await POST(uploadRequest());

    expect(response.status).not.toBe(403);

    const body = await response.json();
    expect(body).not.toEqual({ error: "terms_not_accepted" });
  });

  it("returns 403 when the teacher's only acceptance record is for a version older than CURRENT_TERMS_VERSION", async () => {
    // hasAcceptedCurrentTerms already collapses "no record" and "stale version" to
    // false; this case documents the version-mismatch axis even though the
    // route's observable behavior (403 + terms_not_accepted) is identical.
    hasAcceptedCurrentTermsMock.mockResolvedValueOnce(false);

    const response = await POST(uploadRequest());

    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body).toEqual({ error: "terms_not_accepted" });
  });
});
