# Test plan

## Coverage summary
- Unit tests: 10 new, 0 updated
- Functional/integration tests: 4 new, 0 updated
- Existing regression tests preserved: **yes** — `src/app/api/health/__tests__/route.test.ts`, `src/__tests__/env-config.test.ts`, and other existing tests are unaffected; health route has no DB dependency and continues to pass unchanged

## Test runner
- Framework: Vitest v3 (detected in `package.json` + `vitest.config.ts`)
- Command: `npx vitest run`
- Fast subset:
  ```
  npx vitest run src/app/api/resources src/app/teachers src/components
  ```

---

## Behaviors to test

### Unit

---

#### 1. Download endpoint — published resource returns success and increments counter
One sentence: A POST to the download endpoint for a published resource returns a success response AND calls the DB increment exactly once.

- File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new)
- Key assertions:
  - Response status is 200 (or 302 redirect for a URL stub)
  - `prisma.resource.update` (or equivalent increment call) was called exactly once with `downloads: { increment: 1 }`
  - The update is called only after the resource is confirmed published (i.e., `findUnique` is called first)
- Setup:
  - `vi.mock('@/lib/db')` — mock the PrismaClient singleton exported from `src/lib/db.ts`
  - `vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))` — mock Next.js cache invalidation
  - `prisma.resource.findUnique` returns a fixture object `{ id: '1', status: 'PUBLISHED', authorId: 'teacher-1', fileUrl: 'https://example.com/file.pdf', ... }`
  - `prisma.resource.update` returns the updated fixture
- Maps to acceptance criterion: "Each successful download increments a persistent counter exactly once" + "Resource files are downloadable through an HTTP endpoint"

---

#### 2. Download endpoint — DRAFT resource returns 404, no increment
One sentence: A POST for a resource whose status is DRAFT returns 404 and the download counter is NOT touched.

- File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new, same file as above)
- Key assertions:
  - Response status is 404
  - `prisma.resource.update` (increment) was NOT called
- Setup:
  - Same `vi.mock` setup as behavior 1
  - `prisma.resource.findUnique` returns `{ id: '2', status: 'DRAFT', ... }`
- Maps to acceptance criterion: "Failed, aborted, or rejected download requests do NOT increment the counter" + "Draft, unpublished, or deleted resources are excluded"

---

#### 3. Download endpoint — non-existent resource returns 404, no increment
One sentence: A POST for an ID that matches no resource returns 404 without touching the counter.

- File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new, same file)
- Key assertions:
  - Response status is 404
  - `prisma.resource.update` was NOT called
- Setup:
  - `prisma.resource.findUnique` returns `null`
- Maps to acceptance criterion: "Failed, aborted, or rejected download requests do NOT increment the counter"

---

#### 4. Download endpoint — DB error on findUnique returns 5xx, no increment
One sentence: If the Prisma lookup throws, the endpoint responds with an error status and does not attempt the increment.

- File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new, same file)
- Key assertions:
  - Response status is 500 (or 503)
  - `prisma.resource.update` was NOT called
- Setup:
  - `prisma.resource.findUnique` rejects with `new Error('DB error')`
- Maps to acceptance criterion: "Failed, aborted, or rejected download requests do NOT increment the counter"

---

#### 5. Download endpoint — revalidatePath is called on success
One sentence: A successful download triggers `revalidatePath` with the author's profile path so the profile stats are fresh on next load.

- File: `src/app/api/resources/[id]/download/__tests__/route.test.ts` (new, same file)
- Key assertions:
  - `revalidatePath` spy was called with `'/teachers/teacher-1'` (constructed from `authorId` on the resource record)
- Setup:
  - Same happy-path setup as behavior 1; `revalidatePath` is a `vi.fn()` spy
- Maps to acceptance criterion: "Aggregate totals reflect new likes/downloads on the next profile page load after the mutation completes"

---

#### 6. ResourceCard — renders download count
One sentence: `<ResourceCard>` renders the passed `downloadCount` value visibly on the page.

- File: `src/components/__tests__/ResourceCard.test.tsx` (new)
- Note: requires `// @vitest-environment jsdom` file-level pragma (global config uses `node`)
- Key assertions:
  - The rendered output contains the string representation of the download count (e.g. `"42"`)
  - The element is present in the document (not null)
- Setup:
  - `@testing-library/react` `render(<ResourceCard id="1" title="Test Resource" downloadCount={42} />)`
  - No Prisma mocks needed — component is presentation-only
- Maps to acceptance criterion: "Resource card and resource detail view display the current download count for that resource"

---

#### 7. ResourceCard — renders zero download count without error
One sentence: `<ResourceCard>` with `downloadCount={0}` renders `"0"` (not blank, not an error).

- File: `src/components/__tests__/ResourceCard.test.tsx` (new, same file)
- Key assertions:
  - Rendered output contains `"0"` for the download count
  - No thrown exceptions
