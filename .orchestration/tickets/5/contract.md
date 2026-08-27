# Contract — ticket 5: MVP Subject and Year-Level Taxonomy

> **This file is the interface lock.** Coder and tester must treat every signature,
> shape, and invariant here as ground truth. Do not deviate without updating this file
> first and informing both workers.

---

## Disambiguation log

| Ambiguity | Resolution | Source |
|---|---|---|
| Error shape for `validate*Ids`: throw vs discriminated union | **Throw `TaxonomyValidationError`** — locked. The function throws on failure and returns the narrowed id array on success. This is the cleanest contract for the `#4` resource handler (one `catch`, then 422). | plan.md says "coder's choice"; test-plan says "throws or returns error"; throw wins for idiomatic Next.js usage. |
| Exact subject/year-level ID slug spelling | **Locked to plan.md's proposed values**: `"mathematics"`, `"english"`, `"science"`, `"social-studies"`, `"arts"`, `"physical-education"`, `"elementary"`, `"middle-school"`, `"high-school"`. #3's seed SQL must match these exactly. | plan.md proposes them; test-plan derives IDs from exported constants (never hard-codes), so the contract pins the values and tests remain decoupled from literal strings. |
| DB vs in-memory for constants | **In-memory constants, no DB** — locked for this ticket. `getTaxonomy()` reads `SUBJECTS`/`YEAR_LEVELS` directly; no ORM import. | impact.md warning ("no ORM is installed"); plan.md "unblock independently" path. |
| `GET` handler parameter name | **`_request`** — prefixed underscore because the parameter is unused, mirroring `src/app/api/health/route.ts`. | Existing codebase convention (`src/app/api/health/route.ts`). |

---

## Interface 1 — `src/lib/taxonomy.ts`

### Path
`src/lib/taxonomy.ts`

### Exports
```typescript
// Locked subject IDs
export const SUBJECTS = [
  { id: "mathematics",        label: "Mathematics" },
  { id: "english",            label: "English" },
  { id: "science",            label: "Science" },
  { id: "social-studies",     label: "Social Studies" },
  { id: "arts",               label: "Arts" },
  { id: "physical-education", label: "Physical Education" },
] as const;

// Locked year-level IDs
export const YEAR_LEVELS = [
  { id: "elementary",    label: "Elementary" },
  { id: "middle-school", label: "Middle School" },
  { id: "high-school",   label: "High School" },
] as const;

export type Subject     = (typeof SUBJECTS)[number];
export type YearLevel   = (typeof YEAR_LEVELS)[number];
export type SubjectId   = Subject["id"];
export type YearLevelId = YearLevel["id"];
export type Taxonomy    = { subjects: typeof SUBJECTS; yearLevels: typeof YEAR_LEVELS };
```

### Semantics
- `SUBJECTS` is a **readonly** tuple of exactly six objects, declared `as const`.
- `YEAR_LEVELS` is a **readonly** tuple of exactly three objects, declared `as const`.
- Every `id` is a lowercase kebab-case string (no spaces, no integers).
- Every `id` across both arrays is **globally unique** — no value appears in both `SUBJECTS` and `YEAR_LEVELS`.
- `SubjectId` is the union type of all six subject id literal strings.
- `YearLevelId` is the union type of all three year-level id literal strings.
- `Taxonomy` carries the literal `typeof SUBJECTS` / `typeof YEAR_LEVELS` (not a widened `Subject[]`/`YearLevel[]`) so callers receive full const-narrowing.
- This module contains **no runtime logic** — only constant declarations and type aliases.

### Invariants
| Invariant | Value |
|---|---|
| `SUBJECTS.length` | `6` |
| `YEAR_LEVELS.length` | `3` |
| `SUBJECTS` labels (any order) | `Mathematics`, `English`, `Science`, `Social Studies`, `Arts`, `Physical Education` |
| `YEAR_LEVELS` labels (any order) | `Elementary`, `Middle School`, `High School` |
| All IDs are non-numeric slugs | `!/^\d+$/` |
| Subject IDs ∩ year-level IDs | `∅` (empty) |

