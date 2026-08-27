# Contract for resource-tagging

Written by: contract-writer agent
Locked at: 2026-08-27T22:12:29Z
Consumed by: coder, tester, spec-reviewer, diagnoser

---

## Data shapes

All shapes are the stable wire/storage representations shared between route handlers,
the Prisma schema, and tests.

```ts
/** Persisted tag record — returned verbatim in API responses. */
interface Tag {
  id: string;
  name: string;        // trimmed display name; e.g. "AQA GCSE"
  slug: string;        // deterministic kebab-case; e.g. "aqa-gcse"
  teacherId: string;
  createdAt: string;   // ISO-8601 (JSON serialisation of Prisma Date)
}

/** Minimal resource stub — extended by future migrations. */
interface Resource {
  id: string;
  title: string;
  teacherId: string;
  createdAt: string;   // ISO-8601
}

/** Join-table record returned on attach; used internally on detach. */
interface ResourceTag {
  resourceId: string;
  tagId: string;
}

/** Uniform error envelope for all 4xx responses. */
interface ErrorResponse {
  error: string;       // human-readable, non-empty; machine-readable key not required at MVP
}
```

---

## Auth convention

Every mutating endpoint and every teacher-scoped read requires the `X-Teacher-Id`
header.

```
X-Teacher-Id: <non-empty string>   →   teacherId: string (local variable in handler)
```

- **Missing header** (header absent) → `401 { error: string }`
- **Empty header** (`X-Teacher-Id: ""`) → `401 { error: string }`
- **Wrong owner** (resource or tag belongs to a different `teacherId`) → `403 { error: string }`

`GET /api/resources` is publicly readable and does **not** require the header.

---

## Filter semantics (`GET /api/resources`)

Query parameters:
- `tags` — comma-separated tag slugs; e.g. `?tags=aqa-gcse,stem`
- `mode` — literal `"or"` or `"and"` (lowercase only); defaults to `"or"` when absent

Behaviour:
- No `tags` param → return all resources (backward-compatible baseline).
- `mode=or` (or absent) → return resources that carry **at least one** of the given slugs.
- `mode=and` → return resources that carry **all** of the given slugs.
- Unknown slugs yield zero matches; they do not widen results (OR) or error (AND → empty
  result set, not 404).
- `mode` values other than `"or"` / `"and"` → `400 { error: string }`.

Future filters (`subject`, `yearLevel`) compose additively as additional `where` clauses
and do not affect the `tags`/`mode` semantics locked here.

---

## Interfaces

### slug.toSlug

- **Path:** `src/lib/slug.ts`
- **Signature:**
  ```ts
  export function toSlug(name: string): string
  ```
- **Semantics:**
  - Pre-conditions: `name` is any string (may be empty, may contain Unicode).
  - Post-conditions: returns a non-empty URL-safe kebab-case string; output is
    deterministic (same input always produces same output); consists only of
    `[a-z0-9-]`; no leading or trailing hyphens; no consecutive hyphens.
    The stored `Tag.name` is `name.trim()` — callers must trim before storing,
    but `toSlug` internally trims before processing.
  - **Errors:** throws `TypeError` if `name.trim()` is empty (empty string or
    whitespace-only string).
  - **Side effects:** none (pure function).
  - **Not in contract:** specific Unicode transliteration algorithm; acceptable for
    non-Latin script to produce a non-empty string without being human-readable.

---

### prisma (default export)

- **Path:** `src/lib/prisma.ts`
- **Signature:**
  ```ts
  import { PrismaClient } from "@prisma/client";
  declare const prisma: PrismaClient;
  export default prisma;
  ```
- **Semantics:**
  - Pre-conditions: `DATABASE_URL` env var is set and resolvable by Prisma.
  - Post-conditions: returns the same `PrismaClient` instance on every import
    (global singleton; safe for Next.js hot-reload).
  - **Errors:** throws at module initialisation time if `DATABASE_URL` is absent or
    malformed (Prisma default behaviour; not caught at this layer).
  - **Side effects:** opens a database connection pool on first query.
  - **Not in contract:** connection pool size, reconnect strategy.

---

### tags/route — GET /api/tags

