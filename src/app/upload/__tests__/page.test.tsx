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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import UploadPage from "@/app/upload/page";

beforeEach(() => {
  getAcceptanceStatusMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("UploadPage", () => {
  it("renders the terms acceptance modal when not accepted", async () => {
    getAcceptanceStatusMock.mockResolvedValueOnce({ accepted: false });

    const { getByRole } = render(await UploadPage());

    expect(getAcceptanceStatusMock).toHaveBeenCalledWith(MOCK_TEACHER_ID);
    expect(getByRole("dialog")).toBeTruthy();
  });

  it("renders the upload form and omits the modal when accepted", async () => {
    getAcceptanceStatusMock.mockResolvedValueOnce({ accepted: true });

    const { queryByRole } = render(await UploadPage());

    expect(queryByRole("dialog")).toBeNull();
  });
});
