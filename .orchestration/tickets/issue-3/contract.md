# Contract — issue-3: MVP PostgreSQL Schema + Prisma Data Layer

> **This file is the interface lock.** Coder and tester must treat every signature,
> shape, and invariant here as ground truth. Do not deviate without updating this file
> first and informing both workers.

---

## Resolved ambiguities

| # | Disagreement | Resolution | Source |
|---|---|---|---|
| R1 | test-plan.md migration test says **"8 expected tables"** (omits ResourceSubject and ResourceYearLevel); plan.md step 3 defines **10 models** explicitly. | **10 tables** — Teacher, Identity, Resource, Subject, YearLevel, ResourceSubject, ResourceYearLevel, Board, BoardItem, Like. Test assertion must check all 10. | plan.md step 3 is the authoritative schema definition. |
| R2 | test-plan.md FK test references `Board.teacherId`; plan.md step 3 uses `ownerId`. | **`ownerId`** — locked for both `Board` and `Resource` for consistency. | plan.md is explicit; test-plan's FK list was a slip. |
| R3 | test-plan.md says `prisma:migrate:dev`/`prisma:migrate` script names; plan.md step 1 says `db:migrate` and `db:migrate:deploy`. | **`db:migrate`** (dev) and **`db:migrate:deploy`** (CI/prod) — locked per plan.md. | plan.md is the authoritative script specification. |
| R4 | test-plan.md says Resource has a `published` (boolean/enum) field; plan.md says `status` enum with values DRAFT/PUBLISHED. | **`status ResourceStatus`** enum — locked. Values are `DRAFT` and `PUBLISHED`. Not a boolean. | plan.md step 3 is explicit. |
| R5 | plan.md says `fileUrl/fileKey` (two options); test-plan.md says `fileUrl`/`pdfKey`. | **`fileUrl String`** is the locked field name. A supplementary `fileKey String?` for storage bucket keys is permitted at coder discretion but is not asserted by tests and must not replace `fileUrl`. | test-plan.md DMMF assertion checks `fileUrl`; plan.md lists it first. |

---

## Interface 1 — `prisma/schema.prisma`

### Path
`prisma/schema.prisma`

### Datasource + generator block
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

### Enums (exact names and values locked)
```prisma
enum Provider {
  GOOGLE
  MICROSOFT
}

enum ResourceStatus {
  DRAFT
  PUBLISHED
}

enum BoardVisibility {
  PRIVATE
  PUBLIC
}
```

### Model definitions (exact field set locked)

```prisma
model Teacher {
  id          String     @id @default(cuid())
  email       String     @unique
  displayName String
  bio         String?
  avatarUrl   String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  identities  Identity[]
  resources   Resource[]
  boards      Board[]
  likes       Like[]
}

model Identity {
  id                String   @id @default(cuid())
  provider          Provider
  providerAccountId String
  teacherId         String
  teacher           Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Resource {
  id          String              @id @default(cuid())
  title       String
  description String
  fileUrl     String
  ownerId     String
  owner       Teacher             @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  status      ResourceStatus      @default(DRAFT)
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt
  deletedAt   DateTime?
  subjects    ResourceSubject[]
  yearLevels  ResourceYearLevel[]
  boardItems  BoardItem[]
  likes       Like[]

  @@index([ownerId, createdAt])
  @@index([status, createdAt])
  @@index([deletedAt])
}

model Subject {
  id        String            @id @default(cuid())
  slug      String            @unique
  name      String
  sortOrder Int
  resources ResourceSubject[]
}

model YearLevel {
  id        String               @id @default(cuid())
  slug      String               @unique
  name      String
  sortOrder Int
  resources ResourceYearLevel[]
}

model ResourceSubject {
  resourceId String
  subjectId  String
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  subject    Subject  @relation(fields: [subjectId], references: [id], onDelete: Restrict)

  @@id([resourceId, subjectId])
  @@index([subjectId])
}

model ResourceYearLevel {
  resourceId  String
  yearLevelId String
  resource    Resource  @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  yearLevel   YearLevel @relation(fields: [yearLevelId], references: [id], onDelete: Restrict)

  @@id([resourceId, yearLevelId])
  @@index([yearLevelId])
}

model Board {
  id          String          @id @default(cuid())
  ownerId     String
  owner       Teacher         @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  name        String
  description String?
  visibility  BoardVisibility @default(PRIVATE)
  createdAt   DateTime        @default(now())
  items       BoardItem[]

  @@index([ownerId])
}

model BoardItem {
  boardId    String
  resourceId String
  board      Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@id([boardId, resourceId])
  @@index([boardId, createdAt])
}

model Like {
  teacherId  String
  resourceId String
  teacher    Teacher  @relation(fields: [teacherId], references: [id], onDelete: Cascade)
  resource   Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@id([teacherId, resourceId])
  @@index([resourceId])
}
```

