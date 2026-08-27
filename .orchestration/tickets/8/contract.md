# Contract for ticket-8

Written by: contract-writer agent
Locked at: 2026-08-27T22:07:55Z
Consumed by: coder, tester, spec-reviewer, diagnoser

---

## Interfaces

### teachers.getTeacherByUsername

- **Path:** `src/lib/teachers.ts`
- **Signature:**
  ```typescript
  export async function getTeacherByUsername(
    username: string,
  ): Promise<Teacher | null>
  ```
- **Semantics:**
  - Pre-conditions: `username` is a non-empty string (no format validation; any string is accepted).
  - Post-conditions: Returns the matching `Teacher` object when a record with the given username exists; returns `null` when no record matches.
  - Invariants: The lookup is case-insensitive on the data-source side; the returned `Teacher.username` preserves the stored casing.
- **Errors:**
  - Does NOT throw for: unknown/unrecognised usernames — returns `null` instead.
  - Does NOT throw for: empty string input — delegates to the data source; `null` is the expected result.
  - May reject (propagate) on: unrecoverable data-source failure (I/O error, connection failure). Error type and message are data-source-defined and not part of this contract.
- **Side effects:**
  - Reads from: in-memory data source (`src/lib/teachers-data.ts`) now; real DB later.
  - No writes, no cache mutations.
- **Not in contract:**
  - Whether the lookup is case-sensitive at the SQL level (data-source implementation detail).
  - Exact field names in the underlying storage (mapped to camelCase in the returned object).

---

### teachers.getPublishedResourcesByTeacher

- **Path:** `src/lib/teachers.ts`
- **Signature:**
  ```typescript
  export async function getPublishedResourcesByTeacher(
    teacherId: string,
  ): Promise<Resource[]>
  ```
- **Semantics:**
  - Pre-conditions: `teacherId` is a non-empty string identifying an existing teacher (no existence validation is performed — if `teacherId` matches no teacher, the result is `[]`).
  - Post-conditions: Returns every `Resource` where `resource.teacherId === teacherId` **AND** `resource.status === "published"`. Resources with `status === "draft"` (or any other status) are excluded. The order of items in the returned array is unspecified.
  - Invariants: Every item in the returned array satisfies `item.status === "published"` and `item.teacherId === teacherId`.
- **Errors:**
  - Does NOT throw for: teacher with no published resources — returns `[]`.
  - Does NOT throw for: unknown `teacherId` — returns `[]`.
  - May reject (propagate) on: unrecoverable data-source failure.
- **Side effects:**
  - Reads from: in-memory data source (`src/lib/teachers-data.ts`).
  - No writes.
- **Not in contract:**
  - Sort order of the returned array.
  - Whether resources for a deactivated teacher are returned (undefined for MVP).

---

### teachers.getShareableBoardsByTeacher

- **Path:** `src/lib/teachers.ts`
- **Signature:**
  ```typescript
  export async function getShareableBoardsByTeacher(
    teacherId: string,
  ): Promise<Board[]>
  ```
- **Semantics:**
  - Pre-conditions: `teacherId` is a non-empty string (no existence validation performed).
  - Post-conditions: Returns every `Board` where `board.teacherId === teacherId` **AND** `board.shareable === true`. Boards with `shareable === false` are excluded. Order is unspecified.
  - Invariants: Every item in the returned array satisfies `item.shareable === true` and `item.teacherId === teacherId`.
- **Errors:**
  - Does NOT throw for: teacher with no shareable boards — returns `[]`.
  - Does NOT throw for: unknown `teacherId` — returns `[]`.
  - May reject (propagate) on: unrecoverable data-source failure.
- **Side effects:**
  - Reads from: in-memory data source (`src/lib/teachers-data.ts`).
  - No writes.
- **Not in contract:**
  - Sort order of the returned array.

---

### TeacherProfilePage (Server Component)

- **Path:** `src/app/teachers/[username]/page.tsx`
- **Signature:**
  ```typescript
  interface PageProps {
    params: Promise<{ username: string }>;
  }

  export default async function TeacherProfilePage(
    props: PageProps,
  ): Promise<JSX.Element>
  ```
