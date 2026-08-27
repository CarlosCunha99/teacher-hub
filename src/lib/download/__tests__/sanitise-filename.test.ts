import { sanitiseFilename } from "@/lib/download/sanitise-filename";

describe("sanitiseFilename", () => {
  it('strips header-injection characters: ", ;, \\r, \\n', () => {
    const input = 'file"name;bad\r\n';
    const result = sanitiseFilename(input);
    expect(result).not.toContain('"');
    expect(result).not.toContain(";");
    expect(result).not.toContain("\r");
    expect(result).not.toContain("\n");
  });

  it("strips colon characters", () => {
    const input = "file:name";
    const result = sanitiseFilename(input);
    expect(result).not.toContain(":");
  });

  it("preserves normal ASCII names unchanged", () => {
    const input = "Lesson Plan 2024";
    const result = sanitiseFilename(input);
    // Allow either exact match or with .pdf extension appended
    expect(result === "Lesson Plan 2024" || result === "Lesson Plan 2024.pdf").toBe(true);
  });

  it("returns a non-empty fallback string for empty input", () => {
    const result = sanitiseFilename("");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles unicode characters and returns a non-empty string", () => {
    const input = "Álgebra básica";
    const result = sanitiseFilename(input);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