### Import rule
```typescript
import { SUBJECTS, YEAR_LEVELS } from "@/lib/taxonomy";
// NOT: relative imports — always use the @/ alias
```

### Errors
- None; purely declarative.

### Side effects
- None.

### NOT in contract
- Insertion order within each array beyond what is listed above (tests must not assert on positional index, only membership).
- Any runtime validation logic (that lives in `taxonomy-service.ts`).
- Database or ORM imports.

---

## Interface 2 — `src/lib/taxonomy-service.ts`

### Path
`src/lib/taxonomy-service.ts`

### Exports
```typescript
import { SUBJECTS, YEAR_LEVELS, type Taxonomy, type SubjectId, type YearLevelId } from "@/lib/taxonomy";

// Error class — exported so callers can `instanceof`-check it
export class TaxonomyValidationError extends Error {
  readonly reason: "empty" | "unknown-ids";
  readonly unknownIds: string[];
  constructor(reason: "empty" | "unknown-ids", unknownIds?: string[]);
}

export function getTaxonomy(): Taxonomy;

export function validateSubjectIds(ids: string[]): SubjectId[];

export function validateYearLevelIds(ids: string[]): YearLevelId[];
```

### Semantics — `getTaxonomy`
- Returns `{ subjects: SUBJECTS, yearLevels: YEAR_LEVELS }` (direct reference, not a copy).
- The returned object has **exactly** the keys `subjects` and `yearLevels` — no extra properties.
- Never throws; always returns synchronously.

### Semantics — `validateSubjectIds(ids)`
- **Pre-condition:** `ids` is a `string[]` (may be empty; never `null`/`undefined`).
- **Success path:** All ids are non-empty and every id exists in `SUBJECTS`. Returns the input cast to `SubjectId[]`.
- **Failure — empty:** `ids.length === 0` → throws `TaxonomyValidationError` with `reason: "empty"` and `unknownIds: []`.
- **Failure — unknown ids:** Any element of `ids` is not a value in `SUBJECTS.map(s => s.id)` → throws `TaxonomyValidationError` with `reason: "unknown-ids"` and `unknownIds` populated with the offending strings.
- **Mixed valid + invalid:** Entirely rejected — a single unknown id in an otherwise valid array still throws with `reason: "unknown-ids"`. No partial acceptance.
- A year-level id (e.g. `"elementary"`) is **not** a valid subject id and must be rejected with `reason: "unknown-ids"`.

### Semantics — `validateYearLevelIds(ids)`
- Mirror of `validateSubjectIds` but validates against `YEAR_LEVELS`.
- **Failure — empty:** `ids.length === 0` → throws `TaxonomyValidationError` with `reason: "empty"` and `unknownIds: []`.
- **Failure — unknown ids:** Any element not in `YEAR_LEVELS.map(y => y.id)` → throws `TaxonomyValidationError` with `reason: "unknown-ids"` and `unknownIds` populated.
- A subject id (e.g. `"mathematics"`) is **not** a valid year-level id and must be rejected.

### `TaxonomyValidationError` invariants
- Extends `Error` — `instanceof Error` is `true`.
- `instanceof TaxonomyValidationError` is `true` for all thrown instances.
- `error.reason` is **either** `"empty"` **or** `"unknown-ids"` — no other value.
- `error.unknownIds` is an array (may be empty for `reason: "empty"`).
- The `message` property is a non-empty human-readable string suitable for a 422 response body.

### Import rule
```typescript
import { getTaxonomy, validateSubjectIds, validateYearLevelIds, TaxonomyValidationError } from "@/lib/taxonomy-service";
// NOT: relative imports — always use the @/ alias
```

### Side effects
- None. All three functions are pure and synchronous.

