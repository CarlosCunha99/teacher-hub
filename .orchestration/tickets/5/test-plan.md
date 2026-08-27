---
deliverable_path: test-plan.md
status: done
---

# Test plan

## Coverage summary
- Unit tests: 3 new files, 0 updated
- Functional/integration tests: 1 new file, 0 updated
- Existing regression tests preserved: yes — `src/__tests__/`, `src/app/api/health/__tests__/route.test.ts` are unaffected; all are additive-only changes

## Test runner
- Framework: Vitest 3 (`globals: true`, `environment: node`)
- Command: `npm test` (`vitest run`)
- Fast subset: `npx vitest run src/lib/__tests__/taxonomy.test.ts src/lib/__tests__/taxonomy-service.test.ts src/app/api/taxonomy/__tests__/route.test.ts`

---

## Behaviors to test

### Unit

---

#### 1. Taxonomy constants — subject count and shape
**Spec:** `SUBJECTS` exports exactly six entries, each with a non-empty string `id` and a non-empty string `label`.

- File: `src/lib/__tests__/taxonomy.test.ts` (new)
- Key assertions:
  - `SUBJECTS` is an array of length 6
  - Every entry has `typeof entry.id === 'string'` and `entry.id.length > 0`
  - Every entry has `typeof entry.label === 'string'` and `entry.label.length > 0`
- Setup: import `SUBJECTS` from `@/lib/taxonomy`; no mocks needed
- Maps to acceptance criterion: "An approved taxonomy of subjects … exists as reference data, each entry having a stable identifier and a human-readable display label"

---

#### 2. Taxonomy constants — year-level count and shape
**Spec:** `YEAR_LEVELS` exports exactly three entries, each with a non-empty string `id` and a non-empty string `label`.

- File: `src/lib/__tests__/taxonomy.test.ts` (new)
- Key assertions:
  - `YEAR_LEVELS` is an array of length 3
  - Every entry has `typeof entry.id === 'string'` and `entry.id.length > 0`
  - Every entry has `typeof entry.label === 'string'` and `entry.label.length > 0`
- Setup: import `YEAR_LEVELS` from `@/lib/taxonomy`
- Maps to acceptance criterion: "An approved taxonomy of year levels … exists as reference data"

---

#### 3. Taxonomy constants — subject vocabulary is the approved MVP set
**Spec:** `SUBJECTS` contains exactly the six MVP subjects by display label: Mathematics, English, Science, Social Studies, Arts, Physical Education.

- File: `src/lib/__tests__/taxonomy.test.ts` (new)
- Key assertions:
  - `SUBJECTS.map(s => s.label)` equals (in any order) `['Mathematics', 'English', 'Science', 'Social Studies', 'Arts', 'Physical Education']`
- Setup: import `SUBJECTS` from `@/lib/taxonomy`
- Maps to acceptance criterion: approved taxonomy exists with human-readable labels; underpins AC "APIs reject tags that are not part of the approved taxonomy"

---

#### 4. Taxonomy constants — year-level vocabulary is the approved MVP set
**Spec:** `YEAR_LEVELS` contains exactly the three MVP year levels by display label: Elementary, Middle School, High School.

- File: `src/lib/__tests__/taxonomy.test.ts` (new)
- Key assertions:
  - `YEAR_LEVELS.map(y => y.label)` equals (in any order) `['Elementary', 'Middle School', 'High School']`
- Setup: import `YEAR_LEVELS` from `@/lib/taxonomy`
- Maps to acceptance criterion: approved year-level taxonomy exists

---

#### 5. Taxonomy constants — subject IDs are unique and stable (non-numeric slugs)
**Spec:** No two subjects share the same `id`; IDs are not empty strings and do not look like auto-increment integers (they are stable text/slug keys).

- File: `src/lib/__tests__/taxonomy.test.ts` (new)
- Key assertions:
  - `new Set(SUBJECTS.map(s => s.id)).size === SUBJECTS.length` (uniqueness)
  - Every `entry.id` does not match `/^\d+$/` (not a plain integer)
- Setup: import `SUBJECTS` from `@/lib/taxonomy`
- Maps to acceptance criterion: "stable identifier" requirement; also maps to impact warning "taxonomy IDs must be stable across environments"

---

#### 6. Taxonomy constants — year-level IDs are unique and stable (non-numeric slugs)
**Spec:** No two year levels share the same `id`; IDs are stable text/slug keys, not auto-increment integers.

