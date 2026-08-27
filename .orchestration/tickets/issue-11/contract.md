# Contract for issue-11

Written by: contract-writer agent
Locked at: 2026-08-27T22:12:22+01:00
Consumed by: coder, tester, spec-reviewer, diagnoser

---

## Interfaces

### POST /api/resources/[id]/download — `POST` handler

- **Path:** `src/app/api/resources/[id]/download/route.ts`
- **Signature:**
  ```typescript
  export async function POST(
    _request: Request,
    { params }: { params: { id: string } }
  ): Promise<Response>
  ```
- **Semantics:**
  - Pre-conditions: `params.id` is a non-empty string (URL segment). No auth required (MVP).
  - Post-conditions (happy path): A new `Download` row is inserted for `resourceId = params.id`; `revalidatePath('/teachers/' + resource.authorId)` is called; returns HTTP 200 with JSON body `{ success: true, fileUrl: string | null }`.
  - Invariants: The `Download` row is only created after the resource has been confirmed to exist and have `status === 'PUBLISHED'`. If DB throws at any point, no partial write is observed (call fails before or the row is rolled back by Prisma).
- **Errors:**
  - `404` — resource not found (`findUnique` returns `null`) or `status !== 'PUBLISHED'`; response body `{ error: 'Not found' }`
  - `500` — `prisma.resource.findUnique` or `prisma.download.create` throws; response body `{ error: 'Internal server error' }`
- **Side effects:** Writes one `Download` row to DB; calls `revalidatePath` from `next/cache`.
- **Not in contract:** Authentication, authorization, rate limiting, actual file byte streaming (stub URL redirect only for MVP).

---

### `fetchTeacherProfileData` — teacher profile data helper

- **Path:** `src/app/teachers/[teacherId]/page.tsx` (named export)
- **Signature:**
  ```typescript
  export async function fetchTeacherProfileData(teacherId: string): Promise<{
    totalLikes: number;
    totalDownloads: number;
    resources: Array<{
      id: string;
      title: string;
      status: 'DRAFT' | 'PUBLISHED';
      _count: { likes: number; downloads: number };
    }>;
  }>
  ```
- **Semantics:**
  - Pre-conditions: `teacherId` is a non-empty string matching `User.id`.
  - Post-conditions: Returns `totalLikes` and `totalDownloads` as the COUNT of Like/Download rows associated with the teacher's `PUBLISHED` resources. Returns the `resources` array (may be empty). `totalLikes` and `totalDownloads` are always `number` (never `null`/`undefined`); Prisma `null` sums are coerced to `0`.
  - Invariants: Only resources with `status === 'PUBLISHED'` contribute to `totalLikes`, `totalDownloads`, and the `resources` list. DRAFT resources are never returned.
- **Errors:** Propagates Prisma errors as thrown exceptions (caller / Server Component handles).
- **Side effects:** Read-only DB queries.
- **Not in contract:** Pagination, sorting of resources list.

---

### `TeacherProfilePage` — teacher profile Server Component

- **Path:** `src/app/teachers/[teacherId]/page.tsx` (default export)
- **Signature:**
  ```typescript
  export default async function TeacherProfilePage(
    props: { params: { teacherId: string } }
  ): Promise<JSX.Element>
  ```
- **Semantics:**
  - Pre-conditions: `props.params.teacherId` is provided by Next.js routing.
  - Post-conditions: Renders `<StatsHeaderCard totalLikes={...} totalDownloads={...} />` and a list of `<ResourceCard>` items for each published resource.
  - Invariants: Delegates data fetching to `fetchTeacherProfileData`; renders zero state without error when teacher has no published resources.
- **Errors:** Let Prisma errors propagate to Next.js error boundary.
- **Side effects:** None beyond DB reads.
- **Not in contract:** 404 for unknown teacher (MVP renders empty state).

---

### `ResourceDetailPage` — resource detail Server Component

