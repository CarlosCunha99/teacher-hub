import { toSlug } from "@/lib/slug";

describe("toSlug", () => {
  // U-1: Basic lowercase + hyphen
  it("lowercases and replaces spaces with hyphens", () => {
    expect(toSlug("Hello World")).toBe("hello-world");
  });

  // U-2: Punctuation collapsed to hyphen
  it("collapses punctuation to hyphens", () => {
    expect(toSlug("AQA: GCSE (2024)")).toBe("aqa-gcse-2024");
  });

  // U-3: Leading/trailing hyphens stripped
  it("strips leading and trailing hyphens", () => {
    expect(toSlug(" - STEM - ")).toBe("stem");
  });

  // U-4: Multiple consecutive hyphens collapsed
  it("collapses multiple consecutive spaces/hyphens", () => {
    expect(toSlug("Block  3  Unit  2")).toBe("block-3-unit-2");
  });

  // U-5: Accented characters normalised
  it("normalises accented characters to a deterministic, non-empty, URL-safe string", () => {
    const result = toSlug("Ëlève");
    expect(result).toBeTruthy();
    expect(result).toMatch(/^[a-z0-9-]+$/);
  });

  // U-6: Non-Latin script handled without throwing
  it("handles non-Latin script without throwing", () => {
    expect(() => toSlug("数学")).not.toThrow();
    expect(toSlug("数学")).toBeTruthy();
  });

  // U-7: Leading/trailing whitespace trimmed
  it("trims leading and trailing whitespace before slugifying", () => {
    expect(toSlug("  SEND-friendly  ")).toBe("send-friendly");
  });

  // U-8: Empty string rejected
  it("throws TypeError for empty string", () => {
    expect(() => toSlug("")).toThrow(TypeError);
  });

  // U-9: Whitespace-only string rejected
  it("throws TypeError for whitespace-only string", () => {
    expect(() => toSlug("   ")).toThrow(TypeError);
  });

  // U-10: Determinism
  it("is deterministic — same input always returns same slug", () => {
    const first = toSlug("AQA GCSE");
    const second = toSlug("AQA GCSE");
    expect(first).toBe(second);
  });

  // Output format: output only contains [a-z0-9-]
  it("produces only URL-safe characters [a-z0-9-]", () => {
    expect(toSlug("AQA GCSE")).toMatch(/^[a-z0-9-]+$/);
  });

  // Already-kebab input unchanged
  it("returns already-kebab-case input unchanged", () => {
    expect(toSlug("aqa-gcse")).toBe("aqa-gcse");
  });
});
