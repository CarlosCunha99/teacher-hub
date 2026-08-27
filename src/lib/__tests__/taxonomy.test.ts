import { SUBJECTS, YEAR_LEVELS } from "@/lib/taxonomy";

describe("taxonomy constants — SUBJECTS", () => {
  it("exports exactly six entries", () => {
    expect(SUBJECTS).toHaveLength(6);
  });

  it("every subject has a non-empty string id and label", () => {
    SUBJECTS.forEach((entry) => {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    });
  });

  it("contains exactly the approved MVP subject labels (any order)", () => {
    const labels = SUBJECTS.map((s) => s.label).sort();
    const expected = [
      "Arts",
      "English",
      "Mathematics",
      "Physical Education",
      "Science",
      "Social Studies",
    ].sort();
    expect(labels).toEqual(expected);
  });

  it("subject IDs are unique", () => {
    const ids = SUBJECTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(SUBJECTS.length);
  });

  it("subject IDs are stable non-numeric slugs", () => {
    SUBJECTS.forEach((entry) => {
      expect(entry.id).not.toMatch(/^\d+$/);
    });
  });
});

describe("taxonomy constants — YEAR_LEVELS", () => {
  it("exports exactly three entries", () => {
    expect(YEAR_LEVELS).toHaveLength(3);
  });

  it("every year level has a non-empty string id and label", () => {
    YEAR_LEVELS.forEach((entry) => {
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.label).toBe("string");
      expect(entry.label.length).toBeGreaterThan(0);
    });
  });

  it("contains exactly the approved MVP year-level labels (any order)", () => {
    const labels = YEAR_LEVELS.map((y) => y.label).sort();
    const expected = ["Elementary", "High School", "Middle School"].sort();
    expect(labels).toEqual(expected);
  });

  it("year-level IDs are unique", () => {
    const ids = YEAR_LEVELS.map((y) => y.id);
    expect(new Set(ids).size).toBe(YEAR_LEVELS.length);
  });

  it("year-level IDs are stable non-numeric slugs", () => {
    YEAR_LEVELS.forEach((entry) => {
      expect(entry.id).not.toMatch(/^\d+$/);
    });
  });
});

describe("taxonomy constants — ID namespace disjointness", () => {
  it("subject IDs and year-level IDs are disjoint (no shared ID)", () => {
    const subjectIds = new Set<string>(SUBJECTS.map((s) => s.id));
    const yearLevelIds = YEAR_LEVELS.map((y) => y.id);
    const intersection = yearLevelIds.filter((id) => subjectIds.has(id));
    expect(intersection).toHaveLength(0);
  });
});