- File: `src/lib/__tests__/taxonomy.test.ts` (new)
- Key assertions:
  - `new Set(YEAR_LEVELS.map(y => y.id)).size === YEAR_LEVELS.length`
  - Every `entry.id` does not match `/^\d+$/`
- Setup: import `YEAR_LEVELS` from `@/lib/taxonomy`
- Maps to acceptance criterion: stable identifier requirement

---

#### 7. Taxonomy constants — subject IDs and year-level IDs are disjoint
**Spec:** No ID appears in both the subject list and the year-level list (guards against accidental cross-contamination that would break validation).

- File: `src/lib/__tests__/taxonomy.test.ts` (new)
- Key assertions:
  - The intersection of `SUBJECTS.map(s => s.id)` and `YEAR_LEVELS.map(y => y.id)` is empty
- Setup: import both from `@/lib/taxonomy`
- Maps to acceptance criterion: correctness of validation; a shared ID would cause `validateSubjectIds` to accept a year-level ID

---

#### 8. Service — `getTaxonomy` returns both collections
**Spec:** `getTaxonomy()` returns an object with `subjects` equal to `SUBJECTS` and `yearLevels` equal to `YEAR_LEVELS`.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - `result.subjects` deep-equals the exported `SUBJECTS` array
  - `result.yearLevels` deep-equals the exported `YEAR_LEVELS` array
  - The result has no extra keys beyond `subjects` and `yearLevels`
- Setup: import `getTaxonomy` from `@/lib/taxonomy-service`; no mocks needed (pure in-memory)
- Maps to acceptance criterion: "taxonomy reference data is retrievable by the application"

---

#### 9. Service — `validateSubjectIds` accepts a single valid subject ID
**Spec:** `validateSubjectIds` resolves/returns successfully when called with an array containing exactly one ID that is present in `SUBJECTS`.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Does not throw, does not return an error object
  - The first valid subject ID from `SUBJECTS` is accepted
- Setup: take `SUBJECTS[0].id` as the test value; no mocks
- Maps to acceptance criterion: "resource creation requires valid subject selection"

---

#### 10. Service — `validateSubjectIds` accepts all valid subject IDs at once
**Spec:** `validateSubjectIds` accepts an array containing every defined subject ID (supports many-to-many, multi-tag scenario).

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Does not throw or return error for `SUBJECTS.map(s => s.id)` (full set)
- Setup: no mocks; only input axis changed vs test 9 (multiple IDs vs one)
- Maps to acceptance criterion: many-to-many tagging — at least one subject required, but multiple allowed

---

#### 11. Service — `validateSubjectIds` rejects an empty array
**Spec:** `validateSubjectIds([])` fails with a validation error, because at least one subject is required.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Throws or returns an error/falsy result for `[]`
  - Error message or rejection indicates "required" / "at least one" subject
- Setup: pin all other state identical to test 9 (valid function import); only change is empty array input
- Maps to acceptance criterion: "resource creation requires a subject selection; a submission missing either is rejected"

---

#### 12. Service — `validateSubjectIds` rejects an array containing one unknown subject ID
**Spec:** `validateSubjectIds(['not-a-real-subject'])` fails with a validation error identifying the invalid ID.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Throws or returns error for an ID not present in `SUBJECTS`
  - Error message or rejection references the invalid ID (or generic "not in taxonomy" message)
- Setup: pin all other state identical to test 9; only change is unknown ID input
- Maps to acceptance criterion: "APIs reject tags that are not part of the approved taxonomy"

---

#### 13. Service — `validateSubjectIds` rejects an array that mixes one valid and one unknown subject ID
**Spec:** If any submitted ID is not in the taxonomy, the whole call is rejected — a mix of valid and invalid is not partially accepted.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - `validateSubjectIds([SUBJECTS[0].id, 'unknown-id'])` throws or returns error
- Setup: pin all other state identical to test 12; only change is presence of one valid ID alongside the invalid one
- Maps to acceptance criterion: "APIs reject tags that are not part of the approved taxonomy" — partial acceptance would be a silent data error

---

#### 14. Service — `validateSubjectIds` rejects a year-level ID passed as a subject ID
**Spec:** A year-level ID (e.g. `YEAR_LEVELS[0].id`) is not a valid subject ID and must be rejected.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - `validateSubjectIds([YEAR_LEVELS[0].id])` throws or returns error
- Setup: import both `YEAR_LEVELS` and `validateSubjectIds`; only input axis changed vs test 12
- Maps to acceptance criterion: taxonomy enforcement correctness

---

