# Test plan

## Coverage summary

12 acceptance criteria from `ticket.md` are each mapped to one or more concrete test
behaviours below. All tests run with **Vitest** using the repo's existing
`describe`/`it` conventions. Route handlers are imported directly and invoked with
`new Request(...)` — the same pattern used in `src/app/api/health/__tests__/route.test.ts`.
The Prisma client is mocked via `vi.mock('@/lib/prisma')` so tests are database-free
and fast. The `toSlug` utility is tested directly (no mock needed).

**AC → test file mapping:**

| AC | Test file(s) |
|---|---|
| AC-1 Create tag + slug | `tags/__tests__/route.test.ts` |
| AC-2 List own tags only | `tags/__tests__/route.test.ts` |
| AC-3 Delete tag + cascade | `tags/[id]/__tests__/route.test.ts` |
| AC-4 Attach / detach tag | `resources/[id]/tags/__tests__/route.test.ts` |
| AC-5 Authorization errors | `tags/__tests__`, `tags/[id]/__tests__`, `resources/[id]/tags/__tests__` |
| AC-6 Unauthenticated rejected | all four route test files |
| AC-7 Filter by tag slugs | `resources/__tests__/route.test.ts` |
| AC-8 OR / AND semantics | `resources/__tests__/route.test.ts` |
| AC-9 Compose with subject/year filters | `resources/__tests__/route.test.ts` |
| AC-10 Slug determinism + collision | `lib/__tests__/slug.test.ts`, `tags/__tests__/route.test.ts` |
| AC-11 Name trim + empty rejected | `tags/__tests__/route.test.ts`, `lib/__tests__/slug.test.ts` |
| AC-12 Test coverage requirement | satisfied by this plan |

---

## Test runner

**Vitest** (configured in `vitest.config.ts`; `environment: "node"`, `globals: true`).

Run all new tests with:
```
npx vitest run src/app/api/tags src/app/api/resources src/lib
```

Run the full suite (including existing tests):
```
npx vitest run
```

---

## Behaviors to test

### Unit

#### `src/lib/__tests__/slug.test.ts`  —  `toSlug` utility  (AC-10, AC-11)

| # | Behaviour | Input | Expected |
|---|---|---|---|
| U-1 | Basic lowercase + hyphen | `"Hello World"` | `"hello-world"` |
| U-2 | Punctuation collapsed to hyphen | `"AQA: GCSE (2024)"` | `"aqa-gcse-2024"` |
| U-3 | Leading/trailing hyphens stripped | `" - STEM - "` | `"stem"` |
| U-4 | Multiple consecutive hyphens collapsed | `"Block  3  Unit  2"` | `"block-3-unit-2"` |
| U-5 | Accented characters normalised | `"Ëlève"` | deterministic, non-empty, URL-safe string |
| U-6 | Non-Latin script handled without throwing | `"数学"` | no exception thrown; output is a non-empty string |
| U-7 | Leading/trailing whitespace trimmed before slug | `"  SEND-friendly  "` | `"send-friendly"` |
| U-8 | Empty string rejected | `""` | throws or returns `null`/error indicator |
| U-9 | Whitespace-only string rejected | `"   "` | throws or returns `null`/error indicator |
| U-10 | Determinism: same name always same slug | `"AQA GCSE"` called twice | both calls return identical string |

---

### Functional / integration

All route handler tests follow this pattern:
- Import the named export (`GET`, `POST`, `DELETE`) from the route module.
- Mock `@/lib/prisma` with `vi.mock`; configure return values per test.
- Call the handler with `new Request(url, { method, headers, body })`.
- Assert `response.status` and parsed JSON body.

---

#### `src/app/api/tags/__tests__/route.test.ts`  (AC-1, AC-2, AC-6, AC-10, AC-11)

**`POST /api/tags` — create tag**

| # | Behaviour | Setup / input | Expected |
|---|---|---|---|
| F-1 | Happy path: create tag | `X-Teacher-Id: t1`, body `{ name: "AQA GCSE" }` | 201, body contains `{ id, name: "AQA GCSE", slug: "aqa-gcse", teacherId: "t1" }` |
| F-2 | Slug is URL-safe kebab-case | body `{ name: "STEM: Challenge (2024)" }` | slug matches `/^[a-z0-9-]+$/` |
| F-3 | Name trimmed before storage | body `{ name: "  SEND-friendly  " }` | stored name is `"SEND-friendly"` (no surrounding spaces) |
| F-4 | Empty name rejected | body `{ name: "" }` | 400, error field in body |
| F-5 | Whitespace-only name rejected | body `{ name: "   " }` | 400, error field in body |
| F-6 | Slug collision same teacher rejected | mock DB returns existing tag with same slug for teacher | 409 (or documented disambiguation), body includes error |
| F-7 | Same name different teacher allowed | mock DB: another teacher has same slug, this teacher does not | 201 created successfully |
| F-8 | Missing `X-Teacher-Id` header | no header | 401, error body |
| F-9 | Empty `X-Teacher-Id` header | `X-Teacher-Id: ""` | 401 or 400, error body |