- Setup: same as behavior 6 with `downloadCount={0}`
- Maps to acceptance criterion: "Download count appears on resource card" + empty-state edge case

---

#### 8. StatsHeaderCard — renders aggregate like and download counts
One sentence: `<StatsHeaderCard>` correctly renders the provided `totalLikes` and `totalDownloads` values.

- File: `src/components/__tests__/StatsHeaderCard.test.tsx` (new)
- Note: requires `// @vitest-environment jsdom` file-level pragma
- Key assertions:
  - Text containing the likes count (e.g. `"15"`) is in the document
  - Text containing the downloads count (e.g. `"8"`) is in the document
- Setup:
  - `render(<StatsHeaderCard totalLikes={15} totalDownloads={8} />)`
- Maps to acceptance criterion: "Teacher profile page displays total likes / total downloads summed across published resources"

---

#### 9. StatsHeaderCard — renders zeros without error
One sentence: `<StatsHeaderCard totalLikes={0} totalDownloads={0} />` renders `"0"` for both values and does not throw.

- File: `src/components/__tests__/StatsHeaderCard.test.tsx` (new, same file)
- Key assertions:
  - Both zero values are displayed
  - No error thrown, no blank/undefined in output
- Setup: `render(<StatsHeaderCard totalLikes={0} totalDownloads={0} />)`
- Maps to acceptance criterion: "A teacher with zero published resources sees `0` for both totals (not an error, not blank)"

---

#### 10. StatsHeaderCard — DRAFT/deleted resources not counted (prop contract)
One sentence: The component accepts pre-filtered totals from the server; it trusts caller to pass PUBLISHED-only sums — no client-side filtering in the component itself.

- File: `src/components/__tests__/StatsHeaderCard.test.tsx` (new, same file)
- Key assertions:
  - Renders exactly the numbers passed in props (no internal filtering logic alters them)
  - E.g. `totalLikes={3}` → exactly `"3"` appears, not some derived value
- Setup: render with controlled props
- Maps to acceptance criterion: "Draft, unpublished, or deleted resources are excluded from both aggregate totals" (responsibility lies in the query, not the component)

---

### Functional / integration

---

#### F1. Profile page aggregate — teacher with N published resources returns correct totals
One sentence: The teacher profile page data-fetching path returns the correct sum of likes and downloads when the teacher has multiple published resources.

- File: `src/app/teachers/[teacherId]/__tests__/page.test.ts` (new)
- Preconditions:
  - `vi.mock('@/lib/db')` mocking PrismaClient
  - `prisma.like.aggregate` (or equivalent) mocked to return `{ _sum: { count: 15 } }` (or `_count`)
  - `prisma.download.aggregate` (or equivalent) mocked to return `{ _sum: { count: 8 } }`
- Actions:
  - Import the page component / data-fetching function and call it with `params: { teacherId: 'teacher-1' }`
- Assertions:
  - The resolved data or rendered output contains `totalLikes: 15` and `totalDownloads: 8`
  - The Prisma aggregate queries were called with a `where` clause filtering `authorId: 'teacher-1'` AND `resource.status: 'PUBLISHED'`
- Cleanup: `vi.restoreAllMocks()`
- Maps to acceptance criterion: "Teacher profile page displays total likes / total downloads summed across published resources"

---

#### F2. Profile aggregate — excludes DRAFT and deleted resources
One sentence: The aggregate queries passed to Prisma always include a status filter for PUBLISHED-only resources.

- File: `src/app/teachers/[teacherId]/__tests__/page.test.ts` (new, same file)
- Preconditions: same mock setup as F1
- Actions:
  - Call the page/data function
  - Inspect the arguments captured by the Prisma mock
- Assertions:
  - The `where` clause in the captured Prisma call includes `status: 'PUBLISHED'` (or equivalent enum value)
  - A DRAFT resource in the mock data does not contribute to the returned totals (verify by controlling mock return values to return 0 for the PUBLISHED filter query)
- Cleanup: `vi.restoreAllMocks()`
- Maps to acceptance criterion: "Draft, unpublished, or deleted resources are excluded from both aggregate totals"

---

#### F3. Profile aggregate — teacher with zero published resources returns 0, 0
One sentence: When the Prisma aggregates return null sums (empty result), the page returns `0` for both totals instead of throwing or rendering undefined.

- File: `src/app/teachers/[teacherId]/__tests__/page.test.ts` (new, same file)
- Preconditions:
  - Prisma mocks return `{ _sum: { count: null } }` or `{ _count: 0 }` (Prisma returns `null` for `_sum` when there are no rows)
- Actions:
  - Call the page/data function with `{ teacherId: 'new-teacher' }`
