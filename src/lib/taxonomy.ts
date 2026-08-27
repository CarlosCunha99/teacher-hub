export const SUBJECTS = [
  { id: "mathematics", label: "Mathematics" },
  { id: "english", label: "English" },
  { id: "science", label: "Science" },
  { id: "social-studies", label: "Social Studies" },
  { id: "arts", label: "Arts" },
  { id: "physical-education", label: "Physical Education" },
] as const;

export const YEAR_LEVELS = [
  { id: "elementary", label: "Elementary" },
  { id: "middle-school", label: "Middle School" },
  { id: "high-school", label: "High School" },
] as const;

export type Subject = (typeof SUBJECTS)[number];
export type YearLevel = (typeof YEAR_LEVELS)[number];
export type SubjectId = Subject["id"];
export type YearLevelId = YearLevel["id"];
export type Taxonomy = { subjects: typeof SUBJECTS; yearLevels: typeof YEAR_LEVELS };