### Semantics
- **ID strategy:** `cuid()` for all single-column `@id` fields. Compound-PK models (`ResourceSubject`, `ResourceYearLevel`, `BoardItem`, `Like`) use `@@id` and have no separate id column.
- **Uniqueness invariants:**
  - `Teacher.email` — unique across all teachers.
  - `Identity.(provider, providerAccountId)` — unique compound; same OAuth identity cannot link to two teachers.
  - `BoardItem.(boardId, resourceId)` — enforced by `@@id` (same resource cannot be added to the same board twice).
  - `Like.(teacherId, resourceId)` — enforced by `@@id` (same teacher cannot like the same resource twice).
  - `Subject.slug`, `YearLevel.slug` — unique across their respective tables.
- **Cascade semantics:**
  - Deleting a `Teacher` cascades to: `Identity`, `Resource`, `Board`, `BoardItem` (via Board), `Like`.
  - Deleting a `Resource` cascades to: `ResourceSubject`, `ResourceYearLevel`, `BoardItem`, `Like`.
  - Deleting a `Board` cascades to: `BoardItem`.
  - `Subject` and `YearLevel` rows use `onDelete: Restrict` from join tables — they cannot be deleted while resources reference them.
- **Soft-delete:** `Resource.deletedAt` is nullable. A non-null value marks the resource as soft-deleted. Application code is responsible for filtering `deletedAt: null` in "active resource" queries. Hard-delete semantics apply only to other entities.
- **No `@@map` / `@map`:** Table and column names use Prisma's default mapping (PascalCase → snake_case in generated SQL). Coder may add `@@map`/`@map` for explicit snake_case alignment but must update `docs/DATABASE.md` to reflect the choice.

### Invariants
- `Teacher` has NO `password`, `passwordHash`, or credential field.
- `Resource` has NO direct `subjectId` or `yearLevelId` scalar column; taxonomy linkage is exclusively through join models.
- No model named `Save`, `Bookmark`, or `SavedResource` exists; saved resources are represented solely via `BoardItem`.
- No `downloads` or `termsAcceptance` table.

