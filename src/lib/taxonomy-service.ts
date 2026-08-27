import {
  SUBJECTS,
  YEAR_LEVELS,
  type Taxonomy,
  type SubjectId,
  type YearLevelId,
} from "@/lib/taxonomy";

export class TaxonomyValidationError extends Error {
  readonly reason: "empty" | "unknown-ids";
  readonly unknownIds: string[];

  constructor(reason: "empty" | "unknown-ids", unknownIds: string[] = []) {
    const message =
      reason === "empty"
        ? "At least one id must be provided."
        : `Unknown ids: ${unknownIds.join(", ")}`;
    super(message);
    this.name = "TaxonomyValidationError";
    this.reason = reason;
    this.unknownIds = unknownIds;
  }
}

export function getTaxonomy(): Taxonomy {
  return { subjects: SUBJECTS, yearLevels: YEAR_LEVELS };
}

const SUBJECT_IDS = new Set<string>(SUBJECTS.map((s) => s.id));
const YEAR_LEVEL_IDS = new Set<string>(YEAR_LEVELS.map((y) => y.id));

export function validateSubjectIds(ids: string[]): SubjectId[] {
  if (ids.length === 0) {
    throw new TaxonomyValidationError("empty");
  }
  const unknownIds = ids.filter((id) => !SUBJECT_IDS.has(id));
  if (unknownIds.length > 0) {
    throw new TaxonomyValidationError("unknown-ids", unknownIds);
  }
  return ids as SubjectId[];
}

export function validateYearLevelIds(ids: string[]): YearLevelId[] {
  if (ids.length === 0) {
    throw new TaxonomyValidationError("empty");
  }
  const unknownIds = ids.filter((id) => !YEAR_LEVEL_IDS.has(id));
  if (unknownIds.length > 0) {
    throw new TaxonomyValidationError("unknown-ids", unknownIds);
  }
  return ids as YearLevelId[];
}
