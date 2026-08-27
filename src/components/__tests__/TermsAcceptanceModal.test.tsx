// @vitest-environment jsdom
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import TermsAcceptanceModal from "@/components/TermsAcceptanceModal";

const { routerRefreshMock } = vi.hoisted(() => ({ routerRefreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}));

afterEach(() => {
  cleanup();
  routerRefreshMock.mockReset();
  vi.unstubAllGlobals();
});

describe("TermsAcceptanceModal", () => {
  it("renders terms text, a checkbox, a link to /terms, and a disabled submit until checked", () => {
    const { container, getByRole } = render(
      <TermsAcceptanceModal termsVersion="2026-08-01" termsText="Sample terms body" />
    );

    expect(container.textContent).toContain("Sample terms body");

    const link = container.querySelector("a[href='/terms']");
    expect(link).not.toBeNull();

    const checkbox = getByRole("checkbox") as HTMLInputElement;
    const submit = getByRole("button") as HTMLButtonElement;

    expect(submit.hasAttribute("disabled")).toBe(true);

    fireEvent.click(checkbox);

    expect(submit.hasAttribute("disabled")).toBe(false);
  });

  it("calls the acceptance API and invokes onAccepted on submit", async () => {
    const onAccepted = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { getByRole } = render(
      <TermsAcceptanceModal
        termsVersion="2026-08-01"
        termsText="Sample terms body"
        onAccepted={onAccepted}
      />
    );

    fireEvent.click(getByRole("checkbox"));
    fireEvent.click(getByRole("button"));

    await waitFor(() => {
      expect(onAccepted).toHaveBeenCalledTimes(1);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/terms-acceptance",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ version: "2026-08-01" }),
      })
    );
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });
});