- **Semantics:**
  - Pre-conditions: `props.params` resolves to `{ username: string }` as provided by Next.js App Router.
  - Post-conditions:
    - If `getTeacherByUsername(username)` returns `null`, calls `notFound()` from `next/navigation` and does not render teacher markup.
    - If teacher is found: renders teacher identity (name, bio, joinedAt), a list of published resources with their count, a list of shareable boards with their count, and empty-state messages when either list is empty.
    - Displayed count label for resources equals `resources.length`; same for boards.
  - Invariants: Count labels always reflect the length of the arrays returned by the DAL — never an independently stored counter.
- **Errors:**
  - Calls `notFound()` (from `next/navigation`) for unknown usernames — does not throw.
  - Does NOT render partial teacher markup before calling `notFound()`.
- **Side effects:**
  - Reads: calls `getTeacherByUsername`, `getPublishedResourcesByTeacher`, `getShareableBoardsByTeacher`.
  - No writes, no mutations.
- **Not in contract:**
  - HTML structure, CSS classes, or visual layout.
  - Whether resource/board lists are rendered as `<ul>`, `<ol>`, or another element.

---

## Data shapes

### Teacher

```typescript
export interface Teacher {
  id: string;
  username: string;
  name: string;
  bio: string;
  joinedAt: string; // ISO 8601 date-time string, e.g. "2024-01-15T00:00:00Z"
}
```

- `id` — opaque unique identifier for the teacher record.
- `username` — unique handle used in the URL path (`/teachers/[username]`).
- `name` — display name shown on the profile.
- `bio` — short free-text biography; may be an empty string, never `null` or `undefined`.
- `joinedAt` — ISO 8601 string representing when the teacher joined; read-only from the profile page's perspective.

---

### Resource

```typescript
export interface Resource {
  id: string;
  teacherId: string;
  title: string;
  status: "published" | "draft";
}
```

- `id` — opaque unique identifier.
- `teacherId` — foreign key referencing `Teacher.id`.
- `title` — display title of the resource.
- `status` — visibility state; only `"published"` resources are returned by `getPublishedResourcesByTeacher`.

---

### Board

```typescript
export interface Board {
  id: string;
  teacherId: string;
  name: string;
  shareable: boolean;
}
```

- `id` — opaque unique identifier.
- `teacherId` — foreign key referencing `Teacher.id`.
- `name` — display name of the board.
- `shareable` — when `true` the board appears on the public profile; when `false` it is private and excluded from `getShareableBoardsByTeacher`.

---

## Constants / config keys

- `Resource.status` valid values: `"published"` | `"draft"` — only `"published"` passes the DAL filter.
- `Board.shareable`: `true` is the only value that passes the DAL filter.

---

## Resolved ambiguities

| # | Conflict | Plan.md says | Test-plan.md says | Resolution |
|---|----------|-------------|-------------------|------------|
| 1 | Field naming convention on `Teacher` | `joinedAt` (camelCase) | Fixture uses `joined_at` (snake_case) | **camelCase wins.** TypeScript types use `joinedAt`. Test fixtures must use `joinedAt`. The data source may store snake_case internally; the DAL maps to camelCase before returning. |
| 2 | Field naming convention on `Resource` | `teacherId` (camelCase) | Fixture uses `teacher_id` (snake_case) | **camelCase wins.** Same rationale as #1. Test fixtures must use `teacherId`. |
| 3 | `Board` field: `name` vs `title` | `name` | Fixture uses `title` | **`name` wins** (consistent with `Teacher.name`; plan.md is the authoritative interface spec). Testers must mock `Board.name`, not `Board.title`. |
| 4 | `Board` field naming | `teacherId` | Fixture uses `teacher_id` | **camelCase wins.** Same rationale as #1. |
| 5 | DAL tests mock strategy | plan.md implies in-memory data source (no DB client) | test-plan mentions `vi.mock('@/lib/db')` | **In-memory source wins for this ticket.** There is no `@/lib/db` module yet. Unit tests for the DAL should import from `@/lib/teachers` and either exercise the real in-memory source or mock `@/lib/teachers-data`. The `vi.mock('@/lib/db')` instruction in test-plan is forward-looking and does not apply until #3 lands. |
