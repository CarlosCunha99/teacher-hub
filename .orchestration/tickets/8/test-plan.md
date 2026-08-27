# Test plan

## Coverage summary
- Unit tests: 7 new, 0 updated
- Functional/integration tests: 3 new, 0 updated
- Existing regression tests preserved: yes — `typescript.test.ts`, `scripts.test.ts`, `readme.test.ts`, `health/route.test.ts` unchanged; new files extend TypeScript and build coverage automatically

## Test runner
- Framework: Vitest
- Command: `npm test` (runs `vitest run`)
- Fast subset: `npx vitest run src/lib/__tests__/teachers.test.ts src/app/teachers`

---

## Behaviors to test

### Unit

- **getTeacherByUsername returns teacher for existing username** — resolves with a `Teacher` object containing `name`, `bio`, and `joined_at`.
  - File: `src/lib/__tests__/teachers.test.ts` (new)
  - Key assertions: returned object has correct `name`, `bio`, `joined_at`; DB query called with correct username parameter
  - Setup: mock DB client; stub query to return one user row
  - Maps to acceptance criterion: AC1 — name, bio, joined date displayed

- **getTeacherByUsername returns null for unknown username** — resolves with `null` when no user row matches.
  - File: `src/lib/__tests__/teachers.test.ts` (new)
  - Key assertions: return value is `null`; no throw
  - Setup: mock DB client; stub query to return empty result
  - Maps to acceptance criterion: AC5 — not-found state

- **getPublishedResourcesByTeacher returns only published resources** — filters out draft/private rows.
  - File: `src/lib/__tests__/teachers.test.ts` (new)
  - Key assertions: result contains only rows with `status = 'published'`; draft rows absent
  - Setup: mock DB returning mix of published + draft rows
  - Maps to acceptance criterion: AC2 — published resources listed; edge case — visibility rules

- **getPublishedResourcesByTeacher returns empty array when teacher has no published resources** — zero-item result without error.
  - File: `src/lib/__tests__/teachers.test.ts` (new)
  - Key assertions: `[]` returned; no throw
  - Setup: mock DB returning empty result
  - Maps to acceptance criterion: AC2, edge case — empty state

- **getShareableBoardsByTeacher returns only shareable boards** — filters out boards with `shareable = false`.
  - File: `src/lib/__tests__/teachers.test.ts` (new)
  - Key assertions: result contains only boards with `shareable = true`; private boards absent
  - Setup: mock DB returning mix of shareable + private board rows
  - Maps to acceptance criterion: AC3 — shareable boards listed; edge case — visibility rules

- **getShareableBoardsByTeacher returns empty array when teacher has no shareable boards** — zero-item result without error.
  - File: `src/lib/__tests__/teachers.test.ts` (new)
  - Key assertions: `[]` returned; no throw
  - Setup: mock DB returning empty result
  - Maps to acceptance criterion: AC3, edge case — empty state

- **Counts equal lengths of returned arrays** — resource count and board count are derived from, and therefore always equal, the lengths of the filtered lists.
  - File: `src/app/teachers/[username]/__tests__/page.test.tsx` (new)
  - Key assertions: `resources.length === displayedResourceCount`, `boards.length === displayedBoardCount`
  - Setup: render page component with mocked DAL returning N resources and M boards; inspect rendered count labels
  - Maps to acceptance criterion: AC4 — counts match displayed items

---

### Functional / integration

- **Profile page renders identity + lists for a valid teacher** — full happy-path render of name, bio, joined date, resource list, and board list.
  - File: `src/app/teachers/[username]/__tests__/page.test.tsx` (new)
  - Preconditions: mocked `getTeacherByUsername` returns a teacher; mocked `getPublishedResourcesByTeacher` returns 2 resources; mocked `getShareableBoardsByTeacher` returns 1 board
  - Actions: call the Server Component (async function) with `params = { username: 'alice' }`; render result with React Testing Library
  - Assertions: name text present; bio text present; joined date present; resource titles present; board title present; count labels show "2" and "1"
  - Cleanup: restore mocks
  - Maps to acceptance criterion: AC1, AC2, AC3, AC4

- **Profile page calls notFound() for an unknown username** — correct 404 semantics instead of error or blank render.
  - File: `src/app/teachers/[username]/__tests__/page.test.tsx` (new)
  - Preconditions: mocked `getTeacherByUsername` returns `null`; Next.js `notFound` imported and spied upon
  - Actions: call Server Component with `params = { username: 'ghost' }`
  - Assertions: `notFound` spy called exactly once; component does not render teacher identity markup
  - Cleanup: restore mocks and spy
  - Maps to acceptance criterion: AC5 — not-found state

- **Profile page shows empty states when teacher has zero published resources and zero shareable boards** — valid profile with 0-count empty state messaging.
  - File: `src/app/teachers/[username]/__tests__/page.test.tsx` (new)
  - Preconditions: mocked DAL returns valid teacher + empty arrays for both resources and boards
  - Actions: render page with `params = { username: 'newteacher' }`
  - Assertions: count labels show "0"; empty-state message present for resources; empty-state message present for boards; page renders without error
  - Cleanup: restore mocks
  - Maps to acceptance criterion: AC2, AC3, AC4, edge case — empty state

---

## Edge cases covered
- Draft/private resources not shown → tested by: *getPublishedResourcesByTeacher returns only published resources*
- Private boards (shareable=false) not shown → tested by: *getShareableBoardsByTeacher returns only shareable boards*
- Zero resources + zero boards valid profile → tested by: *empty states functional test*
- Counts always match display length → tested by: *Counts equal lengths of returned arrays*
- Non-existent username → 404 via `notFound()` → tested by: *notFound() called for unknown username*

---

## Not tested (with reason)
- **Profile edit (name/bio update)** — deferred to account settings ticket (#2); no settings UI or auth session infrastructure exists; write path is out of scope for this ticket per solution.md
- **Access control: teacher cannot edit another teacher's profile** — AC7 requires auth session; no auth infrastructure is present; deferred to #2 integration
- **Long/unicode bio and name rendering** — layout/visual concern; no visual regression framework in the repo; considered out of scope for unit/functional tests
- **Database query performance for high-volume teachers** — no load/benchmark tooling in the repo; covered by indexing strategy in #3
- **Not-found vs. deactivated account distinction** — out of scope for MVP per ticket clarifications; deactivated account states undefined until #2

---

## Fixtures & data

- **`mockTeacher`** — `{ id: 'u1', username: 'alice', name: 'Alice Smith', bio: 'Year 5 teacher', joined_at: '2024-01-15T00:00:00Z' }` — shared constant in test file(s)
- **`mockResources`** — array of 2 objects `{ id, title, status: 'published', teacher_id: 'u1' }` — inline in page test
- **`mockBoards`** — array of 1 object `{ id, title, shareable: true, teacher_id: 'u1' }` — inline in page test
- **DB client mock** — `vi.mock('@/lib/db')` or equivalent; stub at module level in `src/lib/__tests__/teachers.test.ts`
- **`notFound` mock** — `vi.mock('next/navigation', () => ({ notFound: vi.fn() }))` in `page.test.tsx`
