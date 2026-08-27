# Changed Files — Issue 8

**Branch:** issue-8-mvp-build-teacher-profile-pages-with-co-254520  
**Base:** main  
**Total changed:** 8 files

## Production code (5 files)

- `src/app/teachers/[username]/page.tsx` (new, 90 lines)
- `src/app/teachers/[username]/not-found.tsx` (new, 8 lines)
- `src/lib/teachers.ts` (new, 70 lines)
- `src/lib/teachers-data.ts` (new, 105 lines)
- `README.md` (modified, +7 lines)
- `.env.example` (modified, +3 lines)

## Test code (2 files)

- `src/lib/__tests__/teachers.test.ts` (new, 157 lines)
- `src/app/teachers/[username]/__tests__/page.test.tsx` (new, 140 lines)

## Orchestration (internal, not in PR diff)

- `.orchestration/tickets/8/` (workspace, will be stripped before PR open)

**Total production + test changes:** ~580 lines

## Coverage

- All acceptance criteria addressed except profile editing (explicitly deferred to #2 account settings)
- Unit tests for DAL queries: 7 tests
- Integration tests for Server Component: 4 tests
- Full test suite: 29/29 passing
- Lint, type-check, build: all green
