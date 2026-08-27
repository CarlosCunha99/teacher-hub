import { CURRENT_TERMS_VERSION, TERMS_TEXT } from "@/lib/terms";

describe("terms module", () => {
  it("exposes a non-empty CURRENT_TERMS_VERSION string", () => {
    expect(typeof CURRENT_TERMS_VERSION).toBe("string");
    expect(CURRENT_TERMS_VERSION.length).toBeGreaterThan(0);
  });

  it("exposes a non-empty TERMS_TEXT string", () => {
    expect(typeof TERMS_TEXT).toBe("string");
    expect(TERMS_TEXT.length).toBeGreaterThan(0);
  });
});