### NOT in contract
- Internal implementation (Set lookup, Array.find, etc.) — coder's choice.
- Whether `TaxonomyValidationError.message` format is exactly `"Unknown subject ids: foo"` vs any other wording (tests assert `instanceof` + `reason`, not message literals).
- `async` overloads — these functions are synchronous; do not add async wrappers.

---

## Interface 3 — `src/app/api/taxonomy/route.ts`

### Path
`src/app/api/taxonomy/route.ts`

### Exports
```typescript
import { NextResponse } from "next/server";
import { getTaxonomy } from "@/lib/taxonomy-service";

export async function GET(_request: Request): Promise<Response>;
```

### Semantics
- **Pre-conditions:** None. No environment variables, no DB connection, no external service.
- **Success path:** Calls `getTaxonomy()`, returns `NextResponse.json({ subjects, yearLevels }, { status: 200 })`.
- **Response shape:**
  ```json
  {
    "subjects":    [{ "id": "string", "label": "string" }],
    "yearLevels":  [{ "id": "string", "label": "string" }]
  }
  ```
- `response.status === 200`.
- `Content-Type` header contains `"application/json"`.
- Response body has **exactly** the keys `subjects` and `yearLevels` at the top level — no extras.
- Each item in `subjects` has **exactly** the keys `id` and `label` — no extras (e.g. no `createdAt`).
- Each item in `yearLevels` has **exactly** the keys `id` and `label` — no extras.
- `body.subjects.length === 6`, `body.yearLevels.length === 3`.
- The endpoint is **read-only**: no `POST`, `PUT`, `PATCH`, or `DELETE` handler is exported. Next.js returns 405 automatically for unsupported methods.
- The handler never throws; `getTaxonomy()` is pure in-memory and cannot fail.

### Signature details
```typescript
import { NextResponse } from "next/server";
import { getTaxonomy } from "@/lib/taxonomy-service";

export async function GET(_request: Request): Promise<Response> {
  const { subjects, yearLevels } = getTaxonomy();
  return NextResponse.json({ subjects, yearLevels }, { status: 200 });
}
```

> **Import rule:** Use `NextResponse` from `"next/server"` — not `"next"` or any other
> path. Use `@/lib/taxonomy-service` path alias — not a relative path.

### Errors
- No thrown errors. Handler is expected to always return 200.

### Side effects
- None. No DB writes, no logging beyond Next.js framework defaults.

### NOT in contract
- Authentication or rate-limiting.
- POST/PUT/DELETE handlers (must NOT be added).
- Any future DB-backed implementation detail (`getTaxonomy()` is the seam).

---

## Interface 4 — `README.md` (taxonomy endpoint documentation)

### Path
`README.md`

### Required addition
A reference to `GET /api/taxonomy` must be added to the existing API section alongside
the health endpoint entry. Minimum content:

```
GET /api/taxonomy
Response: { "subjects": [{"id":"string","label":"string"}], "yearLevels": [{"id":"string","label":"string"}] }
```

### Semantics
- The existing `src/__tests__/readme.test.ts` tests (`npm install`, folder structure,
  env config) must **continue to pass unchanged** — no existing assertions are affected.
- New content is purely additive.

### NOT in contract
- Exact heading names, wording, or placement within the README.

---

## Acceptance criterion traceability

| Criterion | Interfaces |
|---|---|
| Approved taxonomy of subjects (6 entries, stable IDs, human-readable labels) | 1 |
| Approved taxonomy of year levels (3 entries, stable IDs, human-readable labels) | 1 |
| Taxonomy reference data is retrievable by the application | 2 (`getTaxonomy`), 3 |
| APIs reject tags not part of the approved taxonomy | 2 (`validateSubjectIds`, `validateYearLevelIds`) |
| Resource creation requires valid subject selection (at least one) | 2 (`validateSubjectIds` rejects empty) |
| Resource creation requires valid year-level selection (at least one) | 2 (`validateYearLevelIds` rejects empty) |
| GET /api/taxonomy returns correct wire shape | 3 |
| Taxonomy is read-only (no mutation endpoint) | 3 |
| Docs accurate | 4 |
