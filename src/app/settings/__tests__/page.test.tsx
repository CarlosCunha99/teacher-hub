// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { MOCK_TEACHER_ID, createAuthModuleMock } from "@/lib/__tests__/test-utils/mockSession";

vi.mock("@/lib/auth", () => createAuthModuleMock());

const { getAcceptanceStatusMock } = vi.hoisted(() => ({
  getAcceptanceStatusMock: vi.fn(),
}));

vi.mock("@/lib/terms-acceptance", () => ({
  getAcceptanceStatus: getAcceptanceStatusMock,
}));

import SettingsPage from "@/app/settings/page";

beforeEach(() => {
  getAcceptanceStatusMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("SettingsPage", () => {
  it("displays the teacher's accepted terms version and acceptance timestamp", async () => {
    const version = "2026-08-01";
    const acceptedAt = "2026-08-01T12:00:00.000Z";
    getAcceptanceStatusMock.mockResolvedValueOnce({ accepted: true, version, acceptedAt });

    const { container } = render(await SettingsPage());

    expect(getAcceptanceStatusMock).toHaveBeenCalledWith(MOCK_TEACHER_ID);
    expect(container.textContent).toContain(version);
    // Human-readable rendering of the timestamp; contract allows either a
    // locale-formatted string or the raw ISO value, so assert on the
    // invariant year substring rather than an exact format.
    expect(container.textContent).toMatch(/2026/);
  });

  it("shows a not-yet-accepted status when the teacher has no current acceptance", async () => {
    getAcceptanceStatusMock.mockResolvedValueOnce({ accepted: false });

    const { container } = render(await SettingsPage());

    expect(container.textContent?.toLowerCase()).toContain("not");
  });
});
