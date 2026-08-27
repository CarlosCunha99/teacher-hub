# Database guide

Teacher Hub uses Prisma with PostgreSQL. Prisma model and field names are used directly
as quoted PostgreSQL table and column names; no custom `@map` or `@@map` mappings are
defined.

## Entities and relationships

- A `Teacher` has OAuth `Identity` records, owns `Resource` and `Board` records, and
  can create `Like` records.
- A `Resource` belongs to one teacher and connects to `Subject` and `YearLevel` through
  `ResourceSubject` and `ResourceYearLevel`.
- A `Board` belongs to one teacher; a `BoardItem` is the saved-resource relation between
  a board and a resource.
- `Like` links one teacher to one resource. Compound primary keys prevent duplicate
  board items, likes, and taxonomy associations.

## Access convention

Application code imports the shared, lazy client with:

```typescript
import { prisma } from "@/lib/db";
```

Do not create another `PrismaClient` in feature code. The seed script uses the shared
client via its relative path and is idempotent: it upserts fixed fixture records, so it
is safe to run `npm run db:seed` repeatedly.

## Query patterns

Active published resources, newest first:

```typescript
const feed = await prisma.resource.findMany({
  where: { status: "PUBLISHED", deletedAt: null },
  orderBy: { createdAt: "desc" },
});
```

Filter by subject and year level:

```typescript
const results = await prisma.resource.findMany({
  where: {
    status: "PUBLISHED",
    deletedAt: null,
    subjects: { some: { subjectId } },
    yearLevels: { some: { yearLevelId } },
  },
});
```

Use PostgreSQL's case-insensitive `contains` mode for MVP keyword search:

```typescript
const results = await prisma.resource.findMany({
  where: {
    status: "PUBLISHED",
    deletedAt: null,
    OR: [
      { title: { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
    ],
  },
});
```

Fetch profile aggregate counts in the same query:

```typescript
const stats = await prisma.teacher.findUnique({
  where: { id: teacherId },
  include: {
    _count: { select: { resources: true, boards: true, likes: true } },
  },
});
```

## Deletion and taxonomy

Resources are soft-deleted by setting `deletedAt`; active-resource queries must include
`deletedAt: null`. Deleting a teacher cascades to identities, resources, boards, board
items, and likes. Deleting a resource cascades to its taxonomy links, board items, and
likes. Deleting a board cascades to its items. Subjects and year levels are restricted
while linked resources exist, so evolve taxonomy deliberately: create or rename
reference rows first, migrate resource links, then remove unused rows.
