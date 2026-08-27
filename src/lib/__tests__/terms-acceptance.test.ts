import { vi, beforeEach } from "vitest";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  query: queryMock,
}));

import { hasAcceptedCurrentTerms, recordAcceptance } from "@/lib/terms-acceptance";

const TEACHER_ID = "teacher-1";

beforeEach(() => {
  queryMock.mockReset();
});

describe("hasAcceptedCurrentTerms", () => {
  it("returns false when no acceptance record exists", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    await expect(hasAcceptedCurrentTerms(TEACHER_ID)).resolves.toBe(false);
  });

  it("returns true when the teacher's latest acceptance matches CURRENT_TERMS_VERSION", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          teacher_id: TEACHER_ID,
          terms_version: CURRENT_TERMS_VERSION,
          accepted_at: "2026-08-01T12:00:00.000Z",
        },
      ],
    });

    await expect(hasAcceptedCurrentTerms(TEACHER_ID)).resolves.toBe(true);
  });

  it("returns false when the teacher's latest acceptance is for an older version", async () => {
    queryMock.mockResolvedValueOnce({
      rows: [
        {
          teacher_id: TEACHER_ID,
          terms_version: "2024-01-01",
          accepted_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    await expect(hasAcceptedCurrentTerms(TEACHER_ID)).resolves.toBe(false);
  });
});

describe("recordAcceptance", () => {
  it("writes teacher id, version, and timestamp", async () => {
    const acceptedAt = "2026-08-01T12:00:00.000Z";
    queryMock.mockResolvedValueOnce({ rows: [{ accepted_at: acceptedAt }] });

    const result = await recordAcceptance(TEACHER_ID, CURRENT_TERMS_VERSION);

    expect(result).toEqual({ acceptedAt });
    expect(queryMock).toHaveBeenCalledTimes(1);

    const [, params] = queryMock.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([TEACHER_ID, CURRENT_TERMS_VERSION]);
  });

  it("handles a duplicate-acceptance race without throwing an unhandled error", async () => {
    const uniqueViolation = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "terms_acceptances_teacher_id_terms_version_key"'
      ),
      { code: "23505" }
    );
    queryMock.mockRejectedValueOnce(uniqueViolation);

    await expect(recordAcceptance(TEACHER_ID, CURRENT_TERMS_VERSION)).resolves.toEqual(
      expect.objectContaining({ acceptedAt: expect.any(String) })
    );
  });
});