- Assertions:
  - `totalLikes` resolves to `0` (not null/undefined/error)
  - `totalDownloads` resolves to `0`
  - No exception is thrown
- Cleanup: `vi.restoreAllMocks()`
- Maps to acceptance criterion: "A teacher with zero published resources sees `0` for both totals (not an error, not blank)"

---

#### F4. Resource detail page — renders resource with download count
One sentence: The resource detail page fetches a published resource by ID and renders its title and download count.

- File: `src/app/resources/[id]/__tests__/page.test.ts` (new)
- Note: requires `// @vitest-environment jsdom` if testing rendered JSX; alternatively test the data layer only (no rendering) if the component is tested separately
- Preconditions:
  - `vi.mock('@/lib/db')`
  - `prisma.resource.findUnique` returns `{ id: '1', title: 'My Resource', status: 'PUBLISHED', _count: { downloads: 7 }, ... }`
- Actions:
  - Import and call the page component function with `params: { id: '1' }`
- Assertions:
  - Rendered output (or returned data) contains `"My Resource"` and `"7"` for download count
- Cleanup: `vi.restoreAllMocks()`
- Maps to acceptance criterion: "Resource card and resource detail view display the current download count for that resource" + "A resource owner can query the download count"

---

## Edge cases covered

| Edge case (from ticket) | Tested by |
|---|---|
| Counter must not increment on non-published resources | Behavior 2 (DRAFT → 404) |
| Counter must not increment on missing resources | Behavior 3 (null → 404) |
| Counter must not increment on DB validation error | Behavior 4 (DB throws → 5xx) |
| Empty state: zero published resources → 0, 0, not error | Behavior 9, F3 |
| State change: un-published resource excluded from totals | F2 (PUBLISHED filter verified on the query WHERE clause) |
| DRAFT/deleted excluded from profile aggregate | F2 |
| `revalidatePath` called so next load reflects new download | Behavior 5 |
| Download count `0` displayed correctly (not blank) | Behavior 7 |

---

## Not tested (with reason)

| Criterion | Reason not tested |
|---|---|
| Concurrent downloads are race-safe (atomic at storage layer) | This is a SQLite/Prisma atomicity guarantee; unit tests with mocked DB cannot exercise the actual storage-layer race. Integration test against a real DB is deferred — Prisma's `update { increment: 1 }` is documented atomic on SQLite single-writer model. |
| Interrupted client-side downloads do not increment counter | Per the solution decision, the counter increments after validation but before transfer — client aborts cannot be reliably detected in HTTP; this is an accepted MVP trade-off, not a testable invariant. |
| Aggregate queries are performant for large N resources (O(1) with index) | Performance / query plan testing requires a real DB with populated data; not covered by unit/mock tests. Covered at DB review time by verifying the `prisma/schema.prisma` indexes on `Resource.authorId`, `Like.resourceId`, `Download.resourceId`. |
| Path traversal / file identity safety | Resources are referenced by opaque DB `id` (not client-supplied file path); behavior tested implicitly by the download endpoint test (ID lookup via Prisma). No additional security test needed at unit level for MVP. |
| Profile stats always publicly visible (no auth check) | Auth is out of scope for MVP (issue #2 not landed). No middleware or auth guard to test. |
| `revalidatePath` causes visible refresh on the profile page | `revalidatePath` invalidates the server cache; verifying the client navigates away and back is an E2E concern outside the current test plan. |
| File bytes actually served to client (issue #4 dependency) | File storage is a stub for MVP (URL redirect); actual byte streaming is deferred to issue #4. The download endpoint test validates the HTTP response status and counter increment; it does not validate file content. |

---

## Fixtures & data

| Fixture | Description | Location |
|---|---|---|
| `publishedResource` | `{ id: '1', title: 'Sample PDF', status: 'PUBLISHED', authorId: 'teacher-1', fileUrl: 'https://example.com/sample.pdf', _count: { downloads: 0 } }` | Inline in each test file (small, no shared file needed for MVP) |
| `draftResource` | `{ id: '2', title: 'Draft', status: 'DRAFT', authorId: 'teacher-1', fileUrl: null }` | Inline |
| `prismaClientMock` | Vitest auto-mock of `@/lib/db` with `vi.mock('@/lib/db')` + per-test `vi.mocked(prisma.resource.findUnique).mockResolvedValue(...)` overrides | Inline per test file; if duplication grows, extract to `src/__tests__/helpers/prismaMock.ts` |
| `nextCacheMock` | `vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))` | Inline in download route test file |

**Note on `@testing-library/react`:** Component tests (behaviors 6–10, F4 if rendered) require `@testing-library/react` and `jsdom`. These packages are not yet in `package.json`; they must be added to `devDependencies` before component tests can run. Each component test file must include the `// @vitest-environment jsdom` pragma since the global Vitest config is set to `environment: "node"`.