**`GET /api/tags` — list own tags**

| # | Behaviour | Setup / input | Expected |
|---|---|---|---|
| F-10 | Happy path: returns caller's tags | `X-Teacher-Id: t1`, mock returns 3 tags for t1 | 200, array of 3 tags, all with `teacherId: "t1"` |
| F-11 | Cross-teacher isolation | `X-Teacher-Id: t2`, mock returns 0 tags for t2 | 200, empty array (t1's tags not present) |
| F-12 | No tags yet returns empty array | mock returns `[]` | 200, `[]` |
| F-13 | Missing `X-Teacher-Id` | no header | 401 |

---

#### `src/app/api/tags/[id]/__tests__/route.test.ts`  (AC-3, AC-5, AC-6)

**`DELETE /api/tags/[id]` — delete tag**

| # | Behaviour | Setup / input | Expected |
|---|---|---|---|
| F-14 | Happy path: delete own tag | `X-Teacher-Id: t1`, mock finds tag owned by t1, deletes it + ResourceTag cascade | 200 (or 204), success indicator |
| F-15 | Cascade: ResourceTag rows deleted | verify mock's delete/deleteMany called for ResourceTag associations | confirmed by spy/mock call assertion |
| F-16 | Tag not found | mock returns null for tag lookup | 404, error body |
| F-17 | Tag owned by another teacher | mock returns tag with `teacherId: "t2"` | 403, explicit authorization error (not silent 204) |
| F-18 | Missing `X-Teacher-Id` | no header | 401 |

---

#### `src/app/api/resources/__tests__/route.test.ts`  (AC-7, AC-8, AC-9)

**`GET /api/resources` — list / filter resources**

| # | Behaviour | Setup / input | Expected |
|---|---|---|---|
| F-19 | No filter: returns all resources | no query params | 200, all resources returned (backward-compat baseline) |
| F-20 | Filter single tag (OR default) | `?tags=aqa-gcse` | 200, only resources carrying that tag |
| F-21 | OR filter: multi-tag, returns union | `?tags=aqa-gcse,stem&mode=or` | 200, resources with at least one of those tags |
| F-22 | OR is the default mode | `?tags=aqa-gcse,stem` (no `mode`) | same result as `mode=or` |
| F-23 | AND filter: returns intersection | `?tags=aqa-gcse,stem&mode=and` | 200, only resources carrying BOTH tags |
| F-24 | Unknown slug returns empty | `?tags=no-such-tag` | 200, empty array (not 404) |
| F-25 | Mixed valid/unknown slug (OR) | `?tags=aqa-gcse,no-such-tag&mode=or` | 200, resources matching `aqa-gcse` only (unknown contributes nothing) |
| F-26 | Mixed valid/unknown slug (AND) | `?tags=aqa-gcse,no-such-tag&mode=and` | 200, empty array (unknown forces AND to zero) |
| F-27 | Compose with subject filter | `?tags=aqa-gcse&subject=science` | 200, resources matching BOTH constraints |
| F-28 | Compose with year-level filter | `?tags=aqa-gcse&yearLevel=ks4` | 200, resources matching BOTH constraints |
| F-29 | Existing consumers unaffected | caller passes no tag params | identical response to F-19 (backward-compat) |
| F-30 | `mode` param is case-insensitive or strictly validated | `?tags=x&mode=AND` | consistent behaviour (either works or documented error) |

**`POST /api/resources` — create resource stub**

| # | Behaviour | Setup / input | Expected |
|---|---|---|---|
| F-31 | Happy path: create resource | `X-Teacher-Id: t1`, body `{ title: "My Worksheet" }` | 201, body contains `{ id, title, teacherId: "t1" }` |
| F-32 | Missing `X-Teacher-Id` | no header | 401 |

---

#### `src/app/api/resources/[id]/tags/__tests__/route.test.ts`  (AC-4, AC-5, AC-6)

**`POST /api/resources/[id]/tags` — attach tag**

| # | Behaviour | Setup / input | Expected |
|---|---|---|---|
| F-33 | Happy path: attach tag | `X-Teacher-Id: t1`, resource owned by t1, tag owned by t1 | 200 or 201, success |
| F-34 | Idempotent: attach already-attached tag | mock returns existing ResourceTag row | 200 or 201, no error (no duplicate created) |
| F-35 | Tag not owned by caller | mock: tag.teacherId = "t2" | 403, explicit authorization error |
| F-36 | Resource not owned by caller | mock: resource.teacherId = "t2" | 403, explicit authorization error |
| F-37 | Tag does not exist | mock: tag lookup returns null | 404, error body |
| F-38 | Resource does not exist | mock: resource lookup returns null | 404, error body |
| F-39 | Missing `X-Teacher-Id` | no header | 401 |

**`DELETE /api/resources/[id]/tags` — detach tag**

| # | Behaviour | Setup / input | Expected |
|---|---|---|---|
| F-40 | Happy path: detach tag | `X-Teacher-Id: t1`, association exists | 200 or 204 |
| F-41 | Detach tag not currently attached | mock: ResourceTag row not found | 404 or documented no-op (consistent, not a 500) |
| F-42 | Resource not owned by caller | mock: resource.teacherId = "t2" | 403, explicit authorization error |
| F-43 | Missing `X-Teacher-Id` | no header | 401 |

---

## Edge cases covered

| Edge case | Covered by |
|---|---|
| Two teachers, same tag display name | F-7 (attach allowed for different teacher) |
| Slug collision same teacher | F-6 |
| Delete cascades ResourceTag but not Resource | F-14, F-15 |
| Delete Resource removes associations but not Tag | noted as not-tested (see below) — no resource-delete endpoint in scope |
| Idempotent attach | F-34 |
| Detach unattached tag | F-41 |
| Unknown slug in filter | F-24 |
| Mixed valid/invalid slugs (OR, AND) | F-25, F-26 |
| Non-ASCII tag names | U-5, U-6 |
| Tag name whitespace trimming | F-3, U-7 |
| Empty / whitespace-only name | F-4, F-5, U-8, U-9 |
| Authorization error is explicit (not silent no-op) | F-17, F-35, F-36, F-42 |
| Backward compatibility of resource list with no tag filter | F-19, F-29 |
| OR is the default filter mode | F-22 |

---

## Not tested (with reason)

| Item | Reason |
|---|---|
| `DELETE /api/resources/[id]` cascade to ResourceTag | No resource-delete endpoint is in scope for this ticket; cascade behaviour for that direction cannot be tested without it. |
| Real PostgreSQL vs SQLite dialect differences | Tests run against a mocked Prisma client; dialect-level behaviour is an infrastructure concern outside unit/integration test scope. |
| `X-Teacher-Id` spoofability / real auth | Auth stub is acknowledged as temporary (issue #2); testing real auth is out of scope for this ticket. |
| Pagination / large result sets | No upper cardinality limit is enforced at MVP; pagination is explicitly out of scope. |
| Tag name XSS / injection in a rendered UI | Frontend rendering is out of scope for this ticket; the API stores and returns the value safely by construction (parameterised queries via Prisma). |
| `GET /api/resources` performance at scale | Performance is a non-functional requirement noted as a downstream concern; no load test is required. |
| `mode` values other than `or`/`and` | Exact error handling (400 vs default fallback) is an implementation choice; F-30 captures this as a consistency assertion. |
| Tag search / autocomplete / popular tags | Explicitly out of scope in `ticket.md`. |

---

## Fixtures & data

All fixtures are in-memory objects set up per test via `vi.mock` and `mockResolvedValue`. No database seeding is required.

**Tag fixture:**
```ts
const tagFixture = { id: "tag-1", name: "AQA GCSE", slug: "aqa-gcse", teacherId: "t1", createdAt: new Date() };
```

**Resource fixture:**
```ts
const resourceFixture = { id: "res-1", title: "My Worksheet", teacherId: "t1", createdAt: new Date() };
```

**ResourceTag fixture:**
```ts
const resourceTagFixture = { resourceId: "res-1", tagId: "tag-1" };
```

**Second-teacher tag fixture (cross-teacher isolation tests):**
```ts
const otherTeacherTag = { id: "tag-2", name: "Another Tag", slug: "another-tag", teacherId: "t2", createdAt: new Date() };
```

**Prisma mock shape (used across all route tests):**
```ts
vi.mock("@/lib/prisma", () => ({
  default: {
    tag: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    resource: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    resourceTag: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  },
}));
```

**Request helpers:**
```ts
const makeRequest = (url: string, method: string, teacherId: string | null, body?: object) =>
  new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(teacherId ? { "X-Teacher-Id": teacherId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
```
