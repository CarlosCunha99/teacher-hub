// @vitest-environment jsdom
import { render, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "@/lib/terms";
import TermsPage from "@/app/terms/page";

afterEach(() => {
  cleanup();
});

describe("TermsPage", () => {
  it("renders the current terms text and version identifier", () => {
    const { container } = render(<TermsPage />);

    expect(container.textContent).toContain(CURRENT_TERMS_VERSION);
    expect(container.textContent).toContain(TERMS_TEXT.slice(0, 40));
  });
});