### NOT in contract
- Exact `@@map`/`@map` names (coder's discretion, must document in `docs/DATABASE.md`).
- Whether `fileKey String?` is added as a supplementary storage field (permitted, not required).
- Exact value of `sortOrder` for seed rows (seed contract governs that).
- Prisma `@db.*` type overrides (e.g. `@db.Text`) — acceptable but not required.

---

## Interface 2 — `src/lib/db.ts`

### Path
`src/lib/db.ts`

### Exports
```typescript
export const prisma: PrismaClient
```
> **Import rule:** `PrismaClient` is imported from `"@prisma/client"` — not from any
> generated path or relative import.

### Exact implementation shape (copy-pasteable)
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

### Semantics
- **Pre-conditions:** `@prisma/client` package must have been generated (`npx prisma generate` or `postinstall`). The module does **not** require `DATABASE_URL` to be set at import time — `PrismaClient` construction is lazy and does not open a connection until the first query.
- **Post-conditions:** Every import of `"@/lib/db"` in the same Node.js process gets the same singleton instance. In non-production environments the instance survives Next.js hot-module reload.
- **Invariants:**
  - No top-level query, no `prisma.$connect()` call, no `await` at module top level.
  - The module must compile without error when `DATABASE_URL` is absent from the environment (used during `npm run build`).

### Errors
- No errors thrown at module load time. Errors surface only when the returned `prisma` client executes a query (connection refused, bad URL, etc.) and are propagated as Prisma client errors to the caller.

### Side effects
- In non-production: writes the `prisma` instance to `globalThis.prisma` for HMR reuse.
- In production: no `globalThis` mutation.

### NOT in contract
- `PrismaClient` constructor options (log levels, error format) — coder's choice, defaults are acceptable.
- Whether `prisma.$disconnect()` is called anywhere (lifecycle management is caller responsibility).

---

## Interface 3 — `package.json` (Prisma additions)

### Path
`package.json`

### Required additions to `scripts`
```json
{
  "scripts": {
    "prisma:generate":   "prisma generate",
    "db:migrate":        "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:seed":           "prisma db seed",
    "db:reset":          "prisma migrate reset",
    "postinstall":       "prisma generate"
  }
}
```

> All seven existing scripts from issue-1 (`dev`, `build`, `start`, `lint`, `format`,
> `format:check`, `test`) must be preserved unchanged.

### Required top-level `prisma` config block
```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Required dependency additions
```json
{
  "dependencies": {
    "@prisma/client": "^5.x"
  },
  "devDependencies": {
    "prisma": "^5.x",
    "tsx": "^4.x"
  }
}
```
> Exact semver ranges are at coder discretion. `@prisma/client` goes in `dependencies`;
> `prisma` CLI and `tsx` go in `devDependencies`.

### Semantics
- `postinstall` running `prisma generate` ensures that `npm install` (and CI `npm ci`)
  regenerates the Prisma client from the schema file without requiring a live database.
- `db:reset` maps to `prisma migrate reset` which drops + recreates + reseeds (uses
  `prisma.seed` automatically); add `--skip-seed` flag only when called without seed intent.
- `npm run build` and `npm test` must continue to exit 0 with no `DATABASE_URL` set
  after these additions.

### NOT in contract
- Whether `tsx` is replaced by another TS runner (e.g. `ts-node`) — acceptable if it
  keeps the seed command working and `npm test` DB-free.

---

## Interface 4 — `.env.example`

### Path
`.env.example`

### Required DATABASE_URL line
```
DATABASE_URL=postgresql://user:password@localhost:5432/teacher_hub
```

### Semantics
- The line must **not** be commented out; it must match `^DATABASE_URL=` (no leading `#`).
- The value must be a placeholder — it must not contain a real password or secret.
  It must fail the existing secret regex: `/(password|secret|key)\s*=\s*[a-zA-Z0-9+\/]{16,}/i`
  (the example value `password` is 8 characters and is a known placeholder word, so it passes).
- A format-guide comment immediately above the line is required:
  ```
  # Format: postgresql://[user[:password]@]host[:port]/dbname
  ```
- The `APP_ENV=development` line from issue-1 must be preserved.

### NOT in contract
- `DATABASE_URL_MIGRATION` or separate migration credentials — not required.
- Exact host, port, or database name in the placeholder (must be localhost-shaped, not a
  production host).

---

## Interface 5 — `prisma/seed.ts` (fixture contract)

### Path
`prisma/seed.ts`

### Required data minimums (post-seed row counts that tests assert)

| Entity | Minimum count | Constraints |
|---|---|---|
| `Subject` | ≥ 3 | Each with a unique `slug`, distinct `name`, ascending `sortOrder` |
| `YearLevel` | ≥ 3 | Each with a unique `slug`, distinct `name`, ascending `sortOrder` |
| `Teacher` | ≥ 5 | Each with one linked `Identity` row |
| `Resource` | ≥ 20 | All have non-null `ownerId` resolving to a seeded Teacher |
| `Resource` (DRAFT) | ≥ 1 | `status = DRAFT` |
| `Resource` (soft-deleted) | ≥ 1 | `deletedAt` is non-null |
| `Resource` (multi-subject) | ≥ 1 | Linked to ≥ 2 `Subject` rows via `ResourceSubject` |
| `Resource` (multi-year-level) | ≥ 1 | Linked to ≥ 2 `YearLevel` rows via `ResourceYearLevel` |
| `Board` | ≥ 5 | Mixed visibility (at least 1 `PUBLIC`, at least 1 `PRIVATE`) |
| `BoardItem` | ≥ 1 per Board | Every Board has at least one item |
| `Like` | ≥ 20 | Spread across multiple Teachers and Resources |

### Required idempotency semantics
The seed script must use `upsert` (keyed by slug for Subject/YearLevel, by fixed deterministic id or unique field for other entities) so that running `npm run db:seed` twice against the same database either:
- (a) exits 0 and row counts remain stable (preferred), or
- (b) exits non-zero with a clear unique-constraint error — in which case `README.md` must document that `db:reset` is required before re-seeding.

Exactly one of these two behaviors must be implemented and documented in `docs/DATABASE.md`.

### Required export shape
```typescript
// prisma/seed.ts — called by `prisma db seed` / `npm run db:seed`
// Must import the shared prisma client singleton:
import { prisma } from "../src/lib/db";

async function main(): Promise<void> {
  // ... upsert calls ...
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

> **Import rule:** Seed uses `import { prisma } from "../src/lib/db"` (relative path from
> `prisma/seed.ts` to `src/lib/db.ts`). It must NOT instantiate a second `PrismaClient`.

### NOT in contract
- Exact slug values, teacher names, resource titles — coder's choice; must be safe for
  public repos (no PII, no real secrets).
- Exact distribution of likes and board items beyond the minimums above.

---

## Interface 6 — `prisma/__tests__/helpers/testDb.ts`

### Path
`prisma/__tests__/helpers/testDb.ts`

### Exports
```typescript
import { PrismaClient } from "@prisma/client";

/** Prisma client configured for the test DATABASE_URL */
export const testPrisma: PrismaClient;

/**
 * Drops and recreates all application tables by running
 * `prisma migrate reset --force --skip-seed` (or equivalent).
 * Must be called in `beforeAll` / `afterAll` of integration test files.
 */
export async function resetDatabase(): Promise<void>;

/**
 * Truncates all application tables in dependency order via
 * `TRUNCATE ... RESTART IDENTITY CASCADE` (or equivalent Prisma deleteMany cascade).
 * Safe to call in `beforeEach` / `afterEach` to keep tests independent.
 */
export async function truncateAll(): Promise<void>;
```

### Semantics
- `testPrisma` is a `PrismaClient` instance pointing at `process.env.DATABASE_URL`.
- Both helper functions are no-ops (or skip cleanly) if `DATABASE_URL` is not set.
- `resetDatabase()` is heavier (drops/recreates) and intended for `beforeAll`/`afterAll`.
- `truncateAll()` is faster (row-level) and intended for `beforeEach`/`afterEach`.

### NOT in contract
- Whether `testPrisma` reuses `globalThis` caching (integration tests run in a separate
  process; caching not required).
- Internal truncation ordering (coder must ensure FK constraints are respected).

---

## Interface 7 — Migration lifecycle commands

### Commands and their guarantees

| Script / command | Effect | Exit code contract |
|---|---|---|
| `npm run prisma:generate` | Regenerates `@prisma/client` from `prisma/schema.prisma`. No DB required. | 0 on success; non-zero if schema has syntax errors. |
| `npm run db:migrate` | Runs `prisma migrate dev` — applies pending migrations, creates new migration if schema changed, prompts interactively. Requires `DATABASE_URL`. | 0 on success. |
| `npm run db:migrate:deploy` | Runs `prisma migrate deploy` — applies pending migrations non-interactively (CI/prod). Requires `DATABASE_URL`. | 0 on success; non-zero if any migration fails. |
| `npm run db:seed` | Runs `prisma db seed` → `tsx prisma/seed.ts`. Requires a migrated database. | 0 on success; non-zero on FK violation or connection error. |
| `npm run db:reset` | Runs `prisma migrate reset` — drops all tables, re-applies all migrations, then re-seeds. Requires `DATABASE_URL`. | 0 on success. |
| `npx prisma migrate reset --force --skip-seed` | Same as `db:reset` without the seed step. Used in tests. | 0 on success. |
| `postinstall` | Runs `prisma generate` automatically after `npm install` / `npm ci`. No DB required. | 0 on success; CI must not have `DATABASE_URL` set for this step. |

### Migration file contract
- Committed path: `prisma/migrations/<timestamp>_init/migration.sql`
- Lock file: `prisma/migrations/migration_lock.toml` (contains `provider = "postgresql"`)
- The `migration.sql` must create all 10 application tables with their foreign keys,
  unique constraints, and the indexes declared in Interface 1.
- `prisma migrate reset` applied from empty must reach the same schema as `prisma migrate deploy`.

### Errors
- `P2003` — foreign key constraint violation (orphaned row insert attempt).
- `P2002` — unique constraint violation (duplicate like/board-item/email).
- Connection errors surface as `PrismaClientInitializationError` when `DATABASE_URL` is
  absent or invalid and a query is attempted.

---

## Interface 8 — DAL import convention

### The single canonical import
```typescript
import { prisma } from "@/lib/db";
```
> **Forbidden alternatives:**
> - `import { prisma } from "../../lib/db"` — relative import, forbidden across features.
> - `import { PrismaClient } from "@prisma/client"; const prisma = new PrismaClient()` —
>   creates a second client instance; forbidden in application code. Permitted only in
>   `prisma/__tests__/helpers/testDb.ts`.

### Standard query patterns (locked for consistency)

**Feed query (active published resources, newest first):**
```typescript
const feed = await prisma.resource.findMany({
  where: { status: "PUBLISHED", deletedAt: null },
  orderBy: { createdAt: "desc" },
});
```

**Subject + year-level filtered discovery:**
```typescript
const results = await prisma.resource.findMany({
  where: {
    status: "PUBLISHED",
    deletedAt: null,
    subjects:   { some: { subjectId: subjectId } },
    yearLevels: { some: { yearLevelId: yearLevelId } },
  },
});
```

**Keyword search (case-insensitive, `contains` mode):**
```typescript
const results = await prisma.resource.findMany({
  where: {
    status: "PUBLISHED",
    deletedAt: null,
    OR: [
      { title:       { contains: keyword, mode: "insensitive" } },
      { description: { contains: keyword, mode: "insensitive" } },
    ],
  },
});
```

**Profile aggregate counts (single grouped query, not N+1):**
```typescript
const stats = await prisma.teacher.findUnique({
  where: { id: teacherId },
  include: {
    _count: { select: { resources: true, boards: true, likes: true } },
  },
});
```

> These patterns are the **minimum locked set** that `docs/DATABASE.md` must document.
> Downstream issues (#4–#8) must follow them; deviations require updating both
> `docs/DATABASE.md` and this contract.

---

## Interface 9 — `.prettierignore` (Prisma additions)

### Path
`.prettierignore`

### Required additional lines
```
prisma/migrations/
src/generated/
```

### Semantics
- Prisma migration SQL files must not be formatted by Prettier (avoids format-check
  failures on auto-generated SQL).
- `src/generated/` guards against potential future client output in that location.
- Existing `.prettierignore` entries from issue-1 must be preserved.

---

## Acceptance criterion traceability

| Acceptance criterion | Interfaces |
|---|---|
| **AC-1** — Schema defines correct entities and relationships | 1 |
| **AC-2** — Migration applies to empty database; rolls back cleanly | 7 |
| **AC-3** — Integrity constraints enforced (FK, unique compound) | 1, 7 |
| **AC-4** — `npm test` passes without a live database | 2, 3, 7 |
| **AC-5** — `DATABASE_URL` documented without committing a real secret | 4 |
| **AC-6** — DAL conventions documented and query patterns locked | 8 |
| **AC-7** — Seed script populates representative, idempotent dataset | 5 |
| **AC-8** — Downstream issues can import `prisma` without re-instantiating | 2, 8 |
