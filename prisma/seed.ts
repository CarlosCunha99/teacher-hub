import { BoardVisibility, Provider, ResourceStatus } from "@prisma/client";
import { prisma } from "../src/lib/db";

const subjects = [
  { slug: "english", name: "English", sortOrder: 1 },
  { slug: "mathematics", name: "Mathematics", sortOrder: 2 },
  { slug: "science", name: "Science", sortOrder: 3 },
  { slug: "history", name: "History", sortOrder: 4 },
];

const yearLevels = [
  { slug: "year-7", name: "Year 7", sortOrder: 1 },
  { slug: "year-8", name: "Year 8", sortOrder: 2 },
  { slug: "year-9", name: "Year 9", sortOrder: 3 },
  { slug: "year-10", name: "Year 10", sortOrder: 4 },
];

const teachers = [
  {
    id: "clteacher0000000000000001",
    email: "alex.morgan@example.test",
    displayName: "Alex Morgan",
    provider: Provider.GOOGLE,
  },
  {
    id: "clteacher0000000000000002",
    email: "blake.taylor@example.test",
    displayName: "Blake Taylor",
    provider: Provider.MICROSOFT,
  },
  {
    id: "clteacher0000000000000003",
    email: "casey.lee@example.test",
    displayName: "Casey Lee",
    provider: Provider.GOOGLE,
  },
  {
    id: "clteacher0000000000000004",
    email: "devon.park@example.test",
    displayName: "Devon Park",
    provider: Provider.MICROSOFT,
  },
  {
    id: "clteacher0000000000000005",
    email: "emery.jones@example.test",
    displayName: "Emery Jones",
    provider: Provider.GOOGLE,
  },
];

const resourceTitles = [
  "Sentence Structure Workshop",
  "Fractions Visual Guide",
  "Ecosystems Field Notes",
  "Ancient Civilizations Timeline",
  "Persuasive Writing Prompts",
  "Algebra Practice Pack",
  "Forces and Motion Lab",
  "Local History Source Set",
  "Poetry Annotation Guide",
  "Geometry Challenge Cards",
  "Weather Data Investigation",
  "World War I Primary Sources",
  "Reading Comprehension Toolkit",
  "Ratio Recipe Project",
  "Cells Microscope Lab",
  "Civic Debate Framework",
  "Vocabulary Games Collection",
  "Statistics Survey Project",
  "Energy Transfer Lesson",
  "Research Essay Planner",
];

const resources = resourceTitles.map((title, index) => ({
  id: `clresource000000000000${String(index + 1).padStart(2, "0")}`,
  title,
  description: `A classroom-ready resource for ${title.toLowerCase()}.`,
  fileUrl: `https://example.test/resources/${index + 1}.pdf`,
  ownerId: teachers[index % teachers.length].id,
  status: index === 18 ? ResourceStatus.DRAFT : ResourceStatus.PUBLISHED,
  deletedAt: index === 19 ? new Date("2025-01-01T00:00:00.000Z") : null,
}));

const boards = [
  {
    id: "clboard000000000000000001",
    ownerId: teachers[0].id,
    name: "Year 7 Favourites",
    description: "Frequently used Year 7 materials.",
    visibility: BoardVisibility.PRIVATE,
  },
  {
    id: "clboard000000000000000002",
    ownerId: teachers[1].id,
    name: "STEM Inspiration",
    description: "Resources for practical STEM lessons.",
    visibility: BoardVisibility.PUBLIC,
  },
  {
    id: "clboard000000000000000003",
    ownerId: teachers[2].id,
    name: "Literacy Toolkit",
    description: "Reading and writing activities.",
    visibility: BoardVisibility.PUBLIC,
  },
  {
    id: "clboard000000000000000004",
    ownerId: teachers[3].id,
    name: "Humanities Planning",
    description: "History and civics lesson planning.",
    visibility: BoardVisibility.PRIVATE,
  },
  {
    id: "clboard000000000000000005",
    ownerId: teachers[4].id,
    name: "Project Learning",
    description: "Collaborative project resources.",
    visibility: BoardVisibility.PUBLIC,
  },
];

async function main(): Promise<void> {
  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { slug: subject.slug },
      update: subject,
      create: subject,
    });
  }

  for (const yearLevel of yearLevels) {
    await prisma.yearLevel.upsert({
      where: { slug: yearLevel.slug },
      update: yearLevel,
      create: yearLevel,
    });
  }

  for (const teacher of teachers) {
    await prisma.teacher.upsert({
      where: { email: teacher.email },
      update: {
        id: teacher.id,
        displayName: teacher.displayName,
      },
      create: {
        id: teacher.id,
        email: teacher.email,
        displayName: teacher.displayName,
      },
    });
    await prisma.identity.upsert({
      where: {
        provider_providerAccountId: {
          provider: teacher.provider,
          providerAccountId: `seed-${teacher.id}`,
        },
      },
      update: { teacherId: teacher.id },
      create: {
        id: `clidentity${teacher.id.slice(-15)}`,
        provider: teacher.provider,
        providerAccountId: `seed-${teacher.id}`,
        teacherId: teacher.id,
      },
    });
  }

  for (const resource of resources) {
    await prisma.resource.upsert({
      where: { id: resource.id },
      update: resource,
      create: resource,
    });
  }

  const seededSubjects = await prisma.subject.findMany({
    where: { slug: { in: subjects.map((subject) => subject.slug) } },
  });
  const seededYearLevels = await prisma.yearLevel.findMany({
    where: { slug: { in: yearLevels.map((yearLevel) => yearLevel.slug) } },
  });

  for (const [index, resource] of resources.entries()) {
    const subjectCount = index === 0 ? 2 : 1;
    const yearLevelCount = index === 0 ? 2 : 1;

    for (let offset = 0; offset < subjectCount; offset += 1) {
      const subject = seededSubjects[(index + offset) % seededSubjects.length];
      await prisma.resourceSubject.upsert({
        where: {
          resourceId_subjectId: {
            resourceId: resource.id,
            subjectId: subject.id,
          },
        },
        update: {},
        create: { resourceId: resource.id, subjectId: subject.id },
      });
    }

    for (let offset = 0; offset < yearLevelCount; offset += 1) {
      const yearLevel = seededYearLevels[(index + offset) % seededYearLevels.length];
      await prisma.resourceYearLevel.upsert({
        where: {
          resourceId_yearLevelId: {
            resourceId: resource.id,
            yearLevelId: yearLevel.id,
          },
        },
        update: {},
        create: { resourceId: resource.id, yearLevelId: yearLevel.id },
      });
    }
  }

  for (const board of boards) {
    await prisma.board.upsert({
      where: { id: board.id },
      update: board,
      create: board,
    });
  }

  for (const [index, board] of boards.entries()) {
    for (const resourceOffset of [0, 1]) {
      const resource = resources[(index * 3 + resourceOffset) % resources.length];
      await prisma.boardItem.upsert({
        where: {
          boardId_resourceId: {
            boardId: board.id,
            resourceId: resource.id,
          },
        },
        update: {},
        create: { boardId: board.id, resourceId: resource.id },
      });
    }
  }

  for (let index = 0; index < 25; index += 1) {
    const teacher = teachers[index % teachers.length];
    const resource = resources[(index * 3) % resources.length];
    await prisma.like.upsert({
      where: {
        teacherId_resourceId: {
          teacherId: teacher.id,
          resourceId: resource.id,
        },
      },
      update: {},
      create: { teacherId: teacher.id, resourceId: resource.id },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
