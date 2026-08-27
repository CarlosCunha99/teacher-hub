export type Resource = {
  id: string;
  title: string;
  description: string;
  subject: string;
  yearLevel: string;
  likes: number;
  saves: number;
  publishedAt: string;
  isPublished: boolean;
};

export const SUBJECT_OPTIONS = [
  "English",
  "Mathematics",
  "Science",
  "History",
  "Geography",
] as const;

export const YEAR_LEVEL_OPTIONS = [
  "Year 7",
  "Year 8",
  "Year 9",
  "Year 10",
  "Year 11",
  "Year 12",
] as const;

export const RESOURCE_CATALOG: Resource[] = [
  {
    id: "res-1",
    title: "Algebra Exit Ticket Set",
    description: "Short formative checks for linear equations and inequalities.",
    subject: "Mathematics",
    yearLevel: "Year 8",
    likes: 48,
    saves: 73,
    publishedAt: "2026-08-19T08:00:00Z",
    isPublished: true,
  },
  {
    id: "res-2",
    title: "Climate Zones Inquiry Slides",
    description:
      "Editable deck for comparing tropical, arid and temperate climate patterns.",
    subject: "Geography",
    yearLevel: "Year 9",
    likes: 32,
    saves: 51,
    publishedAt: "2026-08-16T10:30:00Z",
    isPublished: true,
  },
  {
    id: "res-3",
    title: "Shakespeare Character Tracker",
    description:
      "Graphic organiser to analyse motivation, conflict and textual evidence.",
    subject: "English",
    yearLevel: "Year 10",
    likes: 64,
    saves: 80,
    publishedAt: "2026-08-24T14:15:00Z",
    isPublished: true,
  },
  {
    id: "res-4",
    title: "Photosynthesis Lab Sheet",
    description:
      "Structured practical worksheet with hypothesis prompts and result tables.",
    subject: "Science",
    yearLevel: "Year 8",
    likes: 40,
    saves: 45,
    publishedAt: "2026-08-08T09:20:00Z",
    isPublished: true,
  },
  {
    id: "res-5",
    title: "World War I Source Analysis",
    description:
      "Primary source pack with guided questions for reliability and perspective.",
    subject: "History",
    yearLevel: "Year 10",
    likes: 55,
    saves: 62,
    publishedAt: "2026-08-21T11:45:00Z",
    isPublished: true,
  },
  {
    id: "res-6",
    title: "Probability Revision Game",
    description: "Low-prep card game covering experimental and theoretical probability.",
    subject: "Mathematics",
    yearLevel: "Year 7",
    likes: 50,
    saves: 59,
    publishedAt: "2026-08-12T07:10:00Z",
    isPublished: true,
  },
  {
    id: "res-7",
    title: "Atomic Structure Retrieval Grid",
    description:
      "Starter activity for proton/neutron/electron concepts and periodic trends.",
    subject: "Science",
    yearLevel: "Year 9",
    likes: 47,
    saves: 64,
    publishedAt: "2026-08-26T06:00:00Z",
    isPublished: true,
  },
  {
    id: "res-8",
    title: "Persuasive Writing Checklist",
    description:
      "Student-facing rubric for claims, evidence, cohesion and audience impact.",
    subject: "English",
    yearLevel: "Year 11",
    likes: 70,
    saves: 102,
    publishedAt: "2026-08-23T15:55:00Z",
    isPublished: true,
  },
  {
    id: "res-9",
    title: "Mapping Australian Biomes",
    description:
      "Annotated map activity with climate overlays and biodiversity prompts.",
    subject: "Geography",
    yearLevel: "Year 7",
    likes: 28,
    saves: 34,
    publishedAt: "2026-08-11T12:00:00Z",
    isPublished: true,
  },
  {
    id: "res-10",
    title: "Cold War Timeline Sort",
    description:
      "Cut-and-sort timeline cards with extension prompts for causation.",
    subject: "History",
    yearLevel: "Year 9",
    likes: 44,
    saves: 57,
    publishedAt: "2026-08-18T08:30:00Z",
    isPublished: true,
  },
  {
    id: "res-11",
    title: "Exam Reflection Template",
    description:
      "Guided post-assessment reflection for strengths, gaps and next steps.",
    subject: "English",
    yearLevel: "Year 12",
    likes: 31,
    saves: 39,
    publishedAt: "2026-08-06T16:40:00Z",
    isPublished: true,
  },
  {
    id: "res-12",
    title: "Forces and Motion Quiz Bank",
    description:
      "Question bank with worked answers for balanced and unbalanced forces.",
    subject: "Science",
    yearLevel: "Year 7",
    likes: 52,
    saves: 77,
    publishedAt: "2026-08-27T09:00:00Z",
    isPublished: true,
  },
  {
    id: "res-13",
    title: "Draft: Geometry Unit Planner",
    description: "Planning draft pending peer review.",
    subject: "Mathematics",
    yearLevel: "Year 9",
    likes: 0,
    saves: 0,
    publishedAt: "2026-08-27T10:00:00Z",
    isPublished: false,
  },
];