- **Path:** `src/app/api/tags/route.ts`
- **Signature:**
  ```ts
  export async function GET(request: Request): Promise<Response>
  ```
- **Semantics:**
  - Pre-conditions: `X-Teacher-Id` header present and non-empty.
  - Post-conditions: `200` with JSON body `Tag[]` containing only tags owned by
    the caller's `teacherId`; returns `[]` when the teacher has no tags.
  - **Errors:**
    - `401 ErrorResponse` — missing or empty `X-Teacher-Id`.
  - **Side effects:** issues a Prisma `findMany` filtered by `teacherId`.
  - **Not in contract:** ordering of returned tags; pagination.

---

### tags/route — POST /api/tags

- **Path:** `src/app/api/tags/route.ts`
- **Signature:**
  ```ts
  export async function POST(request: Request): Promise<Response>
  ```
- **Request body:** `{ name: string }`
- **Semantics:**
  - Pre-conditions: `X-Teacher-Id` header present and non-empty; `name` is a
    non-empty, non-whitespace-only string.
  - Post-conditions: `201` with JSON body `Tag`; `Tag.name` is `name.trim()`;
    `Tag.slug` is `toSlug(name)`; `Tag.teacherId` equals the header value.
  - **Errors:**
    - `400 ErrorResponse` — `name` absent, empty, or whitespace-only.
    - `401 ErrorResponse` — missing or empty `X-Teacher-Id`.
    - `409 ErrorResponse` — a tag with the same slug already exists for this
      `teacherId` (slug collision for the same teacher is rejected, not
      auto-suffixed).
  - **Side effects:** issues a Prisma `create` on the `Tag` table.
  - **Not in contract:** auto-disambiguation; two teachers may create tags with
    identical names (their slugs are scoped by `teacherId`).

---

### tags/[id]/route — DELETE /api/tags/[id]

- **Path:** `src/app/api/tags/[id]/route.ts`
- **Signature:**
  ```ts
  export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ): Promise<Response>
  ```
- **Semantics:**
  - Pre-conditions: `X-Teacher-Id` header present and non-empty; `id` is the tag's
    primary-key string (extracted from URL params).
  - Post-conditions: `200` with JSON body `{ success: true }`; all `ResourceTag`
    rows referencing this tag are also deleted (cascade).
  - **Errors:**
    - `401 ErrorResponse` — missing or empty `X-Teacher-Id`.
    - `403 ErrorResponse` — tag exists but is owned by a different teacher
      (explicit authorization error; not silent 404).
    - `404 ErrorResponse` — no tag found with the given `id`.
  - **Side effects:** issues Prisma `delete` (or `deleteMany`) on `ResourceTag`
    then `delete` on `Tag`.
  - **Not in contract:** whether cascade is performed via a Prisma `onDelete:
    Cascade` directive or explicit `deleteMany`; both are acceptable.

---

### resources/route — GET /api/resources

- **Path:** `src/app/api/resources/route.ts`
- **Signature:**
  ```ts
  export async function GET(request: Request): Promise<Response>
  ```
- **Query parameters:** `tags?: string`, `mode?: "or" | "and"`
- **Semantics:**
  - Pre-conditions: none (publicly accessible; no auth required).
  - Post-conditions: `200` with JSON body `Resource[]`.
    - No `tags` param → all resources.
    - `tags` present + `mode=or` (or absent) → OR filter.
    - `tags` present + `mode=and` → AND filter.
  - **Errors:**
    - `400 ErrorResponse` — `mode` present but not `"or"` or `"and"`.
  - **Side effects:** issues a Prisma `findMany` on `Resource`.
  - **Not in contract:** ordering, pagination, subject/year filter semantics.

---

### resources/route — POST /api/resources

- **Path:** `src/app/api/resources/route.ts`
- **Signature:**
  ```ts
  export async function POST(request: Request): Promise<Response>
  ```
- **Request body:** `{ title: string }`
- **Semantics:**
  - Pre-conditions: `X-Teacher-Id` header present and non-empty; `title` is a
    non-empty string.
  - Post-conditions: `201` with JSON body `Resource`; `Resource.teacherId` equals
    the header value.
  - **Errors:**
    - `400 ErrorResponse` — `title` absent or empty.
    - `401 ErrorResponse` — missing or empty `X-Teacher-Id`.
  - **Side effects:** issues a Prisma `create` on the `Resource` table.
  - **Not in contract:** resource update, delete, or additional fields.