#### 15. Service — `validateYearLevelIds` accepts a single valid year-level ID
**Spec:** `validateYearLevelIds` resolves/returns successfully when called with an array containing exactly one ID present in `YEAR_LEVELS`.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Does not throw or return error for `[YEAR_LEVELS[0].id]`
- Setup: no mocks; mirrors test 9 but for year levels (independent axis)
- Maps to acceptance criterion: "resource creation requires a year-level selection"

---

#### 16. Service — `validateYearLevelIds` accepts all valid year-level IDs at once
**Spec:** `validateYearLevelIds` accepts all three year-level IDs simultaneously.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Does not throw or return error for `YEAR_LEVELS.map(y => y.id)`
- Setup: mirrors test 10 but for year levels
- Maps to acceptance criterion: many-to-many year-level tagging

---

#### 17. Service — `validateYearLevelIds` rejects an empty array
**Spec:** `validateYearLevelIds([])` fails with a validation error — at least one year level is required.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Throws or returns error for `[]`
- Setup: mirrors test 11 but for year levels (independent axis)
- Maps to acceptance criterion: "a submission missing [year level] is rejected"

---

#### 18. Service — `validateYearLevelIds` rejects an unknown year-level ID
**Spec:** `validateYearLevelIds(['not-a-real-year-level'])` fails with a validation error.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - Throws or returns error for unknown ID
- Setup: mirrors test 12 but for year levels (independent axis)
- Maps to acceptance criterion: "APIs reject tags that are not part of the approved taxonomy"

---

#### 19. Service — `validateYearLevelIds` rejects a mix of valid and unknown year-level IDs
**Spec:** A mixed valid+invalid year-level ID array is entirely rejected.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - `validateYearLevelIds([YEAR_LEVELS[0].id, 'unknown-id'])` throws or returns error
- Setup: mirrors test 13 but for year levels (independent axis)
- Maps to acceptance criterion: no partial acceptance of invalid taxonomy tags

---

#### 20. Service — `validateYearLevelIds` rejects a subject ID passed as a year-level ID
**Spec:** A subject ID is not a valid year-level ID and must be rejected.

- File: `src/lib/__tests__/taxonomy-service.test.ts` (new)
- Key assertions:
  - `validateYearLevelIds([SUBJECTS[0].id])` throws or returns error
- Setup: mirrors test 14 but swapped axis
- Maps to acceptance criterion: taxonomy enforcement correctness

---

### Functional / integration

---

#### 21. Taxonomy API — GET /api/taxonomy returns 200 with correct shape
**Spec:** A GET request to the taxonomy endpoint returns HTTP 200 with a JSON body containing `subjects` and `yearLevels` arrays.

- File: `src/app/api/taxonomy/__tests__/route.test.ts` (new)
- Preconditions: module loaded, no DB required (in-memory constants)
- Actions: `GET(new Request('http://localhost/api/taxonomy'))`
- Assertions:
  - `response.status === 200`
  - `response.headers.get('content-type')` contains `application/json`
  - `body` has exactly the keys `subjects` and `yearLevels`
  - `body.subjects` is an array; `body.yearLevels` is an array
- Cleanup: none
- Maps to acceptance criterion: "taxonomy reference data is retrievable by the application"

---

#### 22. Taxonomy API — response contains all six subjects with correct shape
**Spec:** `body.subjects` has six entries, each with string `id` and string `label`, matching the approved vocabulary.

- File: `src/app/api/taxonomy/__tests__/route.test.ts` (new)
- Preconditions: same GET request as test 21
- Actions: parse `body.subjects`
- Assertions:
  - `body.subjects.length === 6`
  - Every item has `id` (string, non-empty) and `label` (string, non-empty)
  - Labels match the MVP set: Mathematics, English, Science, Social Studies, Arts, Physical Education
- Cleanup: none
- Maps to acceptance criterion: approved subjects exist and are retrievable

---

#### 23. Taxonomy API — response contains all three year levels with correct shape
**Spec:** `body.yearLevels` has three entries, each with string `id` and string `label`, matching the approved vocabulary.

- File: `src/app/api/taxonomy/__tests__/route.test.ts` (new)
- Preconditions: same GET request as test 21 (independent axis — only collection being verified differs)
- Actions: parse `body.yearLevels`
- Assertions:
  - `body.yearLevels.length === 3`
  - Every item has `id` (string, non-empty) and `label` (string, non-empty)
  - Labels match: Elementary, Middle School, High School
- Cleanup: none
- Maps to acceptance criterion: approved year levels exist and are retrievable

