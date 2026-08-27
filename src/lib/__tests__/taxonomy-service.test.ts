import {
  getTaxonomy,
  validateSubjectIds,
  validateYearLevelIds,
  TaxonomyValidationError,
} from "@/lib/taxonomy-service";
import { SUBJECTS, YEAR_LEVELS } from "@/lib/taxonomy";

describe("TaxonomyValidationError", () => {
  it("is an instance of Error (extends Error)", () => {
    try {
      validateSubjectIds([]);
    } catch (err) {
      // Fix 3: verify instanceof Error
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      // Fix 4: verify message is non-empty
      expect((err as TaxonomyValidationError).message.length).toBeGreaterThan(0);
    }
  });
});

describe("getTaxonomy", () => {
  it("returns an object with subjects equal to SUBJECTS and yearLevels equal to YEAR_LEVELS", () => {
    const result = getTaxonomy();
    expect(result.subjects).toEqual(SUBJECTS);
    expect(result.yearLevels).toEqual(YEAR_LEVELS);
  });

  it("returned object has exactly the keys subjects and yearLevels", () => {
    const result = getTaxonomy();
    expect(Object.keys(result).sort()).toEqual(["subjects", "yearLevels"].sort());
  });
});

describe("validateSubjectIds", () => {
  it("accepts a single valid subject ID without throwing and returns the input as SubjectId[]", () => {
    const id = SUBJECTS[0].id;
    expect(() => validateSubjectIds([id])).not.toThrow();
    // Fix 2: assert return value
    const result = validateSubjectIds([id]);
    expect(result).toEqual([id]);
  });

  it("accepts all valid subject IDs at once without throwing and returns the full input", () => {
    const allIds = SUBJECTS.map((s) => s.id);
    expect(() => validateSubjectIds(allIds)).not.toThrow();
    // Fix 2: assert return value
    const result = validateSubjectIds(allIds);
    expect(result).toEqual(allIds);
  });

  it("rejects an empty array with TaxonomyValidationError reason 'empty'", () => {
    expect(() => validateSubjectIds([])).toThrow(TaxonomyValidationError);
    try {
      validateSubjectIds([]);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("empty");
      expect((err as TaxonomyValidationError).unknownIds).toEqual([]);
    }
  });

  it("rejects an array with one unknown subject ID with TaxonomyValidationError reason 'unknown-ids'", () => {
    expect(() => validateSubjectIds(["not-a-real-subject"])).toThrow(TaxonomyValidationError);
    try {
      validateSubjectIds(["not-a-real-subject"]);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("unknown-ids");
      // Fix 1: assert unknownIds contains the offending string
      expect((err as TaxonomyValidationError).unknownIds).toContain("not-a-real-subject");
    }
  });

  it("rejects a mix of one valid and one unknown subject ID (no partial acceptance)", () => {
    expect(() =>
      validateSubjectIds([SUBJECTS[0].id, "unknown-id"])
    ).toThrow(TaxonomyValidationError);
    try {
      validateSubjectIds([SUBJECTS[0].id, "unknown-id"]);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("unknown-ids");
      // Fix 1: only the unknown ID should appear in unknownIds, not the valid one
      expect((err as TaxonomyValidationError).unknownIds).toEqual(["unknown-id"]);
    }
  });

  it("rejects a year-level ID passed as a subject ID", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateSubjectIds([YEAR_LEVELS[0].id] as any)).toThrow(TaxonomyValidationError);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateSubjectIds([YEAR_LEVELS[0].id] as any);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("unknown-ids");
      // Fix 1: assert unknownIds contains the year-level ID
      expect((err as TaxonomyValidationError).unknownIds).toContain(YEAR_LEVELS[0].id);
    }
  });
});

describe("validateYearLevelIds", () => {
  it("accepts a single valid year-level ID without throwing and returns the input as YearLevelId[]", () => {
    const id = YEAR_LEVELS[0].id;
    expect(() => validateYearLevelIds([id])).not.toThrow();
    // Fix 2: assert return value
    const result = validateYearLevelIds([id]);
    expect(result).toEqual([id]);
  });

  it("accepts all valid year-level IDs at once without throwing and returns the full input", () => {
    const allIds = YEAR_LEVELS.map((y) => y.id);
    expect(() => validateYearLevelIds(allIds)).not.toThrow();
    // Fix 2: assert return value
    const result = validateYearLevelIds(allIds);
    expect(result).toEqual(allIds);
  });

  it("rejects an empty array with TaxonomyValidationError reason 'empty'", () => {
    expect(() => validateYearLevelIds([])).toThrow(TaxonomyValidationError);
    try {
      validateYearLevelIds([]);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("empty");
      expect((err as TaxonomyValidationError).unknownIds).toEqual([]);
    }
  });

  it("rejects an array with one unknown year-level ID with TaxonomyValidationError reason 'unknown-ids'", () => {
    expect(() => validateYearLevelIds(["not-a-real-year-level"])).toThrow(TaxonomyValidationError);
    try {
      validateYearLevelIds(["not-a-real-year-level"]);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("unknown-ids");
      // Fix 1: assert unknownIds contains the offending string
      expect((err as TaxonomyValidationError).unknownIds).toContain("not-a-real-year-level");
    }
  });

  it("rejects a mix of one valid and one unknown year-level ID (no partial acceptance)", () => {
    expect(() =>
      validateYearLevelIds([YEAR_LEVELS[0].id, "unknown-id"])
    ).toThrow(TaxonomyValidationError);
    try {
      validateYearLevelIds([YEAR_LEVELS[0].id, "unknown-id"]);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("unknown-ids");
      // Fix 1: only the unknown ID should appear in unknownIds, not the valid one
      expect((err as TaxonomyValidationError).unknownIds).toEqual(["unknown-id"]);
    }
  });

  it("rejects a subject ID passed as a year-level ID", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => validateYearLevelIds([SUBJECTS[0].id] as any)).toThrow(TaxonomyValidationError);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      validateYearLevelIds([SUBJECTS[0].id] as any);
    } catch (err) {
      expect(err).toBeInstanceOf(TaxonomyValidationError);
      expect((err as TaxonomyValidationError).reason).toBe("unknown-ids");
      // Fix 1: assert unknownIds contains the subject ID
      expect((err as TaxonomyValidationError).unknownIds).toContain(SUBJECTS[0].id);
    }
  });
});