- **Path:** `src/app/resources/[id]/page.tsx` (default export)
- **Signature:**
  ```typescript
  export default async function ResourceDetailPage(
    props: { params: { id: string } }
  ): Promise<JSX.Element>
  ```
- **Semantics:**
  - Pre-conditions: `props.params.id` is provided by Next.js routing.
  - Post-conditions: Fetches one resource via `prisma.resource.findUnique({ where: { id }, include: { _count: { select: { likes: true, downloads: true } } } })`; renders `<ResourceCard>` with the resource's counts.
  - Invariants: Returns 404 (via `notFound()`) if resource is missing or `status !== 'PUBLISHED'`.
- **Errors:** Calls Next.js `notFound()` for missing/unpublished resource; lets other Prisma errors propagate.
- **Side effects:** None beyond DB read.
- **Not in contract:** Download action UI (stub only for MVP); likes UI (issue #7).

---

### `ResourceCard` — resource display component

- **Path:** `src/components/ResourceCard.tsx` (named export)
- **Signature:**
  ```typescript
  export interface ResourceCardProps {
    id: string;
    title: string;
    downloadCount: number;
  }

  export function ResourceCard(props: ResourceCardProps): JSX.Element
  ```
- **Semantics:**
  - Pre-conditions: `downloadCount` is a non-negative integer (including 0).
  - Post-conditions: Renders `title` as visible text; renders `downloadCount` as its string representation (e.g. `"42"`, `"0"`) — never blank or `undefined`.
  - Invariants: Pure presentation component; no internal DB access, no internal filtering. Renders exactly the numbers passed as props.
- **Errors:** None (purely presentational; invalid props are a caller bug).
- **Side effects:** None.
- **Not in contract:** Like count display (issue #7 extension), click-to-download interaction.

---

### `StatsHeaderCard` — aggregate stats display component

- **Path:** `src/components/StatsHeaderCard.tsx` (named export)
- **Signature:**
  ```typescript
  export interface StatsHeaderCardProps {
    totalLikes: number;
    totalDownloads: number;
  }

  export function StatsHeaderCard(props: StatsHeaderCardProps): JSX.Element
  ```
- **Semantics:**
  - Pre-conditions: Both props are non-negative integers (including 0).
  - Post-conditions: Renders both values as visible text — never blank or `undefined`. Zero renders as `"0"`.
  - Invariants: Pure presentation; trusts caller to pass PUBLISHED-only pre-filtered totals. No internal filtering logic.
- **Errors:** None (purely presentational).
- **Side effects:** None.
- **Not in contract:** Teaching of DRAFT/deleted exclusion (that is the query's responsibility, not the component's).

---

### `db` — Prisma client singleton

- **Path:** `src/lib/db.ts` (named export)
- **Signature:**
  ```typescript
  import { PrismaClient } from '@prisma/client';
  export const db: PrismaClient;
  ```
- **Semantics:**
  - Pre-conditions: `DATABASE_URL` env var is set.
  - Post-conditions: Returns the same `PrismaClient` instance on every import within a process (singleton via `globalThis.__prisma` guard for Next.js hot-reload safety).
  - Invariants: In development (`process.env.NODE_ENV !== 'production'`), the instance is stored on `globalThis` to prevent multiple client instances during hot reload. In production a new instance is created once per process.
- **Errors:** `PrismaClientInitializationError` if `DATABASE_URL` is missing/invalid at first use.
- **Side effects:** Opens DB connection pool on first query.
- **Not in contract:** Connection retry logic, multi-database setup.

---

## Data shapes

### `ResourceStatus` enum (Prisma / TypeScript)

```typescript
enum ResourceStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
}
```

---

### `Resource` model shape (Prisma-generated type, relevant fields)

```typescript
interface Resource {
  id: string;           // cuid
  title: string;
  status: ResourceStatus;
  fileUrl: string | null;
  authorId: string;     // FK → User.id
  createdAt: Date;
  updatedAt: Date;
  // NOTE: NO downloadCount column — per-resource count is derived via _count relation
}
```

Queried with `_count` for per-resource counts:
```typescript
const resource = await prisma.resource.findUnique({
  where: { id },
  include: { _count: { select: { likes: true, downloads: true } } },
});
// resource._count.downloads — number of Download rows for this resource
// resource._count.likes    — number of Like rows for this resource
```

---

### `Like` model shape

```typescript
interface Like {
  id: string;
  resourceId: string;   // FK → Resource.id, indexed
  userId: string;       // FK → User.id
  createdAt: Date;
}
// Unique constraint: (resourceId, userId)
```

---

### `Download` model shape

```typescript
interface Download {
  id: string;
  resourceId: string;   // FK → Resource.id, indexed
  userId: string | null; // nullable — anonymous downloads allowed
  createdAt: Date;
}
```

---

### Profile aggregate query pattern (locked)

```typescript
// Total likes across teacher's PUBLISHED resources
const totalLikes = await db.like.count({
  where: { resource: { authorId: teacherId, status: 'PUBLISHED' } },
});

// Total downloads across teacher's PUBLISHED resources
const totalDownloads = await db.download.count({
  where: { resource: { authorId: teacherId, status: 'PUBLISHED' } },
});
```

Both return `number` directly from `count` (never `null`). Zero is the correct result when there are no matching rows.

---

### Download mutation pattern (locked)

```typescript
// Inside POST handler — only reached after resource confirmed PUBLISHED
await db.download.create({ data: { resourceId: id, userId: null } });
```

No `resource.update({ downloads: { increment: 1 } })` call. The displayed download count on resource cards comes from `_count.downloads` (relation count), not a denormalized column.

---

## Constants / config keys

| Key | Location | Value |
|-----|----------|-------|
| `DATABASE_URL` | `.env` / environment | `"file:./dev.db"` (dev SQLite) |
| `ResourceStatus.PUBLISHED` | `@prisma/client` generated enum | `"PUBLISHED"` |
| `ResourceStatus.DRAFT` | `@prisma/client` generated enum | `"DRAFT"` |
| `@/lib/db` | TypeScript path alias | resolves to `src/lib/db.ts` |

---

## Resolved ambiguities

### R1 — DB singleton path: `src/lib/prisma.ts` vs `src/lib/db.ts`

**Conflict:** `plan.md` (step 4) names the file `src/lib/prisma.ts`; `test-plan.md` mocks `@/lib/db` throughout; `impact.md` names the file `src/lib/db.ts` and its export `db`.

**Resolution:** **`src/lib/db.ts`, exported as `db`**. This matches both `test-plan.md` (all mock calls use `@/lib/db`) and `impact.md` (which is the most recent authoritative document). `plan.md` is treated as using a placeholder name; coders must use `src/lib/db.ts`.

---

### R2 — Download count: `Resource.downloadCount` column vs `Download` table aggregation

**Conflict:** `plan.md` (step 5, assumptions) describes an atomic `Resource.downloadCount` increment AND optional `Download` rows "for auditability". `test-plan.md` mocks `prisma.download.aggregate` for profile totals (implying a Download table) and uses `_count: { downloads: ... }` for per-resource counts (implying relation-based counting, not a column).

**Resolution:** **No `downloadCount` column on `Resource`**. The single source of truth for download counts is the `Download` table:
- **Per-resource count** on cards and detail views: `_count.downloads` from Prisma relation count (via `include: { _count: { select: { downloads: true } } }`).
- **Profile aggregate totals**: `db.download.count({ where: { resource: { authorId, status: 'PUBLISHED' } } })`.
- **Mutation**: `db.download.create(...)` only — no `resource.update` increment call.

This eliminates the dual-write inconsistency risk and aligns with test-plan.md's mock expectations.