---

### resources/[id]/tags/route — POST /api/resources/[id]/tags

- **Path:** `src/app/api/resources/[id]/tags/route.ts`
- **Signature:**
  ```ts
  export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ): Promise<Response>
  ```
- **Request body:** `{ tagId: string }`
- **Semantics:**
  - Pre-conditions: `X-Teacher-Id` header present and non-empty; `id` (URL param)
    is the resource ID; `tagId` (body) is the tag ID; caller owns both the resource
    and the tag.
  - Post-conditions: `201` with JSON body `ResourceTag`; operation is idempotent —
    if the association already exists the handler returns `201` without creating a
    duplicate.
  - **Errors:**
    - `401 ErrorResponse` — missing or empty `X-Teacher-Id`.
    - `403 ErrorResponse` — resource or tag exists but is owned by a different
      teacher.
    - `404 ErrorResponse` — resource or tag not found (each checked independently;
      resource checked first).
  - **Side effects:** issues a Prisma `upsert` (or equivalent idempotent write) on
    `ResourceTag`.
  - **Not in contract:** order of ownership checks beyond resource-first.

---

### resources/[id]/tags/route — DELETE /api/resources/[id]/tags

- **Path:** `src/app/api/resources/[id]/tags/route.ts`
- **Signature:**
  ```ts
  export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ): Promise<Response>
  ```
- **Request body:** `{ tagId: string }`
- **Semantics:**
  - Pre-conditions: `X-Teacher-Id` header present and non-empty; `id` (URL param)
    is the resource ID; `tagId` (body) is the tag ID; caller owns the resource.
  - Post-conditions: `200` with JSON body `{ success: true }`; only the targeted
    `ResourceTag` row is removed; the tag record itself is untouched.
  - **Errors:**
    - `401 ErrorResponse` — missing or empty `X-Teacher-Id`.
    - `403 ErrorResponse` — resource exists but is owned by a different teacher.
    - `404 ErrorResponse` — resource not found **or** the association
      (`ResourceTag` row) not found (not a 500).
  - **Side effects:** issues a Prisma `delete` on `ResourceTag`.
  - **Not in contract:** whether tag ownership is verified on detach (resource
    ownership is sufficient).

---

## Constants / config keys

| Key | Source | Dev default | Notes |
|---|---|---|---|
| `DATABASE_URL` | `process.env.DATABASE_URL` | `file:./prisma/dev.db` | Required for all tag/resource routes; not required for `/api/health` |

---

## Resolved ambiguities

| # | Disagreement / gap | Resolution | Source |
|---|---|---|---|
| R-1 | DELETE tag: 200 vs 204 | Locked as **200 `{ success: true }`** so the body is testable via `response.json()` in tests. | test-plan F-14 says "200 (or 204)"; 200 chosen. |
| R-2 | Attach tag: 200 vs 201 | Locked as **201 `ResourceTag`** (a new association is created; idempotent repeat also returns 201). | test-plan F-33 says "200 or 201". |
| R-3 | Detach tag: 200 vs 204 | Locked as **200 `{ success: true }`** for consistency with DELETE tag. | test-plan F-40 says "200 or 204". |
| R-4 | `mode` case-sensitivity | Locked as **strict lowercase** (`"or"` / `"and"` only); any other value → 400. | test-plan F-30: "consistent behaviour". Strict validation is simpler and documented. |
| R-5 | Slug collision: reject vs disambiguate | Locked as **409** with `ErrorResponse`. | plan.md: "Slug collisions … rejected with a conflict response rather than auto-suffixed." |
| R-6 | `toSlug` error indicator: throw vs null | Locked as **throws `TypeError`** for empty/whitespace-only input. | Route handler catches and returns 400; test-plan U-8/U-9 says "throws or returns null"; throw is simpler for callers that need to distinguish clean output. |
| R-7 | Detach: 404 when association missing vs no-op | Locked as **404 `ErrorResponse`**. | test-plan F-41: "404 or documented no-op". 404 makes the failure visible and is consistent with R-3. |