---

#### 24. Taxonomy API — response items contain no extra fields
**Spec:** Each subject and each year-level item in the response has exactly two keys (`id`, `label`) and no additional fields (e.g. no `createdAt`, no internal metadata).

- File: `src/app/api/taxonomy/__tests__/route.test.ts` (new)
- Preconditions: same GET request
- Actions: enumerate keys of `body.subjects[0]` and `body.yearLevels[0]`
- Assertions:
  - `Object.keys(body.subjects[0]).sort()` deep-equals `['id', 'label']`
  - `Object.keys(body.yearLevels[0]).sort()` deep-equals `['id', 'label']`
- Cleanup: none
- Maps to acceptance criterion: stable public API contract — `{ subjects: [{id, label}], yearLevels: [{id, label}] }` is the wire shape consumed by #4 and #6

---

#### 25. Taxonomy API — POST returns 405 Method Not Allowed
**Spec:** The endpoint is read-only; POST (and other mutating methods) must be rejected.

- File: `src/app/api/taxonomy/__tests__/route.test.ts` (new)
- Preconditions: import the route module
- Actions: attempt to call `POST(new Request('http://localhost/api/taxonomy', { method: 'POST' }))` — if no POST handler is exported, Next.js returns 405 automatically; test that either `POST` is not exported or a 405 response is returned
- Assertions:
  - No `POST` export exists in the route module **or** calling the route with method POST yields `response.status === 405`
- Cleanup: none
- Maps to acceptance criterion: taxonomy is read-only (no runtime admin editing, fixed vocabulary)

---

## Edge cases covered

| Edge case (from ticket) | Covered by |
|---|---|
| Empty subjectIds array on resource create/update | Tests 11, 17 (service rejects empty) |
| Unknown / misspelled subject ID | Tests 12, 13 (service rejects unknown) |
| Unknown / misspelled year-level ID | Tests 18, 19 (service rejects unknown) |
| Cross-contamination — year-level ID passed as subject | Test 14 |
| Cross-contamination — subject ID passed as year-level | Test 20 |
| All valid IDs at once (multi-tag) | Tests 10, 16 |
| Stable non-integer IDs (backward compat / extensibility) | Tests 5, 6 |
| Disjoint ID namespaces between subjects and year levels | Test 7 |
| No extra fields in API response (wire contract stability) | Test 24 |
| API is read-only (no mutation) | Test 25 |

---

## Not tested (with reason)

- **Filtering by subject/year level returns accurate result sets** — depends on `resource_subjects`/`resource_year_levels` join tables and the resource listing endpoint, both owned by #3, #4, and #6. Cannot be tested from this ticket alone.
- **Resource cards and detail views display subject/year-level tags** — UI component not delivered by this ticket; owned by #4. Manual verification once #4 ships.
- **Editing an existing resource re-validates taxonomy** — the resource PUT/PATCH handler is owned by #4. The validation *functions* (`validateSubjectIds`, `validateYearLevelIds`) are covered here; the handler integration test lives in #4's test file.
- **Empty/no-match filter state in browse UI** — owned by #6; taxonomy only supplies reference data.
- **Referential integrity at the DB level (FK constraints)** — owned by #3's migration tests; out of scope here.
- **Seed data in the database is correct** — the migration SQL is authored by #3; covered by #3's migration/integration tests. This ticket's tests use in-memory constants, which is sufficient for the service layer.
- **Accessibility of tag chips and filter controls** — ⚠️ no automated a11y test framework is configured in the repo; manual verification or deferred to a dedicated a11y pass.
- **i18n / regional label variants** — deferred to Phase 2 / #17; MVP uses fixed US-style labels.
- **Taxonomy expansion is non-breaking** — additive migration behavior; tested implicitly by the stable-ID tests (5, 6) and by #17 when it lands.

---

## Fixtures & data

- No external fixtures needed. All tests rely on the exported `SUBJECTS` and `YEAR_LEVELS` constants from `@/lib/taxonomy` as the single source of truth. Tests must not hard-code literal ID strings (e.g. `'mathematics'`) — always derive IDs from the exported constants so that a label or slug change does not silently break tests.
- Test files follow the existing pattern: `import … from '@/…'` (path alias resolved by `vite-tsconfig-paths`); `describe`/`it` with Vitest globals.
- No database connection, mock, or seed required: the taxonomy service is expected to be pure in-memory (constants-backed), consistent with the impact analysis warning that no ORM is installed and the endpoint can return hardcoded constants directly.
