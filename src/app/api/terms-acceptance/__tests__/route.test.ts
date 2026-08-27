import { vi, beforeEach } from "vitest";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import { MOCK_TEACHER_ID, createAuthModuleMock } from "@/lib/__tests__/test-utils/mockSession";

vi.mock("@/lib/auth", () => createAuthModuleMock());

const { getAcceptanceStatusMock, recordAcceptanceMock } = vi.hoisted(() => ({
  getAcceptanceStatusMock: vi.fn(),
  recordAcceptanceMock: vi.fn(),
}));

vi.mock("@/lib/terms-acceptance", () => ({
  getAcceptanceStatus: getAcceptanceStatusMock,
  recordAcceptance: recordAcceptanceMock,
}));

import { GET, POST } from "@/app/api/terms-acceptance/route";

beforeEach(() => {
  getAcceptanceStatusMock.mockReset();
  recordAcceptanceMock.mockReset();
});

describe("GET /api/terms-acceptance", () => {
  it("reports not-accepted for a teacher with no record", async () => {
    getAcceptanceStatusMock.mockResolvedValueOnce({ accepted: false });

    const response = await GET(new Request("http://localhost/api/terms-acceptance"));

    expect(response.status).toBe(200);
    expect(getAcceptanceStatusMock).toHaveBeenCalledWith(MOCK_TEACHER_ID);

    const body = await response.json();
    expect(body).toEqual({ accepted: false });
  });

  it("reports accepted with version and timestamp for a teacher with a matching-version record", async () => {
    const acceptedAt = "2026-08-01T12:00:00.000Z";
    getAcceptanceStatusMock.mockResolvedValueOnce({
      accepted: true,
      version: CURRENT_TERMS_VERSION,
      acceptedAt,
    });

    const response = await GET(new Request("http://localhost/api/terms-acceptance"));

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ accepted: true, version: CURRENT_TERMS_VERSION, acceptedAt });
  });
});

describe("POST /api/terms-acceptance", () => {
  it("records acceptance and returns 201", async () => {
    const acceptedAt = "2026-08-01T12:00:00.000Z";
    recordAcceptanceMock.mockResolvedValueOnce({ acceptedAt });

    const response = await POST(
      new Request("http://localhost/api/terms-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: CURRENT_TERMS_VERSION }),
      })
    );

    expect(response.status).toBe(201);
    expect(recordAcceptanceMock).toHaveBeenCalledWith(MOCK_TEACHER_ID, CURRENT_TERMS_VERSION);

    const body = await response.json();
    expect(body).toEqual({ acceptedAt });
  });

  it("rejects a body requesting an outdated/incorrect version", async () => {
    const response = await POST(
      new Request("http://localhost/api/terms-acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: "not-the-current-version" }),
      })
    );

    expect(response.status).toBe(400);
    expect(recordAcceptanceMock).not.toHaveBeenCalled();

    const body = await response.json();
    expect(body).toEqual({ error: "invalid_terms_version" });
  });
});
